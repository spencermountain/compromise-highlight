(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE
// This is CodeMirror (https://codemirror.net), a code editor
// implemented in JavaScript on top of the browser's DOM.
//
// You can find some technical background for some of the code below
// at http://marijnhaverbeke.nl/blog/#cm-internals .
(function (global, factory) {
  (typeof exports === "undefined" ? "undefined" : _typeof(exports)) === 'object' && typeof module !== 'undefined' ? module.exports = factory() : typeof define === 'function' && define.amd ? define(factory) : global.CodeMirror = factory();
})(void 0, function () {
  'use strict'; // Kludges for bugs and behavior differences that can't be feature
  // detected are enabled based on userAgent etc sniffing.

  var userAgent = navigator.userAgent;
  var platform = navigator.platform;
  var gecko = /gecko\/\d/i.test(userAgent);
  var ie_upto10 = /MSIE \d/.test(userAgent);
  var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent);
  var edge = /Edge\/(\d+)/.exec(userAgent);
  var ie = ie_upto10 || ie_11up || edge;
  var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : +(edge || ie_11up)[1]);
  var webkit = !edge && /WebKit\//.test(userAgent);
  var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent);
  var chrome = !edge && /Chrome\//.test(userAgent);
  var presto = /Opera\//.test(userAgent);
  var safari = /Apple Computer/.test(navigator.vendor);
  var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent);
  var phantom = /PhantomJS/.test(userAgent);
  var ios = !edge && /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent);
  var android = /Android/.test(userAgent); // This is woefully incomplete. Suggestions for alternative methods welcome.

  var mobile = ios || android || /webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent);
  var mac = ios || /Mac/.test(platform);
  var chromeOS = /\bCrOS\b/.test(userAgent);
  var windows = /win/i.test(platform);
  var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/);

  if (presto_version) {
    presto_version = Number(presto_version[1]);
  }

  if (presto_version && presto_version >= 15) {
    presto = false;
    webkit = true;
  } // Some browsers use the wrong event properties to signal cmd/ctrl on OS X


  var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11));
  var captureRightClick = gecko || ie && ie_version >= 9;

  function classTest(cls) {
    return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*");
  }

  var rmClass = function rmClass(node, cls) {
    var current = node.className;
    var match = classTest(cls).exec(current);

    if (match) {
      var after = current.slice(match.index + match[0].length);
      node.className = current.slice(0, match.index) + (after ? match[1] + after : "");
    }
  };

  function removeChildren(e) {
    for (var count = e.childNodes.length; count > 0; --count) {
      e.removeChild(e.firstChild);
    }

    return e;
  }

  function removeChildrenAndAdd(parent, e) {
    return removeChildren(parent).appendChild(e);
  }

  function elt(tag, content, className, style) {
    var e = document.createElement(tag);

    if (className) {
      e.className = className;
    }

    if (style) {
      e.style.cssText = style;
    }

    if (typeof content == "string") {
      e.appendChild(document.createTextNode(content));
    } else if (content) {
      for (var i = 0; i < content.length; ++i) {
        e.appendChild(content[i]);
      }
    }

    return e;
  } // wrapper for elt, which removes the elt from the accessibility tree


  function eltP(tag, content, className, style) {
    var e = elt(tag, content, className, style);
    e.setAttribute("role", "presentation");
    return e;
  }

  var range;

  if (document.createRange) {
    range = function range(node, start, end, endNode) {
      var r = document.createRange();
      r.setEnd(endNode || node, end);
      r.setStart(node, start);
      return r;
    };
  } else {
    range = function range(node, start, end) {
      var r = document.body.createTextRange();

      try {
        r.moveToElementText(node.parentNode);
      } catch (e) {
        return r;
      }

      r.collapse(true);
      r.moveEnd("character", end);
      r.moveStart("character", start);
      return r;
    };
  }

  function contains(parent, child) {
    if (child.nodeType == 3) // Android browser always returns false when child is a textnode
      {
        child = child.parentNode;
      }

    if (parent.contains) {
      return parent.contains(child);
    }

    do {
      if (child.nodeType == 11) {
        child = child.host;
      }

      if (child == parent) {
        return true;
      }
    } while (child = child.parentNode);
  }

  function activeElt() {
    // IE and Edge may throw an "Unspecified Error" when accessing document.activeElement.
    // IE < 10 will throw when accessed while the page is loading or in an iframe.
    // IE > 9 and Edge will throw when accessed in an iframe if document.body is unavailable.
    var activeElement;

    try {
      activeElement = document.activeElement;
    } catch (e) {
      activeElement = document.body || null;
    }

    while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement) {
      activeElement = activeElement.shadowRoot.activeElement;
    }

    return activeElement;
  }

  function addClass(node, cls) {
    var current = node.className;

    if (!classTest(cls).test(current)) {
      node.className += (current ? " " : "") + cls;
    }
  }

  function joinClasses(a, b) {
    var as = a.split(" ");

    for (var i = 0; i < as.length; i++) {
      if (as[i] && !classTest(as[i]).test(b)) {
        b += " " + as[i];
      }
    }

    return b;
  }

  var selectInput = function selectInput(node) {
    node.select();
  };

  if (ios) // Mobile Safari apparently has a bug where select() is broken.
    {
      selectInput = function selectInput(node) {
        node.selectionStart = 0;
        node.selectionEnd = node.value.length;
      };
    } else if (ie) // Suppress mysterious IE10 errors
    {
      selectInput = function selectInput(node) {
        try {
          node.select();
        } catch (_e) {}
      };
    }

  function bind(f) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function () {
      return f.apply(null, args);
    };
  }

  function copyObj(obj, target, overwrite) {
    if (!target) {
      target = {};
    }

    for (var prop in obj) {
      if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop))) {
        target[prop] = obj[prop];
      }
    }

    return target;
  } // Counts the column offset in a string, taking tabs into account.
  // Used mostly to find indentation.


  function countColumn(string, end, tabSize, startIndex, startValue) {
    if (end == null) {
      end = string.search(/[^\s\u00a0]/);

      if (end == -1) {
        end = string.length;
      }
    }

    for (var i = startIndex || 0, n = startValue || 0;;) {
      var nextTab = string.indexOf("\t", i);

      if (nextTab < 0 || nextTab >= end) {
        return n + (end - i);
      }

      n += nextTab - i;
      n += tabSize - n % tabSize;
      i = nextTab + 1;
    }
  }

  var Delayed = function Delayed() {
    this.id = null;
    this.f = null;
    this.time = 0;
    this.handler = bind(this.onTimeout, this);
  };

  Delayed.prototype.onTimeout = function (self) {
    self.id = 0;

    if (self.time <= +new Date()) {
      self.f();
    } else {
      setTimeout(self.handler, self.time - +new Date());
    }
  };

  Delayed.prototype.set = function (ms, f) {
    this.f = f;
    var time = +new Date() + ms;

    if (!this.id || time < this.time) {
      clearTimeout(this.id);
      this.id = setTimeout(this.handler, ms);
      this.time = time;
    }
  };

  function indexOf(array, elt) {
    for (var i = 0; i < array.length; ++i) {
      if (array[i] == elt) {
        return i;
      }
    }

    return -1;
  } // Number of pixels added to scroller and sizer to hide scrollbar


  var scrollerGap = 30; // Returned or thrown by various protocols to signal 'I'm not
  // handling this'.

  var Pass = {
    toString: function toString() {
      return "CodeMirror.Pass";
    }
  }; // Reused option objects for setSelection & friends

  var sel_dontScroll = {
    scroll: false
  },
      sel_mouse = {
    origin: "*mouse"
  },
      sel_move = {
    origin: "+move"
  }; // The inverse of countColumn -- find the offset that corresponds to
  // a particular column.

  function findColumn(string, goal, tabSize) {
    for (var pos = 0, col = 0;;) {
      var nextTab = string.indexOf("\t", pos);

      if (nextTab == -1) {
        nextTab = string.length;
      }

      var skipped = nextTab - pos;

      if (nextTab == string.length || col + skipped >= goal) {
        return pos + Math.min(skipped, goal - col);
      }

      col += nextTab - pos;
      col += tabSize - col % tabSize;
      pos = nextTab + 1;

      if (col >= goal) {
        return pos;
      }
    }
  }

  var spaceStrs = [""];

  function spaceStr(n) {
    while (spaceStrs.length <= n) {
      spaceStrs.push(lst(spaceStrs) + " ");
    }

    return spaceStrs[n];
  }

  function lst(arr) {
    return arr[arr.length - 1];
  }

  function map(array, f) {
    var out = [];

    for (var i = 0; i < array.length; i++) {
      out[i] = f(array[i], i);
    }

    return out;
  }

  function insertSorted(array, value, score) {
    var pos = 0,
        priority = score(value);

    while (pos < array.length && score(array[pos]) <= priority) {
      pos++;
    }

    array.splice(pos, 0, value);
  }

  function nothing() {}

  function createObj(base, props) {
    var inst;

    if (Object.create) {
      inst = Object.create(base);
    } else {
      nothing.prototype = base;
      inst = new nothing();
    }

    if (props) {
      copyObj(props, inst);
    }

    return inst;
  }

  var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;

  function isWordCharBasic(ch) {
    return /\w/.test(ch) || ch > "\x80" && (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch));
  }

  function isWordChar(ch, helper) {
    if (!helper) {
      return isWordCharBasic(ch);
    }

    if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) {
      return true;
    }

    return helper.test(ch);
  }

  function isEmpty(obj) {
    for (var n in obj) {
      if (obj.hasOwnProperty(n) && obj[n]) {
        return false;
      }
    }

    return true;
  } // Extending unicode characters. A series of a non-extending char +
  // any number of extending chars is treated as a single unit as far
  // as editing and measuring is concerned. This is not fully correct,
  // since some scripts/fonts/browsers also treat other configurations
  // of code points as a group.


  var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;

  function isExtendingChar(ch) {
    return ch.charCodeAt(0) >= 768 && extendingChars.test(ch);
  } // Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.


  function skipExtendingChars(str, pos, dir) {
    while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos))) {
      pos += dir;
    }

    return pos;
  } // Returns the value from the range [`from`; `to`] that satisfies
  // `pred` and is closest to `from`. Assumes that at least `to`
  // satisfies `pred`. Supports `from` being greater than `to`.


  function findFirst(pred, from, to) {
    // At any point we are certain `to` satisfies `pred`, don't know
    // whether `from` does.
    var dir = from > to ? -1 : 1;

    for (;;) {
      if (from == to) {
        return from;
      }

      var midF = (from + to) / 2,
          mid = dir < 0 ? Math.ceil(midF) : Math.floor(midF);

      if (mid == from) {
        return pred(mid) ? from : to;
      }

      if (pred(mid)) {
        to = mid;
      } else {
        from = mid + dir;
      }
    }
  } // BIDI HELPERS


  function iterateBidiSections(order, from, to, f) {
    if (!order) {
      return f(from, to, "ltr", 0);
    }

    var found = false;

    for (var i = 0; i < order.length; ++i) {
      var part = order[i];

      if (part.from < to && part.to > from || from == to && part.to == from) {
        f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr", i);
        found = true;
      }
    }

    if (!found) {
      f(from, to, "ltr");
    }
  }

  var bidiOther = null;

  function getBidiPartAt(order, ch, sticky) {
    var found;
    bidiOther = null;

    for (var i = 0; i < order.length; ++i) {
      var cur = order[i];

      if (cur.from < ch && cur.to > ch) {
        return i;
      }

      if (cur.to == ch) {
        if (cur.from != cur.to && sticky == "before") {
          found = i;
        } else {
          bidiOther = i;
        }
      }

      if (cur.from == ch) {
        if (cur.from != cur.to && sticky != "before") {
          found = i;
        } else {
          bidiOther = i;
        }
      }
    }

    return found != null ? found : bidiOther;
  } // Bidirectional ordering algorithm
  // See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
  // that this (partially) implements.
  // One-char codes used for character types:
  // L (L):   Left-to-Right
  // R (R):   Right-to-Left
  // r (AL):  Right-to-Left Arabic
  // 1 (EN):  European Number
  // + (ES):  European Number Separator
  // % (ET):  European Number Terminator
  // n (AN):  Arabic Number
  // , (CS):  Common Number Separator
  // m (NSM): Non-Spacing Mark
  // b (BN):  Boundary Neutral
  // s (B):   Paragraph Separator
  // t (S):   Segment Separator
  // w (WS):  Whitespace
  // N (ON):  Other Neutrals
  // Returns null if characters are ordered as they appear
  // (left-to-right), or an array of sections ({from, to, level}
  // objects) in the order in which they occur visually.


  var bidiOrdering = function () {
    // Character types for codepoints 0 to 0xff
    var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN"; // Character types for codepoints 0x600 to 0x6f9

    var arabicTypes = "nnnnnnNNr%%r,rNNmmmmmmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmmmnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmnNmmmmmmrrmmNmmmmrr1111111111";

    function charType(code) {
      if (code <= 0xf7) {
        return lowTypes.charAt(code);
      } else if (0x590 <= code && code <= 0x5f4) {
        return "R";
      } else if (0x600 <= code && code <= 0x6f9) {
        return arabicTypes.charAt(code - 0x600);
      } else if (0x6ee <= code && code <= 0x8ac) {
        return "r";
      } else if (0x2000 <= code && code <= 0x200b) {
        return "w";
      } else if (code == 0x200c) {
        return "b";
      } else {
        return "L";
      }
    }

    var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
    var isNeutral = /[stwN]/,
        isStrong = /[LRr]/,
        countsAsLeft = /[Lb1n]/,
        countsAsNum = /[1n]/;

    function BidiSpan(level, from, to) {
      this.level = level;
      this.from = from;
      this.to = to;
    }

    return function (str, direction) {
      var outerType = direction == "ltr" ? "L" : "R";

      if (str.length == 0 || direction == "ltr" && !bidiRE.test(str)) {
        return false;
      }

      var len = str.length,
          types = [];

      for (var i = 0; i < len; ++i) {
        types.push(charType(str.charCodeAt(i)));
      } // W1. Examine each non-spacing mark (NSM) in the level run, and
      // change the type of the NSM to the type of the previous
      // character. If the NSM is at the start of the level run, it will
      // get the type of sor.


      for (var i$1 = 0, prev = outerType; i$1 < len; ++i$1) {
        var type = types[i$1];

        if (type == "m") {
          types[i$1] = prev;
        } else {
          prev = type;
        }
      } // W2. Search backwards from each instance of a European number
      // until the first strong type (R, L, AL, or sor) is found. If an
      // AL is found, change the type of the European number to Arabic
      // number.
      // W3. Change all ALs to R.


      for (var i$2 = 0, cur = outerType; i$2 < len; ++i$2) {
        var type$1 = types[i$2];

        if (type$1 == "1" && cur == "r") {
          types[i$2] = "n";
        } else if (isStrong.test(type$1)) {
          cur = type$1;

          if (type$1 == "r") {
            types[i$2] = "R";
          }
        }
      } // W4. A single European separator between two European numbers
      // changes to a European number. A single common separator between
      // two numbers of the same type changes to that type.


      for (var i$3 = 1, prev$1 = types[0]; i$3 < len - 1; ++i$3) {
        var type$2 = types[i$3];

        if (type$2 == "+" && prev$1 == "1" && types[i$3 + 1] == "1") {
          types[i$3] = "1";
        } else if (type$2 == "," && prev$1 == types[i$3 + 1] && (prev$1 == "1" || prev$1 == "n")) {
          types[i$3] = prev$1;
        }

        prev$1 = type$2;
      } // W5. A sequence of European terminators adjacent to European
      // numbers changes to all European numbers.
      // W6. Otherwise, separators and terminators change to Other
      // Neutral.


      for (var i$4 = 0; i$4 < len; ++i$4) {
        var type$3 = types[i$4];

        if (type$3 == ",") {
          types[i$4] = "N";
        } else if (type$3 == "%") {
          var end = void 0;

          for (end = i$4 + 1; end < len && types[end] == "%"; ++end) {}

          var replace = i$4 && types[i$4 - 1] == "!" || end < len && types[end] == "1" ? "1" : "N";

          for (var j = i$4; j < end; ++j) {
            types[j] = replace;
          }

          i$4 = end - 1;
        }
      } // W7. Search backwards from each instance of a European number
      // until the first strong type (R, L, or sor) is found. If an L is
      // found, then change the type of the European number to L.


      for (var i$5 = 0, cur$1 = outerType; i$5 < len; ++i$5) {
        var type$4 = types[i$5];

        if (cur$1 == "L" && type$4 == "1") {
          types[i$5] = "L";
        } else if (isStrong.test(type$4)) {
          cur$1 = type$4;
        }
      } // N1. A sequence of neutrals takes the direction of the
      // surrounding strong text if the text on both sides has the same
      // direction. European and Arabic numbers act as if they were R in
      // terms of their influence on neutrals. Start-of-level-run (sor)
      // and end-of-level-run (eor) are used at level run boundaries.
      // N2. Any remaining neutrals take the embedding direction.


      for (var i$6 = 0; i$6 < len; ++i$6) {
        if (isNeutral.test(types[i$6])) {
          var end$1 = void 0;

          for (end$1 = i$6 + 1; end$1 < len && isNeutral.test(types[end$1]); ++end$1) {}

          var before = (i$6 ? types[i$6 - 1] : outerType) == "L";
          var after = (end$1 < len ? types[end$1] : outerType) == "L";
          var replace$1 = before == after ? before ? "L" : "R" : outerType;

          for (var j$1 = i$6; j$1 < end$1; ++j$1) {
            types[j$1] = replace$1;
          }

          i$6 = end$1 - 1;
        }
      } // Here we depart from the documented algorithm, in order to avoid
      // building up an actual levels array. Since there are only three
      // levels (0, 1, 2) in an implementation that doesn't take
      // explicit embedding into account, we can build up the order on
      // the fly, without following the level-based algorithm.


      var order = [],
          m;

      for (var i$7 = 0; i$7 < len;) {
        if (countsAsLeft.test(types[i$7])) {
          var start = i$7;

          for (++i$7; i$7 < len && countsAsLeft.test(types[i$7]); ++i$7) {}

          order.push(new BidiSpan(0, start, i$7));
        } else {
          var pos = i$7,
              at = order.length;

          for (++i$7; i$7 < len && types[i$7] != "L"; ++i$7) {}

          for (var j$2 = pos; j$2 < i$7;) {
            if (countsAsNum.test(types[j$2])) {
              if (pos < j$2) {
                order.splice(at, 0, new BidiSpan(1, pos, j$2));
              }

              var nstart = j$2;

              for (++j$2; j$2 < i$7 && countsAsNum.test(types[j$2]); ++j$2) {}

              order.splice(at, 0, new BidiSpan(2, nstart, j$2));
              pos = j$2;
            } else {
              ++j$2;
            }
          }

          if (pos < i$7) {
            order.splice(at, 0, new BidiSpan(1, pos, i$7));
          }
        }
      }

      if (direction == "ltr") {
        if (order[0].level == 1 && (m = str.match(/^\s+/))) {
          order[0].from = m[0].length;
          order.unshift(new BidiSpan(0, 0, m[0].length));
        }

        if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
          lst(order).to -= m[0].length;
          order.push(new BidiSpan(0, len - m[0].length, len));
        }
      }

      return direction == "rtl" ? order.reverse() : order;
    };
  }(); // Get the bidi ordering for the given line (and cache it). Returns
  // false for lines that are fully left-to-right, and an array of
  // BidiSpan objects otherwise.


  function getOrder(line, direction) {
    var order = line.order;

    if (order == null) {
      order = line.order = bidiOrdering(line.text, direction);
    }

    return order;
  } // EVENT HANDLING
  // Lightweight event framework. on/off also work on DOM nodes,
  // registering native DOM handlers.


  var noHandlers = [];

  var on = function on(emitter, type, f) {
    if (emitter.addEventListener) {
      emitter.addEventListener(type, f, false);
    } else if (emitter.attachEvent) {
      emitter.attachEvent("on" + type, f);
    } else {
      var map$$1 = emitter._handlers || (emitter._handlers = {});
      map$$1[type] = (map$$1[type] || noHandlers).concat(f);
    }
  };

  function getHandlers(emitter, type) {
    return emitter._handlers && emitter._handlers[type] || noHandlers;
  }

  function off(emitter, type, f) {
    if (emitter.removeEventListener) {
      emitter.removeEventListener(type, f, false);
    } else if (emitter.detachEvent) {
      emitter.detachEvent("on" + type, f);
    } else {
      var map$$1 = emitter._handlers,
          arr = map$$1 && map$$1[type];

      if (arr) {
        var index = indexOf(arr, f);

        if (index > -1) {
          map$$1[type] = arr.slice(0, index).concat(arr.slice(index + 1));
        }
      }
    }
  }

  function signal(emitter, type
  /*, values...*/
  ) {
    var handlers = getHandlers(emitter, type);

    if (!handlers.length) {
      return;
    }

    var args = Array.prototype.slice.call(arguments, 2);

    for (var i = 0; i < handlers.length; ++i) {
      handlers[i].apply(null, args);
    }
  } // The DOM events that CodeMirror handles can be overridden by
  // registering a (non-DOM) handler on the editor for the event name,
  // and preventDefault-ing the event in that handler.


  function signalDOMEvent(cm, e, override) {
    if (typeof e == "string") {
      e = {
        type: e,
        preventDefault: function preventDefault() {
          this.defaultPrevented = true;
        }
      };
    }

    signal(cm, override || e.type, cm, e);
    return e_defaultPrevented(e) || e.codemirrorIgnore;
  }

  function signalCursorActivity(cm) {
    var arr = cm._handlers && cm._handlers.cursorActivity;

    if (!arr) {
      return;
    }

    var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = []);

    for (var i = 0; i < arr.length; ++i) {
      if (indexOf(set, arr[i]) == -1) {
        set.push(arr[i]);
      }
    }
  }

  function hasHandler(emitter, type) {
    return getHandlers(emitter, type).length > 0;
  } // Add on and off methods to a constructor's prototype, to make
  // registering events on such objects more convenient.


  function eventMixin(ctor) {
    ctor.prototype.on = function (type, f) {
      on(this, type, f);
    };

    ctor.prototype.off = function (type, f) {
      off(this, type, f);
    };
  } // Due to the fact that we still support jurassic IE versions, some
  // compatibility wrappers are needed.


  function e_preventDefault(e) {
    if (e.preventDefault) {
      e.preventDefault();
    } else {
      e.returnValue = false;
    }
  }

  function e_stopPropagation(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    } else {
      e.cancelBubble = true;
    }
  }

  function e_defaultPrevented(e) {
    return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false;
  }

  function e_stop(e) {
    e_preventDefault(e);
    e_stopPropagation(e);
  }

  function e_target(e) {
    return e.target || e.srcElement;
  }

  function e_button(e) {
    var b = e.which;

    if (b == null) {
      if (e.button & 1) {
        b = 1;
      } else if (e.button & 2) {
        b = 3;
      } else if (e.button & 4) {
        b = 2;
      }
    }

    if (mac && e.ctrlKey && b == 1) {
      b = 3;
    }

    return b;
  } // Detect drag-and-drop


  var dragAndDrop = function () {
    // There is *some* kind of drag-and-drop support in IE6-8, but I
    // couldn't get it to work yet.
    if (ie && ie_version < 9) {
      return false;
    }

    var div = elt('div');
    return "draggable" in div || "dragDrop" in div;
  }();

  var zwspSupported;

  function zeroWidthElement(measure) {
    if (zwspSupported == null) {
      var test = elt("span", "\u200B");
      removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]));

      if (measure.firstChild.offsetHeight != 0) {
        zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8);
      }
    }

    var node = zwspSupported ? elt("span", "\u200B") : elt("span", "\xA0", null, "display: inline-block; width: 1px; margin-right: -1px");
    node.setAttribute("cm-text", "");
    return node;
  } // Feature-detect IE's crummy client rect reporting for bidi text


  var badBidiRects;

  function hasBadBidiRects(measure) {
    if (badBidiRects != null) {
      return badBidiRects;
    }

    var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062EA"));
    var r0 = range(txt, 0, 1).getBoundingClientRect();
    var r1 = range(txt, 1, 2).getBoundingClientRect();
    removeChildren(measure);

    if (!r0 || r0.left == r0.right) {
      return false;
    } // Safari returns null in some cases (#2780)


    return badBidiRects = r1.right - r0.right < 3;
  } // See if "".split is the broken IE version, if so, provide an
  // alternative way to split lines.


  var splitLinesAuto = "\n\nb".split(/\n/).length != 3 ? function (string) {
    var pos = 0,
        result = [],
        l = string.length;

    while (pos <= l) {
      var nl = string.indexOf("\n", pos);

      if (nl == -1) {
        nl = string.length;
      }

      var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
      var rt = line.indexOf("\r");

      if (rt != -1) {
        result.push(line.slice(0, rt));
        pos += rt + 1;
      } else {
        result.push(line);
        pos = nl + 1;
      }
    }

    return result;
  } : function (string) {
    return string.split(/\r\n?|\n/);
  };
  var hasSelection = window.getSelection ? function (te) {
    try {
      return te.selectionStart != te.selectionEnd;
    } catch (e) {
      return false;
    }
  } : function (te) {
    var range$$1;

    try {
      range$$1 = te.ownerDocument.selection.createRange();
    } catch (e) {}

    if (!range$$1 || range$$1.parentElement() != te) {
      return false;
    }

    return range$$1.compareEndPoints("StartToEnd", range$$1) != 0;
  };

  var hasCopyEvent = function () {
    var e = elt("div");

    if ("oncopy" in e) {
      return true;
    }

    e.setAttribute("oncopy", "return;");
    return typeof e.oncopy == "function";
  }();

  var badZoomedRects = null;

  function hasBadZoomedRects(measure) {
    if (badZoomedRects != null) {
      return badZoomedRects;
    }

    var node = removeChildrenAndAdd(measure, elt("span", "x"));
    var normal = node.getBoundingClientRect();
    var fromRange = range(node, 0, 1).getBoundingClientRect();
    return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1;
  } // Known modes, by name and by MIME


  var modes = {},
      mimeModes = {}; // Extra arguments are stored as the mode's dependencies, which is
  // used by (legacy) mechanisms like loadmode.js to automatically
  // load a mode. (Preferred mechanism is the require/define calls.)

  function defineMode(name, mode) {
    if (arguments.length > 2) {
      mode.dependencies = Array.prototype.slice.call(arguments, 2);
    }

    modes[name] = mode;
  }

  function defineMIME(mime, spec) {
    mimeModes[mime] = spec;
  } // Given a MIME type, a {name, ...options} config object, or a name
  // string, return a mode config object.


  function resolveMode(spec) {
    if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
      spec = mimeModes[spec];
    } else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
      var found = mimeModes[spec.name];

      if (typeof found == "string") {
        found = {
          name: found
        };
      }

      spec = createObj(found, spec);
      spec.name = found.name;
    } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
      return resolveMode("application/xml");
    } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
      return resolveMode("application/json");
    }

    if (typeof spec == "string") {
      return {
        name: spec
      };
    } else {
      return spec || {
        name: "null"
      };
    }
  } // Given a mode spec (anything that resolveMode accepts), find and
  // initialize an actual mode object.


  function getMode(options, spec) {
    spec = resolveMode(spec);
    var mfactory = modes[spec.name];

    if (!mfactory) {
      return getMode(options, "text/plain");
    }

    var modeObj = mfactory(options, spec);

    if (modeExtensions.hasOwnProperty(spec.name)) {
      var exts = modeExtensions[spec.name];

      for (var prop in exts) {
        if (!exts.hasOwnProperty(prop)) {
          continue;
        }

        if (modeObj.hasOwnProperty(prop)) {
          modeObj["_" + prop] = modeObj[prop];
        }

        modeObj[prop] = exts[prop];
      }
    }

    modeObj.name = spec.name;

    if (spec.helperType) {
      modeObj.helperType = spec.helperType;
    }

    if (spec.modeProps) {
      for (var prop$1 in spec.modeProps) {
        modeObj[prop$1] = spec.modeProps[prop$1];
      }
    }

    return modeObj;
  } // This can be used to attach properties to mode objects from
  // outside the actual mode definition.


  var modeExtensions = {};

  function extendMode(mode, properties) {
    var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : modeExtensions[mode] = {};
    copyObj(properties, exts);
  }

  function copyState(mode, state) {
    if (state === true) {
      return state;
    }

    if (mode.copyState) {
      return mode.copyState(state);
    }

    var nstate = {};

    for (var n in state) {
      var val = state[n];

      if (val instanceof Array) {
        val = val.concat([]);
      }

      nstate[n] = val;
    }

    return nstate;
  } // Given a mode and a state (for that mode), find the inner mode and
  // state at the position that the state refers to.


  function innerMode(mode, state) {
    var info;

    while (mode.innerMode) {
      info = mode.innerMode(state);

      if (!info || info.mode == mode) {
        break;
      }

      state = info.state;
      mode = info.mode;
    }

    return info || {
      mode: mode,
      state: state
    };
  }

  function startState(mode, a1, a2) {
    return mode.startState ? mode.startState(a1, a2) : true;
  } // STRING STREAM
  // Fed to the mode parsers, provides helper functions to make
  // parsers more succinct.


  var StringStream = function StringStream(string, tabSize, lineOracle) {
    this.pos = this.start = 0;
    this.string = string;
    this.tabSize = tabSize || 8;
    this.lastColumnPos = this.lastColumnValue = 0;
    this.lineStart = 0;
    this.lineOracle = lineOracle;
  };

  StringStream.prototype.eol = function () {
    return this.pos >= this.string.length;
  };

  StringStream.prototype.sol = function () {
    return this.pos == this.lineStart;
  };

  StringStream.prototype.peek = function () {
    return this.string.charAt(this.pos) || undefined;
  };

  StringStream.prototype.next = function () {
    if (this.pos < this.string.length) {
      return this.string.charAt(this.pos++);
    }
  };

  StringStream.prototype.eat = function (match) {
    var ch = this.string.charAt(this.pos);
    var ok;

    if (typeof match == "string") {
      ok = ch == match;
    } else {
      ok = ch && (match.test ? match.test(ch) : match(ch));
    }

    if (ok) {
      ++this.pos;
      return ch;
    }
  };

  StringStream.prototype.eatWhile = function (match) {
    var start = this.pos;

    while (this.eat(match)) {}

    return this.pos > start;
  };

  StringStream.prototype.eatSpace = function () {
    var this$1 = this;
    var start = this.pos;

    while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) {
      ++this$1.pos;
    }

    return this.pos > start;
  };

  StringStream.prototype.skipToEnd = function () {
    this.pos = this.string.length;
  };

  StringStream.prototype.skipTo = function (ch) {
    var found = this.string.indexOf(ch, this.pos);

    if (found > -1) {
      this.pos = found;
      return true;
    }
  };

  StringStream.prototype.backUp = function (n) {
    this.pos -= n;
  };

  StringStream.prototype.column = function () {
    if (this.lastColumnPos < this.start) {
      this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
      this.lastColumnPos = this.start;
    }

    return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
  };

  StringStream.prototype.indentation = function () {
    return countColumn(this.string, null, this.tabSize) - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
  };

  StringStream.prototype.match = function (pattern, consume, caseInsensitive) {
    if (typeof pattern == "string") {
      var cased = function cased(str) {
        return caseInsensitive ? str.toLowerCase() : str;
      };

      var substr = this.string.substr(this.pos, pattern.length);

      if (cased(substr) == cased(pattern)) {
        if (consume !== false) {
          this.pos += pattern.length;
        }

        return true;
      }
    } else {
      var match = this.string.slice(this.pos).match(pattern);

      if (match && match.index > 0) {
        return null;
      }

      if (match && consume !== false) {
        this.pos += match[0].length;
      }

      return match;
    }
  };

  StringStream.prototype.current = function () {
    return this.string.slice(this.start, this.pos);
  };

  StringStream.prototype.hideFirstChars = function (n, inner) {
    this.lineStart += n;

    try {
      return inner();
    } finally {
      this.lineStart -= n;
    }
  };

  StringStream.prototype.lookAhead = function (n) {
    var oracle = this.lineOracle;
    return oracle && oracle.lookAhead(n);
  };

  StringStream.prototype.baseToken = function () {
    var oracle = this.lineOracle;
    return oracle && oracle.baseToken(this.pos);
  }; // Find the line object corresponding to the given line number.


  function getLine(doc, n) {
    n -= doc.first;

    if (n < 0 || n >= doc.size) {
      throw new Error("There is no line " + (n + doc.first) + " in the document.");
    }

    var chunk = doc;

    while (!chunk.lines) {
      for (var i = 0;; ++i) {
        var child = chunk.children[i],
            sz = child.chunkSize();

        if (n < sz) {
          chunk = child;
          break;
        }

        n -= sz;
      }
    }

    return chunk.lines[n];
  } // Get the part of a document between two positions, as an array of
  // strings.


  function getBetween(doc, start, end) {
    var out = [],
        n = start.line;
    doc.iter(start.line, end.line + 1, function (line) {
      var text = line.text;

      if (n == end.line) {
        text = text.slice(0, end.ch);
      }

      if (n == start.line) {
        text = text.slice(start.ch);
      }

      out.push(text);
      ++n;
    });
    return out;
  } // Get the lines between from and to, as array of strings.


  function getLines(doc, from, to) {
    var out = [];
    doc.iter(from, to, function (line) {
      out.push(line.text);
    }); // iter aborts when callback returns truthy value

    return out;
  } // Update the height of a line, propagating the height change
  // upwards to parent nodes.


  function updateLineHeight(line, height) {
    var diff = height - line.height;

    if (diff) {
      for (var n = line; n; n = n.parent) {
        n.height += diff;
      }
    }
  } // Given a line object, find its line number by walking up through
  // its parent links.


  function lineNo(line) {
    if (line.parent == null) {
      return null;
    }

    var cur = line.parent,
        no = indexOf(cur.lines, line);

    for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
      for (var i = 0;; ++i) {
        if (chunk.children[i] == cur) {
          break;
        }

        no += chunk.children[i].chunkSize();
      }
    }

    return no + cur.first;
  } // Find the line at the given vertical position, using the height
  // information in the document tree.


  function _lineAtHeight(chunk, h) {
    var n = chunk.first;

    outer: do {
      for (var i$1 = 0; i$1 < chunk.children.length; ++i$1) {
        var child = chunk.children[i$1],
            ch = child.height;

        if (h < ch) {
          chunk = child;
          continue outer;
        }

        h -= ch;
        n += child.chunkSize();
      }

      return n;
    } while (!chunk.lines);

    var i = 0;

    for (; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i],
          lh = line.height;

      if (h < lh) {
        break;
      }

      h -= lh;
    }

    return n + i;
  }

  function isLine(doc, l) {
    return l >= doc.first && l < doc.first + doc.size;
  }

  function lineNumberFor(options, i) {
    return String(options.lineNumberFormatter(i + options.firstLineNumber));
  } // A Pos instance represents a position within the text.


  function Pos(line, ch, sticky) {
    if (sticky === void 0) sticky = null;

    if (!(this instanceof Pos)) {
      return new Pos(line, ch, sticky);
    }

    this.line = line;
    this.ch = ch;
    this.sticky = sticky;
  } // Compare two positions, return 0 if they are the same, a negative
  // number when a is less, and a positive number otherwise.


  function cmp(a, b) {
    return a.line - b.line || a.ch - b.ch;
  }

  function equalCursorPos(a, b) {
    return a.sticky == b.sticky && cmp(a, b) == 0;
  }

  function copyPos(x) {
    return Pos(x.line, x.ch);
  }

  function maxPos(a, b) {
    return cmp(a, b) < 0 ? b : a;
  }

  function minPos(a, b) {
    return cmp(a, b) < 0 ? a : b;
  } // Most of the external API clips given positions to make sure they
  // actually exist within the document.


  function clipLine(doc, n) {
    return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1));
  }

  function _clipPos(doc, pos) {
    if (pos.line < doc.first) {
      return Pos(doc.first, 0);
    }

    var last = doc.first + doc.size - 1;

    if (pos.line > last) {
      return Pos(last, getLine(doc, last).text.length);
    }

    return clipToLen(pos, getLine(doc, pos.line).text.length);
  }

  function clipToLen(pos, linelen) {
    var ch = pos.ch;

    if (ch == null || ch > linelen) {
      return Pos(pos.line, linelen);
    } else if (ch < 0) {
      return Pos(pos.line, 0);
    } else {
      return pos;
    }
  }

  function clipPosArray(doc, array) {
    var out = [];

    for (var i = 0; i < array.length; i++) {
      out[i] = _clipPos(doc, array[i]);
    }

    return out;
  }

  var SavedContext = function SavedContext(state, lookAhead) {
    this.state = state;
    this.lookAhead = lookAhead;
  };

  var Context = function Context(doc, state, line, lookAhead) {
    this.state = state;
    this.doc = doc;
    this.line = line;
    this.maxLookAhead = lookAhead || 0;
    this.baseTokens = null;
    this.baseTokenPos = 1;
  };

  Context.prototype.lookAhead = function (n) {
    var line = this.doc.getLine(this.line + n);

    if (line != null && n > this.maxLookAhead) {
      this.maxLookAhead = n;
    }

    return line;
  };

  Context.prototype.baseToken = function (n) {
    var this$1 = this;

    if (!this.baseTokens) {
      return null;
    }

    while (this.baseTokens[this.baseTokenPos] <= n) {
      this$1.baseTokenPos += 2;
    }

    var type = this.baseTokens[this.baseTokenPos + 1];
    return {
      type: type && type.replace(/( |^)overlay .*/, ""),
      size: this.baseTokens[this.baseTokenPos] - n
    };
  };

  Context.prototype.nextLine = function () {
    this.line++;

    if (this.maxLookAhead > 0) {
      this.maxLookAhead--;
    }
  };

  Context.fromSaved = function (doc, saved, line) {
    if (saved instanceof SavedContext) {
      return new Context(doc, copyState(doc.mode, saved.state), line, saved.lookAhead);
    } else {
      return new Context(doc, copyState(doc.mode, saved), line);
    }
  };

  Context.prototype.save = function (copy) {
    var state = copy !== false ? copyState(this.doc.mode, this.state) : this.state;
    return this.maxLookAhead > 0 ? new SavedContext(state, this.maxLookAhead) : state;
  }; // Compute a style array (an array starting with a mode generation
  // -- for invalidation -- followed by pairs of end positions and
  // style strings), which is used to highlight the tokens on the
  // line.


  function highlightLine(cm, line, context, forceToEnd) {
    // A styles array always starts with a number identifying the
    // mode/overlays that it is based on (for easy invalidation).
    var st = [cm.state.modeGen],
        lineClasses = {}; // Compute the base array of styles

    runMode(cm, line.text, cm.doc.mode, context, function (end, style) {
      return st.push(end, style);
    }, lineClasses, forceToEnd);
    var state = context.state; // Run overlays, adjust style array.

    var loop = function loop(o) {
      context.baseTokens = st;
      var overlay = cm.state.overlays[o],
          i = 1,
          at = 0;
      context.state = true;
      runMode(cm, line.text, overlay.mode, context, function (end, style) {
        var start = i; // Ensure there's a token end at the current position, and that i points at it

        while (at < end) {
          var i_end = st[i];

          if (i_end > end) {
            st.splice(i, 1, end, st[i + 1], i_end);
          }

          i += 2;
          at = Math.min(end, i_end);
        }

        if (!style) {
          return;
        }

        if (overlay.opaque) {
          st.splice(start, i - start, end, "overlay " + style);
          i = start + 2;
        } else {
          for (; start < i; start += 2) {
            var cur = st[start + 1];
            st[start + 1] = (cur ? cur + " " : "") + "overlay " + style;
          }
        }
      }, lineClasses);
      context.state = state;
      context.baseTokens = null;
      context.baseTokenPos = 1;
    };

    for (var o = 0; o < cm.state.overlays.length; ++o) {
      loop(o);
    }

    return {
      styles: st,
      classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null
    };
  }

  function getLineStyles(cm, line, updateFrontier) {
    if (!line.styles || line.styles[0] != cm.state.modeGen) {
      var context = getContextBefore(cm, lineNo(line));
      var resetState = line.text.length > cm.options.maxHighlightLength && copyState(cm.doc.mode, context.state);
      var result = highlightLine(cm, line, context);

      if (resetState) {
        context.state = resetState;
      }

      line.stateAfter = context.save(!resetState);
      line.styles = result.styles;

      if (result.classes) {
        line.styleClasses = result.classes;
      } else if (line.styleClasses) {
        line.styleClasses = null;
      }

      if (updateFrontier === cm.doc.highlightFrontier) {
        cm.doc.modeFrontier = Math.max(cm.doc.modeFrontier, ++cm.doc.highlightFrontier);
      }
    }

    return line.styles;
  }

  function getContextBefore(cm, n, precise) {
    var doc = cm.doc,
        display = cm.display;

    if (!doc.mode.startState) {
      return new Context(doc, true, n);
    }

    var start = findStartLine(cm, n, precise);
    var saved = start > doc.first && getLine(doc, start - 1).stateAfter;
    var context = saved ? Context.fromSaved(doc, saved, start) : new Context(doc, startState(doc.mode), start);
    doc.iter(start, n, function (line) {
      processLine(cm, line.text, context);
      var pos = context.line;
      line.stateAfter = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo ? context.save() : null;
      context.nextLine();
    });

    if (precise) {
      doc.modeFrontier = context.line;
    }

    return context;
  } // Lightweight form of highlight -- proceed over this line and
  // update state, but don't save a style array. Used for lines that
  // aren't currently visible.


  function processLine(cm, text, context, startAt) {
    var mode = cm.doc.mode;
    var stream = new StringStream(text, cm.options.tabSize, context);
    stream.start = stream.pos = startAt || 0;

    if (text == "") {
      callBlankLine(mode, context.state);
    }

    while (!stream.eol()) {
      readToken(mode, stream, context.state);
      stream.start = stream.pos;
    }
  }

  function callBlankLine(mode, state) {
    if (mode.blankLine) {
      return mode.blankLine(state);
    }

    if (!mode.innerMode) {
      return;
    }

    var inner = innerMode(mode, state);

    if (inner.mode.blankLine) {
      return inner.mode.blankLine(inner.state);
    }
  }

  function readToken(mode, stream, state, inner) {
    for (var i = 0; i < 10; i++) {
      if (inner) {
        inner[0] = innerMode(mode, state).mode;
      }

      var style = mode.token(stream, state);

      if (stream.pos > stream.start) {
        return style;
      }
    }

    throw new Error("Mode " + mode.name + " failed to advance stream.");
  }

  var Token = function Token(stream, type, state) {
    this.start = stream.start;
    this.end = stream.pos;
    this.string = stream.current();
    this.type = type || null;
    this.state = state;
  }; // Utility for getTokenAt and getLineTokens


  function takeToken(cm, pos, precise, asArray) {
    var doc = cm.doc,
        mode = doc.mode,
        style;
    pos = _clipPos(doc, pos);
    var line = getLine(doc, pos.line),
        context = getContextBefore(cm, pos.line, precise);
    var stream = new StringStream(line.text, cm.options.tabSize, context),
        tokens;

    if (asArray) {
      tokens = [];
    }

    while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
      stream.start = stream.pos;
      style = readToken(mode, stream, context.state);

      if (asArray) {
        tokens.push(new Token(stream, style, copyState(doc.mode, context.state)));
      }
    }

    return asArray ? tokens : new Token(stream, style, context.state);
  }

  function extractLineClasses(type, output) {
    if (type) {
      for (;;) {
        var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/);

        if (!lineClass) {
          break;
        }

        type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length);
        var prop = lineClass[1] ? "bgClass" : "textClass";

        if (output[prop] == null) {
          output[prop] = lineClass[2];
        } else if (!new RegExp("(?:^|\s)" + lineClass[2] + "(?:$|\s)").test(output[prop])) {
          output[prop] += " " + lineClass[2];
        }
      }
    }

    return type;
  } // Run the given mode's parser over a line, calling f for each token.


  function runMode(cm, text, mode, context, f, lineClasses, forceToEnd) {
    var flattenSpans = mode.flattenSpans;

    if (flattenSpans == null) {
      flattenSpans = cm.options.flattenSpans;
    }

    var curStart = 0,
        curStyle = null;
    var stream = new StringStream(text, cm.options.tabSize, context),
        style;
    var inner = cm.options.addModeClass && [null];

    if (text == "") {
      extractLineClasses(callBlankLine(mode, context.state), lineClasses);
    }

    while (!stream.eol()) {
      if (stream.pos > cm.options.maxHighlightLength) {
        flattenSpans = false;

        if (forceToEnd) {
          processLine(cm, text, context, stream.pos);
        }

        stream.pos = text.length;
        style = null;
      } else {
        style = extractLineClasses(readToken(mode, stream, context.state, inner), lineClasses);
      }

      if (inner) {
        var mName = inner[0].name;

        if (mName) {
          style = "m-" + (style ? mName + " " + style : mName);
        }
      }

      if (!flattenSpans || curStyle != style) {
        while (curStart < stream.start) {
          curStart = Math.min(stream.start, curStart + 5000);
          f(curStart, curStyle);
        }

        curStyle = style;
      }

      stream.start = stream.pos;
    }

    while (curStart < stream.pos) {
      // Webkit seems to refuse to render text nodes longer than 57444
      // characters, and returns inaccurate measurements in nodes
      // starting around 5000 chars.
      var pos = Math.min(stream.pos, curStart + 5000);
      f(pos, curStyle);
      curStart = pos;
    }
  } // Finds the line to start with when starting a parse. Tries to
  // find a line with a stateAfter, so that it can start with a
  // valid state. If that fails, it returns the line with the
  // smallest indentation, which tends to need the least context to
  // parse correctly.


  function findStartLine(cm, n, precise) {
    var minindent,
        minline,
        doc = cm.doc;
    var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100);

    for (var search = n; search > lim; --search) {
      if (search <= doc.first) {
        return doc.first;
      }

      var line = getLine(doc, search - 1),
          after = line.stateAfter;

      if (after && (!precise || search + (after instanceof SavedContext ? after.lookAhead : 0) <= doc.modeFrontier)) {
        return search;
      }

      var indented = countColumn(line.text, null, cm.options.tabSize);

      if (minline == null || minindent > indented) {
        minline = search - 1;
        minindent = indented;
      }
    }

    return minline;
  }

  function retreatFrontier(doc, n) {
    doc.modeFrontier = Math.min(doc.modeFrontier, n);

    if (doc.highlightFrontier < n - 10) {
      return;
    }

    var start = doc.first;

    for (var line = n - 1; line > start; line--) {
      var saved = getLine(doc, line).stateAfter; // change is on 3
      // state on line 1 looked ahead 2 -- so saw 3
      // test 1 + 2 < 3 should cover this

      if (saved && (!(saved instanceof SavedContext) || line + saved.lookAhead < n)) {
        start = line + 1;
        break;
      }
    }

    doc.highlightFrontier = Math.min(doc.highlightFrontier, start);
  } // Optimize some code when these features are not used.


  var sawReadOnlySpans = false,
      sawCollapsedSpans = false;

  function seeReadOnlySpans() {
    sawReadOnlySpans = true;
  }

  function seeCollapsedSpans() {
    sawCollapsedSpans = true;
  } // TEXTMARKER SPANS


  function MarkedSpan(marker, from, to) {
    this.marker = marker;
    this.from = from;
    this.to = to;
  } // Search an array of spans for a span matching the given marker.


  function getMarkedSpanFor(spans, marker) {
    if (spans) {
      for (var i = 0; i < spans.length; ++i) {
        var span = spans[i];

        if (span.marker == marker) {
          return span;
        }
      }
    }
  } // Remove a span from an array, returning undefined if no spans are
  // left (we don't store arrays for lines without spans).


  function removeMarkedSpan(spans, span) {
    var r;

    for (var i = 0; i < spans.length; ++i) {
      if (spans[i] != span) {
        (r || (r = [])).push(spans[i]);
      }
    }

    return r;
  } // Add a span to a line.


  function addMarkedSpan(line, span) {
    line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span];
    span.marker.attachLine(line);
  } // Used for the algorithm that adjusts markers for a change in the
  // document. These functions cut an array of spans at a given
  // character position, returning an array of remaining chunks (or
  // undefined if nothing remains).


  function markedSpansBefore(old, startCh, isInsert) {
    var nw;

    if (old) {
      for (var i = 0; i < old.length; ++i) {
        var span = old[i],
            marker = span.marker;
        var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);

        if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
          var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh);
          (nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to));
        }
      }
    }

    return nw;
  }

  function markedSpansAfter(old, endCh, isInsert) {
    var nw;

    if (old) {
      for (var i = 0; i < old.length; ++i) {
        var span = old[i],
            marker = span.marker;
        var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);

        if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
          var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh);
          (nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh, span.to == null ? null : span.to - endCh));
        }
      }
    }

    return nw;
  } // Given a change object, compute the new set of marker spans that
  // cover the line in which the change took place. Removes spans
  // entirely within the change, reconnects spans belonging to the
  // same marker that appear on both sides of the change, and cuts off
  // spans partially within the change. Returns an array of span
  // arrays with one element for each line in (after) the change.


  function stretchSpansOverChange(doc, change) {
    if (change.full) {
      return null;
    }

    var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans;
    var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans;

    if (!oldFirst && !oldLast) {
      return null;
    }

    var startCh = change.from.ch,
        endCh = change.to.ch,
        isInsert = cmp(change.from, change.to) == 0; // Get the spans that 'stick out' on both sides

    var first = markedSpansBefore(oldFirst, startCh, isInsert);
    var last = markedSpansAfter(oldLast, endCh, isInsert); // Next, merge those two ends

    var sameLine = change.text.length == 1,
        offset = lst(change.text).length + (sameLine ? startCh : 0);

    if (first) {
      // Fix up .to properties of first
      for (var i = 0; i < first.length; ++i) {
        var span = first[i];

        if (span.to == null) {
          var found = getMarkedSpanFor(last, span.marker);

          if (!found) {
            span.to = startCh;
          } else if (sameLine) {
            span.to = found.to == null ? null : found.to + offset;
          }
        }
      }
    }

    if (last) {
      // Fix up .from in last (or move them into first in case of sameLine)
      for (var i$1 = 0; i$1 < last.length; ++i$1) {
        var span$1 = last[i$1];

        if (span$1.to != null) {
          span$1.to += offset;
        }

        if (span$1.from == null) {
          var found$1 = getMarkedSpanFor(first, span$1.marker);

          if (!found$1) {
            span$1.from = offset;

            if (sameLine) {
              (first || (first = [])).push(span$1);
            }
          }
        } else {
          span$1.from += offset;

          if (sameLine) {
            (first || (first = [])).push(span$1);
          }
        }
      }
    } // Make sure we didn't create any zero-length spans


    if (first) {
      first = clearEmptySpans(first);
    }

    if (last && last != first) {
      last = clearEmptySpans(last);
    }

    var newMarkers = [first];

    if (!sameLine) {
      // Fill gap with whole-line-spans
      var gap = change.text.length - 2,
          gapMarkers;

      if (gap > 0 && first) {
        for (var i$2 = 0; i$2 < first.length; ++i$2) {
          if (first[i$2].to == null) {
            (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i$2].marker, null, null));
          }
        }
      }

      for (var i$3 = 0; i$3 < gap; ++i$3) {
        newMarkers.push(gapMarkers);
      }

      newMarkers.push(last);
    }

    return newMarkers;
  } // Remove spans that are empty and don't have a clearWhenEmpty
  // option of false.


  function clearEmptySpans(spans) {
    for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];

      if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false) {
        spans.splice(i--, 1);
      }
    }

    if (!spans.length) {
      return null;
    }

    return spans;
  } // Used to 'clip' out readOnly ranges when making a change.


  function removeReadOnlyRanges(doc, from, to) {
    var markers = null;
    doc.iter(from.line, to.line + 1, function (line) {
      if (line.markedSpans) {
        for (var i = 0; i < line.markedSpans.length; ++i) {
          var mark = line.markedSpans[i].marker;

          if (mark.readOnly && (!markers || indexOf(markers, mark) == -1)) {
            (markers || (markers = [])).push(mark);
          }
        }
      }
    });

    if (!markers) {
      return null;
    }

    var parts = [{
      from: from,
      to: to
    }];

    for (var i = 0; i < markers.length; ++i) {
      var mk = markers[i],
          m = mk.find(0);

      for (var j = 0; j < parts.length; ++j) {
        var p = parts[j];

        if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) {
          continue;
        }

        var newParts = [j, 1],
            dfrom = cmp(p.from, m.from),
            dto = cmp(p.to, m.to);

        if (dfrom < 0 || !mk.inclusiveLeft && !dfrom) {
          newParts.push({
            from: p.from,
            to: m.from
          });
        }

        if (dto > 0 || !mk.inclusiveRight && !dto) {
          newParts.push({
            from: m.to,
            to: p.to
          });
        }

        parts.splice.apply(parts, newParts);
        j += newParts.length - 3;
      }
    }

    return parts;
  } // Connect or disconnect spans from a line.


  function detachMarkedSpans(line) {
    var spans = line.markedSpans;

    if (!spans) {
      return;
    }

    for (var i = 0; i < spans.length; ++i) {
      spans[i].marker.detachLine(line);
    }

    line.markedSpans = null;
  }

  function attachMarkedSpans(line, spans) {
    if (!spans) {
      return;
    }

    for (var i = 0; i < spans.length; ++i) {
      spans[i].marker.attachLine(line);
    }

    line.markedSpans = spans;
  } // Helpers used when computing which overlapping collapsed span
  // counts as the larger one.


  function extraLeft(marker) {
    return marker.inclusiveLeft ? -1 : 0;
  }

  function extraRight(marker) {
    return marker.inclusiveRight ? 1 : 0;
  } // Returns a number indicating which of two overlapping collapsed
  // spans is larger (and thus includes the other). Falls back to
  // comparing ids when the spans cover exactly the same range.


  function compareCollapsedMarkers(a, b) {
    var lenDiff = a.lines.length - b.lines.length;

    if (lenDiff != 0) {
      return lenDiff;
    }

    var aPos = a.find(),
        bPos = b.find();
    var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b);

    if (fromCmp) {
      return -fromCmp;
    }

    var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b);

    if (toCmp) {
      return toCmp;
    }

    return b.id - a.id;
  } // Find out whether a line ends or starts in a collapsed span. If
  // so, return the marker for that span.


  function collapsedSpanAtSide(line, start) {
    var sps = sawCollapsedSpans && line.markedSpans,
        found;

    if (sps) {
      for (var sp = void 0, i = 0; i < sps.length; ++i) {
        sp = sps[i];

        if (sp.marker.collapsed && (start ? sp.from : sp.to) == null && (!found || compareCollapsedMarkers(found, sp.marker) < 0)) {
          found = sp.marker;
        }
      }
    }

    return found;
  }

  function collapsedSpanAtStart(line) {
    return collapsedSpanAtSide(line, true);
  }

  function collapsedSpanAtEnd(line) {
    return collapsedSpanAtSide(line, false);
  }

  function collapsedSpanAround(line, ch) {
    var sps = sawCollapsedSpans && line.markedSpans,
        found;

    if (sps) {
      for (var i = 0; i < sps.length; ++i) {
        var sp = sps[i];

        if (sp.marker.collapsed && (sp.from == null || sp.from < ch) && (sp.to == null || sp.to > ch) && (!found || compareCollapsedMarkers(found, sp.marker) < 0)) {
          found = sp.marker;
        }
      }
    }

    return found;
  } // Test whether there exists a collapsed span that partially
  // overlaps (covers the start or end, but not both) of a new span.
  // Such overlap is not allowed.


  function conflictingCollapsedRange(doc, lineNo$$1, from, to, marker) {
    var line = getLine(doc, lineNo$$1);
    var sps = sawCollapsedSpans && line.markedSpans;

    if (sps) {
      for (var i = 0; i < sps.length; ++i) {
        var sp = sps[i];

        if (!sp.marker.collapsed) {
          continue;
        }

        var found = sp.marker.find(0);
        var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker);
        var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker);

        if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) {
          continue;
        }

        if (fromCmp <= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.to, from) >= 0 : cmp(found.to, from) > 0) || fromCmp >= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.from, to) <= 0 : cmp(found.from, to) < 0)) {
          return true;
        }
      }
    }
  } // A visual line is a line as drawn on the screen. Folding, for
  // example, can cause multiple logical lines to appear on the same
  // visual line. This finds the start of the visual line that the
  // given line is part of (usually that is the line itself).


  function visualLine(line) {
    var merged;

    while (merged = collapsedSpanAtStart(line)) {
      line = merged.find(-1, true).line;
    }

    return line;
  }

  function visualLineEnd(line) {
    var merged;

    while (merged = collapsedSpanAtEnd(line)) {
      line = merged.find(1, true).line;
    }

    return line;
  } // Returns an array of logical lines that continue the visual line
  // started by the argument, or undefined if there are no such lines.


  function visualLineContinued(line) {
    var merged, lines;

    while (merged = collapsedSpanAtEnd(line)) {
      line = merged.find(1, true).line;
      (lines || (lines = [])).push(line);
    }

    return lines;
  } // Get the line number of the start of the visual line that the
  // given line number is part of.


  function visualLineNo(doc, lineN) {
    var line = getLine(doc, lineN),
        vis = visualLine(line);

    if (line == vis) {
      return lineN;
    }

    return lineNo(vis);
  } // Get the line number of the start of the next visual line after
  // the given line.


  function visualLineEndNo(doc, lineN) {
    if (lineN > doc.lastLine()) {
      return lineN;
    }

    var line = getLine(doc, lineN),
        merged;

    if (!lineIsHidden(doc, line)) {
      return lineN;
    }

    while (merged = collapsedSpanAtEnd(line)) {
      line = merged.find(1, true).line;
    }

    return lineNo(line) + 1;
  } // Compute whether a line is hidden. Lines count as hidden when they
  // are part of a visual line that starts with another line, or when
  // they are entirely covered by collapsed, non-widget span.


  function lineIsHidden(doc, line) {
    var sps = sawCollapsedSpans && line.markedSpans;

    if (sps) {
      for (var sp = void 0, i = 0; i < sps.length; ++i) {
        sp = sps[i];

        if (!sp.marker.collapsed) {
          continue;
        }

        if (sp.from == null) {
          return true;
        }

        if (sp.marker.widgetNode) {
          continue;
        }

        if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp)) {
          return true;
        }
      }
    }
  }

  function lineIsHiddenInner(doc, line, span) {
    if (span.to == null) {
      var end = span.marker.find(1, true);
      return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker));
    }

    if (span.marker.inclusiveRight && span.to == line.text.length) {
      return true;
    }

    for (var sp = void 0, i = 0; i < line.markedSpans.length; ++i) {
      sp = line.markedSpans[i];

      if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to && (sp.to == null || sp.to != span.from) && (sp.marker.inclusiveLeft || span.marker.inclusiveRight) && lineIsHiddenInner(doc, line, sp)) {
        return true;
      }
    }
  } // Find the height above the given line.


  function _heightAtLine(lineObj) {
    lineObj = visualLine(lineObj);
    var h = 0,
        chunk = lineObj.parent;

    for (var i = 0; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i];

      if (line == lineObj) {
        break;
      } else {
        h += line.height;
      }
    }

    for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
      for (var i$1 = 0; i$1 < p.children.length; ++i$1) {
        var cur = p.children[i$1];

        if (cur == chunk) {
          break;
        } else {
          h += cur.height;
        }
      }
    }

    return h;
  } // Compute the character length of a line, taking into account
  // collapsed ranges (see markText) that might hide parts, and join
  // other lines onto it.


  function lineLength(line) {
    if (line.height == 0) {
      return 0;
    }

    var len = line.text.length,
        merged,
        cur = line;

    while (merged = collapsedSpanAtStart(cur)) {
      var found = merged.find(0, true);
      cur = found.from.line;
      len += found.from.ch - found.to.ch;
    }

    cur = line;

    while (merged = collapsedSpanAtEnd(cur)) {
      var found$1 = merged.find(0, true);
      len -= cur.text.length - found$1.from.ch;
      cur = found$1.to.line;
      len += cur.text.length - found$1.to.ch;
    }

    return len;
  } // Find the longest line in the document.


  function findMaxLine(cm) {
    var d = cm.display,
        doc = cm.doc;
    d.maxLine = getLine(doc, doc.first);
    d.maxLineLength = lineLength(d.maxLine);
    d.maxLineChanged = true;
    doc.iter(function (line) {
      var len = lineLength(line);

      if (len > d.maxLineLength) {
        d.maxLineLength = len;
        d.maxLine = line;
      }
    });
  } // LINE DATA STRUCTURE
  // Line objects. These hold state related to a line, including
  // highlighting info (the styles array).


  var Line = function Line(text, markedSpans, estimateHeight) {
    this.text = text;
    attachMarkedSpans(this, markedSpans);
    this.height = estimateHeight ? estimateHeight(this) : 1;
  };

  Line.prototype.lineNo = function () {
    return lineNo(this);
  };

  eventMixin(Line); // Change the content (text, markers) of a line. Automatically
  // invalidates cached information and tries to re-estimate the
  // line's height.

  function updateLine(line, text, markedSpans, estimateHeight) {
    line.text = text;

    if (line.stateAfter) {
      line.stateAfter = null;
    }

    if (line.styles) {
      line.styles = null;
    }

    if (line.order != null) {
      line.order = null;
    }

    detachMarkedSpans(line);
    attachMarkedSpans(line, markedSpans);
    var estHeight = estimateHeight ? estimateHeight(line) : 1;

    if (estHeight != line.height) {
      updateLineHeight(line, estHeight);
    }
  } // Detach a line from the document tree and its markers.


  function cleanUpLine(line) {
    line.parent = null;
    detachMarkedSpans(line);
  } // Convert a style as returned by a mode (either null, or a string
  // containing one or more styles) to a CSS style. This is cached,
  // and also looks for line-wide styles.


  var styleToClassCache = {},
      styleToClassCacheWithMode = {};

  function interpretTokenStyle(style, options) {
    if (!style || /^\s*$/.test(style)) {
      return null;
    }

    var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache;
    return cache[style] || (cache[style] = style.replace(/\S+/g, "cm-$&"));
  } // Render the DOM representation of the text of a line. Also builds
  // up a 'line map', which points at the DOM nodes that represent
  // specific stretches of text, and is used by the measuring code.
  // The returned object contains the DOM node, this map, and
  // information about line-wide styles that were set by the mode.


  function buildLineContent(cm, lineView) {
    // The padding-right forces the element to have a 'border', which
    // is needed on Webkit to be able to get line-level bounding
    // rectangles for it (in measureChar).
    var content = eltP("span", null, null, webkit ? "padding-right: .1px" : null);
    var builder = {
      pre: eltP("pre", [content], "CodeMirror-line"),
      content: content,
      col: 0,
      pos: 0,
      cm: cm,
      trailingSpace: false,
      splitSpaces: cm.getOption("lineWrapping")
    };
    lineView.measure = {}; // Iterate over the logical lines that make up this visual line.

    for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
      var line = i ? lineView.rest[i - 1] : lineView.line,
          order = void 0;
      builder.pos = 0;
      builder.addToken = buildToken; // Optionally wire in some hacks into the token-rendering
      // algorithm, to deal with browser quirks.

      if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line, cm.doc.direction))) {
        builder.addToken = buildTokenBadBidi(builder.addToken, order);
      }

      builder.map = [];
      var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line);
      insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate));

      if (line.styleClasses) {
        if (line.styleClasses.bgClass) {
          builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || "");
        }

        if (line.styleClasses.textClass) {
          builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || "");
        }
      } // Ensure at least a single node is present, for measuring.


      if (builder.map.length == 0) {
        builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure)));
      } // Store the map and a cache object for the current logical line


      if (i == 0) {
        lineView.measure.map = builder.map;
        lineView.measure.cache = {};
      } else {
        (lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map);
        (lineView.measure.caches || (lineView.measure.caches = [])).push({});
      }
    } // See issue #2901


    if (webkit) {
      var last = builder.content.lastChild;

      if (/\bcm-tab\b/.test(last.className) || last.querySelector && last.querySelector(".cm-tab")) {
        builder.content.className = "cm-tab-wrap-hack";
      }
    }

    signal(cm, "renderLine", cm, lineView.line, builder.pre);

    if (builder.pre.className) {
      builder.textClass = joinClasses(builder.pre.className, builder.textClass || "");
    }

    return builder;
  }

  function defaultSpecialCharPlaceholder(ch) {
    var token = elt("span", "\u2022", "cm-invalidchar");
    token.title = "\\u" + ch.charCodeAt(0).toString(16);
    token.setAttribute("aria-label", token.title);
    return token;
  } // Build up the DOM representation for a single token, and add it to
  // the line map. Takes care to render special characters separately.


  function buildToken(builder, text, style, startStyle, endStyle, css, attributes) {
    if (!text) {
      return;
    }

    var displayText = builder.splitSpaces ? splitSpaces(text, builder.trailingSpace) : text;
    var special = builder.cm.state.specialChars,
        mustWrap = false;
    var content;

    if (!special.test(text)) {
      builder.col += text.length;
      content = document.createTextNode(displayText);
      builder.map.push(builder.pos, builder.pos + text.length, content);

      if (ie && ie_version < 9) {
        mustWrap = true;
      }

      builder.pos += text.length;
    } else {
      content = document.createDocumentFragment();
      var pos = 0;

      while (true) {
        special.lastIndex = pos;
        var m = special.exec(text);
        var skipped = m ? m.index - pos : text.length - pos;

        if (skipped) {
          var txt = document.createTextNode(displayText.slice(pos, pos + skipped));

          if (ie && ie_version < 9) {
            content.appendChild(elt("span", [txt]));
          } else {
            content.appendChild(txt);
          }

          builder.map.push(builder.pos, builder.pos + skipped, txt);
          builder.col += skipped;
          builder.pos += skipped;
        }

        if (!m) {
          break;
        }

        pos += skipped + 1;
        var txt$1 = void 0;

        if (m[0] == "\t") {
          var tabSize = builder.cm.options.tabSize,
              tabWidth = tabSize - builder.col % tabSize;
          txt$1 = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
          txt$1.setAttribute("role", "presentation");
          txt$1.setAttribute("cm-text", "\t");
          builder.col += tabWidth;
        } else if (m[0] == "\r" || m[0] == "\n") {
          txt$1 = content.appendChild(elt("span", m[0] == "\r" ? "\u240D" : "\u2424", "cm-invalidchar"));
          txt$1.setAttribute("cm-text", m[0]);
          builder.col += 1;
        } else {
          txt$1 = builder.cm.options.specialCharPlaceholder(m[0]);
          txt$1.setAttribute("cm-text", m[0]);

          if (ie && ie_version < 9) {
            content.appendChild(elt("span", [txt$1]));
          } else {
            content.appendChild(txt$1);
          }

          builder.col += 1;
        }

        builder.map.push(builder.pos, builder.pos + 1, txt$1);
        builder.pos++;
      }
    }

    builder.trailingSpace = displayText.charCodeAt(text.length - 1) == 32;

    if (style || startStyle || endStyle || mustWrap || css) {
      var fullStyle = style || "";

      if (startStyle) {
        fullStyle += startStyle;
      }

      if (endStyle) {
        fullStyle += endStyle;
      }

      var token = elt("span", [content], fullStyle, css);

      if (attributes) {
        for (var attr in attributes) {
          if (attributes.hasOwnProperty(attr) && attr != "style" && attr != "class") {
            token.setAttribute(attr, attributes[attr]);
          }
        }
      }

      return builder.content.appendChild(token);
    }

    builder.content.appendChild(content);
  } // Change some spaces to NBSP to prevent the browser from collapsing
  // trailing spaces at the end of a line when rendering text (issue #1362).


  function splitSpaces(text, trailingBefore) {
    if (text.length > 1 && !/  /.test(text)) {
      return text;
    }

    var spaceBefore = trailingBefore,
        result = "";

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);

      if (ch == " " && spaceBefore && (i == text.length - 1 || text.charCodeAt(i + 1) == 32)) {
        ch = "\xA0";
      }

      result += ch;
      spaceBefore = ch == " ";
    }

    return result;
  } // Work around nonsense dimensions being reported for stretches of
  // right-to-left text.


  function buildTokenBadBidi(inner, order) {
    return function (builder, text, style, startStyle, endStyle, css, attributes) {
      style = style ? style + " cm-force-border" : "cm-force-border";
      var start = builder.pos,
          end = start + text.length;

      for (;;) {
        // Find the part that overlaps with the start of this text
        var part = void 0;

        for (var i = 0; i < order.length; i++) {
          part = order[i];

          if (part.to > start && part.from <= start) {
            break;
          }
        }

        if (part.to >= end) {
          return inner(builder, text, style, startStyle, endStyle, css, attributes);
        }

        inner(builder, text.slice(0, part.to - start), style, startStyle, null, css, attributes);
        startStyle = null;
        text = text.slice(part.to - start);
        start = part.to;
      }
    };
  }

  function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
    var widget = !ignoreWidget && marker.widgetNode;

    if (widget) {
      builder.map.push(builder.pos, builder.pos + size, widget);
    }

    if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
      if (!widget) {
        widget = builder.content.appendChild(document.createElement("span"));
      }

      widget.setAttribute("cm-marker", marker.id);
    }

    if (widget) {
      builder.cm.display.input.setUneditable(widget);
      builder.content.appendChild(widget);
    }

    builder.pos += size;
    builder.trailingSpace = false;
  } // Outputs a number of spans to make up a line, taking highlighting
  // and marked text into account.


  function insertLineContent(line, builder, styles) {
    var spans = line.markedSpans,
        allText = line.text,
        at = 0;

    if (!spans) {
      for (var i$1 = 1; i$1 < styles.length; i$1 += 2) {
        builder.addToken(builder, allText.slice(at, at = styles[i$1]), interpretTokenStyle(styles[i$1 + 1], builder.cm.options));
      }

      return;
    }

    var len = allText.length,
        pos = 0,
        i = 1,
        text = "",
        style,
        css;
    var nextChange = 0,
        spanStyle,
        spanEndStyle,
        spanStartStyle,
        collapsed,
        attributes;

    for (;;) {
      if (nextChange == pos) {
        // Update current marker set
        spanStyle = spanEndStyle = spanStartStyle = css = "";
        attributes = null;
        collapsed = null;
        nextChange = Infinity;
        var foundBookmarks = [],
            endStyles = void 0;

        for (var j = 0; j < spans.length; ++j) {
          var sp = spans[j],
              m = sp.marker;

          if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
            foundBookmarks.push(m);
          } else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
            if (sp.to != null && sp.to != pos && nextChange > sp.to) {
              nextChange = sp.to;
              spanEndStyle = "";
            }

            if (m.className) {
              spanStyle += " " + m.className;
            }

            if (m.css) {
              css = (css ? css + ";" : "") + m.css;
            }

            if (m.startStyle && sp.from == pos) {
              spanStartStyle += " " + m.startStyle;
            }

            if (m.endStyle && sp.to == nextChange) {
              (endStyles || (endStyles = [])).push(m.endStyle, sp.to);
            } // support for the old title property
            // https://github.com/codemirror/CodeMirror/pull/5673


            if (m.title) {
              (attributes || (attributes = {})).title = m.title;
            }

            if (m.attributes) {
              for (var attr in m.attributes) {
                (attributes || (attributes = {}))[attr] = m.attributes[attr];
              }
            }

            if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0)) {
              collapsed = sp;
            }
          } else if (sp.from > pos && nextChange > sp.from) {
            nextChange = sp.from;
          }
        }

        if (endStyles) {
          for (var j$1 = 0; j$1 < endStyles.length; j$1 += 2) {
            if (endStyles[j$1 + 1] == nextChange) {
              spanEndStyle += " " + endStyles[j$1];
            }
          }
        }

        if (!collapsed || collapsed.from == pos) {
          for (var j$2 = 0; j$2 < foundBookmarks.length; ++j$2) {
            buildCollapsedSpan(builder, 0, foundBookmarks[j$2]);
          }
        }

        if (collapsed && (collapsed.from || 0) == pos) {
          buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos, collapsed.marker, collapsed.from == null);

          if (collapsed.to == null) {
            return;
          }

          if (collapsed.to == pos) {
            collapsed = false;
          }
        }
      }

      if (pos >= len) {
        break;
      }

      var upto = Math.min(len, nextChange);

      while (true) {
        if (text) {
          var end = pos + text.length;

          if (!collapsed) {
            var tokenText = end > upto ? text.slice(0, upto - pos) : text;
            builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle, spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", css, attributes);
          }

          if (end >= upto) {
            text = text.slice(upto - pos);
            pos = upto;
            break;
          }

          pos = end;
          spanStartStyle = "";
        }

        text = allText.slice(at, at = styles[i++]);
        style = interpretTokenStyle(styles[i++], builder.cm.options);
      }
    }
  } // These objects are used to represent the visible (currently drawn)
  // part of the document. A LineView may correspond to multiple
  // logical lines, if those are connected by collapsed ranges.


  function LineView(doc, line, lineN) {
    // The starting line
    this.line = line; // Continuing lines, if any

    this.rest = visualLineContinued(line); // Number of logical lines in this visual line

    this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1;
    this.node = this.text = null;
    this.hidden = lineIsHidden(doc, line);
  } // Create a range of LineView objects for the given lines.


  function buildViewArray(cm, from, to) {
    var array = [],
        nextPos;

    for (var pos = from; pos < to; pos = nextPos) {
      var view = new LineView(cm.doc, getLine(cm.doc, pos), pos);
      nextPos = pos + view.size;
      array.push(view);
    }

    return array;
  }

  var operationGroup = null;

  function pushOperation(op) {
    if (operationGroup) {
      operationGroup.ops.push(op);
    } else {
      op.ownsGroup = operationGroup = {
        ops: [op],
        delayedCallbacks: []
      };
    }
  }

  function fireCallbacksForOps(group) {
    // Calls delayed callbacks and cursorActivity handlers until no
    // new ones appear
    var callbacks = group.delayedCallbacks,
        i = 0;

    do {
      for (; i < callbacks.length; i++) {
        callbacks[i].call(null);
      }

      for (var j = 0; j < group.ops.length; j++) {
        var op = group.ops[j];

        if (op.cursorActivityHandlers) {
          while (op.cursorActivityCalled < op.cursorActivityHandlers.length) {
            op.cursorActivityHandlers[op.cursorActivityCalled++].call(null, op.cm);
          }
        }
      }
    } while (i < callbacks.length);
  }

  function finishOperation(op, endCb) {
    var group = op.ownsGroup;

    if (!group) {
      return;
    }

    try {
      fireCallbacksForOps(group);
    } finally {
      operationGroup = null;
      endCb(group);
    }
  }

  var orphanDelayedCallbacks = null; // Often, we want to signal events at a point where we are in the
  // middle of some work, but don't want the handler to start calling
  // other methods on the editor, which might be in an inconsistent
  // state or simply not expect any other events to happen.
  // signalLater looks whether there are any handlers, and schedules
  // them to be executed when the last operation ends, or, if no
  // operation is active, when a timeout fires.

  function signalLater(emitter, type
  /*, values...*/
  ) {
    var arr = getHandlers(emitter, type);

    if (!arr.length) {
      return;
    }

    var args = Array.prototype.slice.call(arguments, 2),
        list;

    if (operationGroup) {
      list = operationGroup.delayedCallbacks;
    } else if (orphanDelayedCallbacks) {
      list = orphanDelayedCallbacks;
    } else {
      list = orphanDelayedCallbacks = [];
      setTimeout(fireOrphanDelayed, 0);
    }

    var loop = function loop(i) {
      list.push(function () {
        return arr[i].apply(null, args);
      });
    };

    for (var i = 0; i < arr.length; ++i) {
      loop(i);
    }
  }

  function fireOrphanDelayed() {
    var delayed = orphanDelayedCallbacks;
    orphanDelayedCallbacks = null;

    for (var i = 0; i < delayed.length; ++i) {
      delayed[i]();
    }
  } // When an aspect of a line changes, a string is added to
  // lineView.changes. This updates the relevant part of the line's
  // DOM structure.


  function updateLineForChanges(cm, lineView, lineN, dims) {
    for (var j = 0; j < lineView.changes.length; j++) {
      var type = lineView.changes[j];

      if (type == "text") {
        updateLineText(cm, lineView);
      } else if (type == "gutter") {
        updateLineGutter(cm, lineView, lineN, dims);
      } else if (type == "class") {
        updateLineClasses(cm, lineView);
      } else if (type == "widget") {
        updateLineWidgets(cm, lineView, dims);
      }
    }

    lineView.changes = null;
  } // Lines with gutter elements, widgets or a background class need to
  // be wrapped, and have the extra elements added to the wrapper div


  function ensureLineWrapped(lineView) {
    if (lineView.node == lineView.text) {
      lineView.node = elt("div", null, null, "position: relative");

      if (lineView.text.parentNode) {
        lineView.text.parentNode.replaceChild(lineView.node, lineView.text);
      }

      lineView.node.appendChild(lineView.text);

      if (ie && ie_version < 8) {
        lineView.node.style.zIndex = 2;
      }
    }

    return lineView.node;
  }

  function updateLineBackground(cm, lineView) {
    var cls = lineView.bgClass ? lineView.bgClass + " " + (lineView.line.bgClass || "") : lineView.line.bgClass;

    if (cls) {
      cls += " CodeMirror-linebackground";
    }

    if (lineView.background) {
      if (cls) {
        lineView.background.className = cls;
      } else {
        lineView.background.parentNode.removeChild(lineView.background);
        lineView.background = null;
      }
    } else if (cls) {
      var wrap = ensureLineWrapped(lineView);
      lineView.background = wrap.insertBefore(elt("div", null, cls), wrap.firstChild);
      cm.display.input.setUneditable(lineView.background);
    }
  } // Wrapper around buildLineContent which will reuse the structure
  // in display.externalMeasured when possible.


  function getLineContent(cm, lineView) {
    var ext = cm.display.externalMeasured;

    if (ext && ext.line == lineView.line) {
      cm.display.externalMeasured = null;
      lineView.measure = ext.measure;
      return ext.built;
    }

    return buildLineContent(cm, lineView);
  } // Redraw the line's text. Interacts with the background and text
  // classes because the mode may output tokens that influence these
  // classes.


  function updateLineText(cm, lineView) {
    var cls = lineView.text.className;
    var built = getLineContent(cm, lineView);

    if (lineView.text == lineView.node) {
      lineView.node = built.pre;
    }

    lineView.text.parentNode.replaceChild(built.pre, lineView.text);
    lineView.text = built.pre;

    if (built.bgClass != lineView.bgClass || built.textClass != lineView.textClass) {
      lineView.bgClass = built.bgClass;
      lineView.textClass = built.textClass;
      updateLineClasses(cm, lineView);
    } else if (cls) {
      lineView.text.className = cls;
    }
  }

  function updateLineClasses(cm, lineView) {
    updateLineBackground(cm, lineView);

    if (lineView.line.wrapClass) {
      ensureLineWrapped(lineView).className = lineView.line.wrapClass;
    } else if (lineView.node != lineView.text) {
      lineView.node.className = "";
    }

    var textClass = lineView.textClass ? lineView.textClass + " " + (lineView.line.textClass || "") : lineView.line.textClass;
    lineView.text.className = textClass || "";
  }

  function updateLineGutter(cm, lineView, lineN, dims) {
    if (lineView.gutter) {
      lineView.node.removeChild(lineView.gutter);
      lineView.gutter = null;
    }

    if (lineView.gutterBackground) {
      lineView.node.removeChild(lineView.gutterBackground);
      lineView.gutterBackground = null;
    }

    if (lineView.line.gutterClass) {
      var wrap = ensureLineWrapped(lineView);
      lineView.gutterBackground = elt("div", null, "CodeMirror-gutter-background " + lineView.line.gutterClass, "left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px; width: " + dims.gutterTotalWidth + "px");
      cm.display.input.setUneditable(lineView.gutterBackground);
      wrap.insertBefore(lineView.gutterBackground, lineView.text);
    }

    var markers = lineView.line.gutterMarkers;

    if (cm.options.lineNumbers || markers) {
      var wrap$1 = ensureLineWrapped(lineView);
      var gutterWrap = lineView.gutter = elt("div", null, "CodeMirror-gutter-wrapper", "left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px");
      cm.display.input.setUneditable(gutterWrap);
      wrap$1.insertBefore(gutterWrap, lineView.text);

      if (lineView.line.gutterClass) {
        gutterWrap.className += " " + lineView.line.gutterClass;
      }

      if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"])) {
        lineView.lineNumber = gutterWrap.appendChild(elt("div", lineNumberFor(cm.options, lineN), "CodeMirror-linenumber CodeMirror-gutter-elt", "left: " + dims.gutterLeft["CodeMirror-linenumbers"] + "px; width: " + cm.display.lineNumInnerWidth + "px"));
      }

      if (markers) {
        for (var k = 0; k < cm.display.gutterSpecs.length; ++k) {
          var id = cm.display.gutterSpecs[k].className,
              found = markers.hasOwnProperty(id) && markers[id];

          if (found) {
            gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt", "left: " + dims.gutterLeft[id] + "px; width: " + dims.gutterWidth[id] + "px"));
          }
        }
      }
    }
  }

  function updateLineWidgets(cm, lineView, dims) {
    if (lineView.alignable) {
      lineView.alignable = null;
    }

    var isWidget = classTest("CodeMirror-linewidget");

    for (var node = lineView.node.firstChild, next = void 0; node; node = next) {
      next = node.nextSibling;

      if (isWidget.test(node.className)) {
        lineView.node.removeChild(node);
      }
    }

    insertLineWidgets(cm, lineView, dims);
  } // Build a line's DOM representation from scratch


  function buildLineElement(cm, lineView, lineN, dims) {
    var built = getLineContent(cm, lineView);
    lineView.text = lineView.node = built.pre;

    if (built.bgClass) {
      lineView.bgClass = built.bgClass;
    }

    if (built.textClass) {
      lineView.textClass = built.textClass;
    }

    updateLineClasses(cm, lineView);
    updateLineGutter(cm, lineView, lineN, dims);
    insertLineWidgets(cm, lineView, dims);
    return lineView.node;
  } // A lineView may contain multiple logical lines (when merged by
  // collapsed spans). The widgets for all of them need to be drawn.


  function insertLineWidgets(cm, lineView, dims) {
    insertLineWidgetsFor(cm, lineView.line, lineView, dims, true);

    if (lineView.rest) {
      for (var i = 0; i < lineView.rest.length; i++) {
        insertLineWidgetsFor(cm, lineView.rest[i], lineView, dims, false);
      }
    }
  }

  function insertLineWidgetsFor(cm, line, lineView, dims, allowAbove) {
    if (!line.widgets) {
      return;
    }

    var wrap = ensureLineWrapped(lineView);

    for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
      var widget = ws[i],
          node = elt("div", [widget.node], "CodeMirror-linewidget" + (widget.className ? " " + widget.className : ""));

      if (!widget.handleMouseEvents) {
        node.setAttribute("cm-ignore-events", "true");
      }

      positionLineWidget(widget, node, lineView, dims);
      cm.display.input.setUneditable(node);

      if (allowAbove && widget.above) {
        wrap.insertBefore(node, lineView.gutter || lineView.text);
      } else {
        wrap.appendChild(node);
      }

      signalLater(widget, "redraw");
    }
  }

  function positionLineWidget(widget, node, lineView, dims) {
    if (widget.noHScroll) {
      (lineView.alignable || (lineView.alignable = [])).push(node);
      var width = dims.wrapperWidth;
      node.style.left = dims.fixedPos + "px";

      if (!widget.coverGutter) {
        width -= dims.gutterTotalWidth;
        node.style.paddingLeft = dims.gutterTotalWidth + "px";
      }

      node.style.width = width + "px";
    }

    if (widget.coverGutter) {
      node.style.zIndex = 5;
      node.style.position = "relative";

      if (!widget.noHScroll) {
        node.style.marginLeft = -dims.gutterTotalWidth + "px";
      }
    }
  }

  function widgetHeight(widget) {
    if (widget.height != null) {
      return widget.height;
    }

    var cm = widget.doc.cm;

    if (!cm) {
      return 0;
    }

    if (!contains(document.body, widget.node)) {
      var parentStyle = "position: relative;";

      if (widget.coverGutter) {
        parentStyle += "margin-left: -" + cm.display.gutters.offsetWidth + "px;";
      }

      if (widget.noHScroll) {
        parentStyle += "width: " + cm.display.wrapper.clientWidth + "px;";
      }

      removeChildrenAndAdd(cm.display.measure, elt("div", [widget.node], null, parentStyle));
    }

    return widget.height = widget.node.parentNode.offsetHeight;
  } // Return true when the given mouse event happened in a widget


  function eventInWidget(display, e) {
    for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
      if (!n || n.nodeType == 1 && n.getAttribute("cm-ignore-events") == "true" || n.parentNode == display.sizer && n != display.mover) {
        return true;
      }
    }
  } // POSITION MEASUREMENT


  function paddingTop(display) {
    return display.lineSpace.offsetTop;
  }

  function paddingVert(display) {
    return display.mover.offsetHeight - display.lineSpace.offsetHeight;
  }

  function paddingH(display) {
    if (display.cachedPaddingH) {
      return display.cachedPaddingH;
    }

    var e = removeChildrenAndAdd(display.measure, elt("pre", "x", "CodeMirror-line-like"));
    var style = window.getComputedStyle ? window.getComputedStyle(e) : e.currentStyle;
    var data = {
      left: parseInt(style.paddingLeft),
      right: parseInt(style.paddingRight)
    };

    if (!isNaN(data.left) && !isNaN(data.right)) {
      display.cachedPaddingH = data;
    }

    return data;
  }

  function scrollGap(cm) {
    return scrollerGap - cm.display.nativeBarWidth;
  }

  function displayWidth(cm) {
    return cm.display.scroller.clientWidth - scrollGap(cm) - cm.display.barWidth;
  }

  function displayHeight(cm) {
    return cm.display.scroller.clientHeight - scrollGap(cm) - cm.display.barHeight;
  } // Ensure the lineView.wrapping.heights array is populated. This is
  // an array of bottom offsets for the lines that make up a drawn
  // line. When lineWrapping is on, there might be more than one
  // height.


  function ensureLineHeights(cm, lineView, rect) {
    var wrapping = cm.options.lineWrapping;
    var curWidth = wrapping && displayWidth(cm);

    if (!lineView.measure.heights || wrapping && lineView.measure.width != curWidth) {
      var heights = lineView.measure.heights = [];

      if (wrapping) {
        lineView.measure.width = curWidth;
        var rects = lineView.text.firstChild.getClientRects();

        for (var i = 0; i < rects.length - 1; i++) {
          var cur = rects[i],
              next = rects[i + 1];

          if (Math.abs(cur.bottom - next.bottom) > 2) {
            heights.push((cur.bottom + next.top) / 2 - rect.top);
          }
        }
      }

      heights.push(rect.bottom - rect.top);
    }
  } // Find a line map (mapping character offsets to text nodes) and a
  // measurement cache for the given line number. (A line view might
  // contain multiple lines when collapsed ranges are present.)


  function mapFromLineView(lineView, line, lineN) {
    if (lineView.line == line) {
      return {
        map: lineView.measure.map,
        cache: lineView.measure.cache
      };
    }

    for (var i = 0; i < lineView.rest.length; i++) {
      if (lineView.rest[i] == line) {
        return {
          map: lineView.measure.maps[i],
          cache: lineView.measure.caches[i]
        };
      }
    }

    for (var i$1 = 0; i$1 < lineView.rest.length; i$1++) {
      if (lineNo(lineView.rest[i$1]) > lineN) {
        return {
          map: lineView.measure.maps[i$1],
          cache: lineView.measure.caches[i$1],
          before: true
        };
      }
    }
  } // Render a line into the hidden node display.externalMeasured. Used
  // when measurement is needed for a line that's not in the viewport.


  function updateExternalMeasurement(cm, line) {
    line = visualLine(line);
    var lineN = lineNo(line);
    var view = cm.display.externalMeasured = new LineView(cm.doc, line, lineN);
    view.lineN = lineN;
    var built = view.built = buildLineContent(cm, view);
    view.text = built.pre;
    removeChildrenAndAdd(cm.display.lineMeasure, built.pre);
    return view;
  } // Get a {top, bottom, left, right} box (in line-local coordinates)
  // for a given character.


  function measureChar(cm, line, ch, bias) {
    return measureCharPrepared(cm, prepareMeasureForLine(cm, line), ch, bias);
  } // Find a line view that corresponds to the given line number.


  function findViewForLine(cm, lineN) {
    if (lineN >= cm.display.viewFrom && lineN < cm.display.viewTo) {
      return cm.display.view[findViewIndex(cm, lineN)];
    }

    var ext = cm.display.externalMeasured;

    if (ext && lineN >= ext.lineN && lineN < ext.lineN + ext.size) {
      return ext;
    }
  } // Measurement can be split in two steps, the set-up work that
  // applies to the whole line, and the measurement of the actual
  // character. Functions like coordsChar, that need to do a lot of
  // measurements in a row, can thus ensure that the set-up work is
  // only done once.


  function prepareMeasureForLine(cm, line) {
    var lineN = lineNo(line);
    var view = findViewForLine(cm, lineN);

    if (view && !view.text) {
      view = null;
    } else if (view && view.changes) {
      updateLineForChanges(cm, view, lineN, getDimensions(cm));
      cm.curOp.forceUpdate = true;
    }

    if (!view) {
      view = updateExternalMeasurement(cm, line);
    }

    var info = mapFromLineView(view, line, lineN);
    return {
      line: line,
      view: view,
      rect: null,
      map: info.map,
      cache: info.cache,
      before: info.before,
      hasHeights: false
    };
  } // Given a prepared measurement object, measures the position of an
  // actual character (or fetches it from the cache).


  function measureCharPrepared(cm, prepared, ch, bias, varHeight) {
    if (prepared.before) {
      ch = -1;
    }

    var key = ch + (bias || ""),
        found;

    if (prepared.cache.hasOwnProperty(key)) {
      found = prepared.cache[key];
    } else {
      if (!prepared.rect) {
        prepared.rect = prepared.view.text.getBoundingClientRect();
      }

      if (!prepared.hasHeights) {
        ensureLineHeights(cm, prepared.view, prepared.rect);
        prepared.hasHeights = true;
      }

      found = measureCharInner(cm, prepared, ch, bias);

      if (!found.bogus) {
        prepared.cache[key] = found;
      }
    }

    return {
      left: found.left,
      right: found.right,
      top: varHeight ? found.rtop : found.top,
      bottom: varHeight ? found.rbottom : found.bottom
    };
  }

  var nullRect = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  };

  function nodeAndOffsetInLineMap(map$$1, ch, bias) {
    var node, start, end, collapse, mStart, mEnd; // First, search the line map for the text node corresponding to,
    // or closest to, the target character.

    for (var i = 0; i < map$$1.length; i += 3) {
      mStart = map$$1[i];
      mEnd = map$$1[i + 1];

      if (ch < mStart) {
        start = 0;
        end = 1;
        collapse = "left";
      } else if (ch < mEnd) {
        start = ch - mStart;
        end = start + 1;
      } else if (i == map$$1.length - 3 || ch == mEnd && map$$1[i + 3] > ch) {
        end = mEnd - mStart;
        start = end - 1;

        if (ch >= mEnd) {
          collapse = "right";
        }
      }

      if (start != null) {
        node = map$$1[i + 2];

        if (mStart == mEnd && bias == (node.insertLeft ? "left" : "right")) {
          collapse = bias;
        }

        if (bias == "left" && start == 0) {
          while (i && map$$1[i - 2] == map$$1[i - 3] && map$$1[i - 1].insertLeft) {
            node = map$$1[(i -= 3) + 2];
            collapse = "left";
          }
        }

        if (bias == "right" && start == mEnd - mStart) {
          while (i < map$$1.length - 3 && map$$1[i + 3] == map$$1[i + 4] && !map$$1[i + 5].insertLeft) {
            node = map$$1[(i += 3) + 2];
            collapse = "right";
          }
        }

        break;
      }
    }

    return {
      node: node,
      start: start,
      end: end,
      collapse: collapse,
      coverStart: mStart,
      coverEnd: mEnd
    };
  }

  function getUsefulRect(rects, bias) {
    var rect = nullRect;

    if (bias == "left") {
      for (var i = 0; i < rects.length; i++) {
        if ((rect = rects[i]).left != rect.right) {
          break;
        }
      }
    } else {
      for (var i$1 = rects.length - 1; i$1 >= 0; i$1--) {
        if ((rect = rects[i$1]).left != rect.right) {
          break;
        }
      }
    }

    return rect;
  }

  function measureCharInner(cm, prepared, ch, bias) {
    var place = nodeAndOffsetInLineMap(prepared.map, ch, bias);
    var node = place.node,
        start = place.start,
        end = place.end,
        collapse = place.collapse;
    var rect;

    if (node.nodeType == 3) {
      // If it is a text node, use a range to retrieve the coordinates.
      for (var i$1 = 0; i$1 < 4; i$1++) {
        // Retry a maximum of 4 times when nonsense rectangles are returned
        while (start && isExtendingChar(prepared.line.text.charAt(place.coverStart + start))) {
          --start;
        }

        while (place.coverStart + end < place.coverEnd && isExtendingChar(prepared.line.text.charAt(place.coverStart + end))) {
          ++end;
        }

        if (ie && ie_version < 9 && start == 0 && end == place.coverEnd - place.coverStart) {
          rect = node.parentNode.getBoundingClientRect();
        } else {
          rect = getUsefulRect(range(node, start, end).getClientRects(), bias);
        }

        if (rect.left || rect.right || start == 0) {
          break;
        }

        end = start;
        start = start - 1;
        collapse = "right";
      }

      if (ie && ie_version < 11) {
        rect = maybeUpdateRectForZooming(cm.display.measure, rect);
      }
    } else {
      // If it is a widget, simply get the box for the whole widget.
      if (start > 0) {
        collapse = bias = "right";
      }

      var rects;

      if (cm.options.lineWrapping && (rects = node.getClientRects()).length > 1) {
        rect = rects[bias == "right" ? rects.length - 1 : 0];
      } else {
        rect = node.getBoundingClientRect();
      }
    }

    if (ie && ie_version < 9 && !start && (!rect || !rect.left && !rect.right)) {
      var rSpan = node.parentNode.getClientRects()[0];

      if (rSpan) {
        rect = {
          left: rSpan.left,
          right: rSpan.left + charWidth(cm.display),
          top: rSpan.top,
          bottom: rSpan.bottom
        };
      } else {
        rect = nullRect;
      }
    }

    var rtop = rect.top - prepared.rect.top,
        rbot = rect.bottom - prepared.rect.top;
    var mid = (rtop + rbot) / 2;
    var heights = prepared.view.measure.heights;
    var i = 0;

    for (; i < heights.length - 1; i++) {
      if (mid < heights[i]) {
        break;
      }
    }

    var top = i ? heights[i - 1] : 0,
        bot = heights[i];
    var result = {
      left: (collapse == "right" ? rect.right : rect.left) - prepared.rect.left,
      right: (collapse == "left" ? rect.left : rect.right) - prepared.rect.left,
      top: top,
      bottom: bot
    };

    if (!rect.left && !rect.right) {
      result.bogus = true;
    }

    if (!cm.options.singleCursorHeightPerLine) {
      result.rtop = rtop;
      result.rbottom = rbot;
    }

    return result;
  } // Work around problem with bounding client rects on ranges being
  // returned incorrectly when zoomed on IE10 and below.


  function maybeUpdateRectForZooming(measure, rect) {
    if (!window.screen || screen.logicalXDPI == null || screen.logicalXDPI == screen.deviceXDPI || !hasBadZoomedRects(measure)) {
      return rect;
    }

    var scaleX = screen.logicalXDPI / screen.deviceXDPI;
    var scaleY = screen.logicalYDPI / screen.deviceYDPI;
    return {
      left: rect.left * scaleX,
      right: rect.right * scaleX,
      top: rect.top * scaleY,
      bottom: rect.bottom * scaleY
    };
  }

  function clearLineMeasurementCacheFor(lineView) {
    if (lineView.measure) {
      lineView.measure.cache = {};
      lineView.measure.heights = null;

      if (lineView.rest) {
        for (var i = 0; i < lineView.rest.length; i++) {
          lineView.measure.caches[i] = {};
        }
      }
    }
  }

  function clearLineMeasurementCache(cm) {
    cm.display.externalMeasure = null;
    removeChildren(cm.display.lineMeasure);

    for (var i = 0; i < cm.display.view.length; i++) {
      clearLineMeasurementCacheFor(cm.display.view[i]);
    }
  }

  function clearCaches(cm) {
    clearLineMeasurementCache(cm);
    cm.display.cachedCharWidth = cm.display.cachedTextHeight = cm.display.cachedPaddingH = null;

    if (!cm.options.lineWrapping) {
      cm.display.maxLineChanged = true;
    }

    cm.display.lineNumChars = null;
  }

  function pageScrollX() {
    // Work around https://bugs.chromium.org/p/chromium/issues/detail?id=489206
    // which causes page_Offset and bounding client rects to use
    // different reference viewports and invalidate our calculations.
    if (chrome && android) {
      return -(document.body.getBoundingClientRect().left - parseInt(getComputedStyle(document.body).marginLeft));
    }

    return window.pageXOffset || (document.documentElement || document.body).scrollLeft;
  }

  function pageScrollY() {
    if (chrome && android) {
      return -(document.body.getBoundingClientRect().top - parseInt(getComputedStyle(document.body).marginTop));
    }

    return window.pageYOffset || (document.documentElement || document.body).scrollTop;
  }

  function widgetTopHeight(lineObj) {
    var height = 0;

    if (lineObj.widgets) {
      for (var i = 0; i < lineObj.widgets.length; ++i) {
        if (lineObj.widgets[i].above) {
          height += widgetHeight(lineObj.widgets[i]);
        }
      }
    }

    return height;
  } // Converts a {top, bottom, left, right} box from line-local
  // coordinates into another coordinate system. Context may be one of
  // "line", "div" (display.lineDiv), "local"./null (editor), "window",
  // or "page".


  function intoCoordSystem(cm, lineObj, rect, context, includeWidgets) {
    if (!includeWidgets) {
      var height = widgetTopHeight(lineObj);
      rect.top += height;
      rect.bottom += height;
    }

    if (context == "line") {
      return rect;
    }

    if (!context) {
      context = "local";
    }

    var yOff = _heightAtLine(lineObj);

    if (context == "local") {
      yOff += paddingTop(cm.display);
    } else {
      yOff -= cm.display.viewOffset;
    }

    if (context == "page" || context == "window") {
      var lOff = cm.display.lineSpace.getBoundingClientRect();
      yOff += lOff.top + (context == "window" ? 0 : pageScrollY());
      var xOff = lOff.left + (context == "window" ? 0 : pageScrollX());
      rect.left += xOff;
      rect.right += xOff;
    }

    rect.top += yOff;
    rect.bottom += yOff;
    return rect;
  } // Coverts a box from "div" coords to another coordinate system.
  // Context may be "window", "page", "div", or "local"./null.


  function fromCoordSystem(cm, coords, context) {
    if (context == "div") {
      return coords;
    }

    var left = coords.left,
        top = coords.top; // First move into "page" coordinate system

    if (context == "page") {
      left -= pageScrollX();
      top -= pageScrollY();
    } else if (context == "local" || !context) {
      var localBox = cm.display.sizer.getBoundingClientRect();
      left += localBox.left;
      top += localBox.top;
    }

    var lineSpaceBox = cm.display.lineSpace.getBoundingClientRect();
    return {
      left: left - lineSpaceBox.left,
      top: top - lineSpaceBox.top
    };
  }

  function _charCoords(cm, pos, context, lineObj, bias) {
    if (!lineObj) {
      lineObj = getLine(cm.doc, pos.line);
    }

    return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch, bias), context);
  } // Returns a box for a given cursor position, which may have an
  // 'other' property containing the position of the secondary cursor
  // on a bidi boundary.
  // A cursor Pos(line, char, "before") is on the same visual line as `char - 1`
  // and after `char - 1` in writing order of `char - 1`
  // A cursor Pos(line, char, "after") is on the same visual line as `char`
  // and before `char` in writing order of `char`
  // Examples (upper-case letters are RTL, lower-case are LTR):
  //     Pos(0, 1, ...)
  //     before   after
  // ab     a|b     a|b
  // aB     a|B     aB|
  // Ab     |Ab     A|b
  // AB     B|A     B|A
  // Every position after the last character on a line is considered to stick
  // to the last character on the line.


  function _cursorCoords(cm, pos, context, lineObj, preparedMeasure, varHeight) {
    lineObj = lineObj || getLine(cm.doc, pos.line);

    if (!preparedMeasure) {
      preparedMeasure = prepareMeasureForLine(cm, lineObj);
    }

    function get(ch, right) {
      var m = measureCharPrepared(cm, preparedMeasure, ch, right ? "right" : "left", varHeight);

      if (right) {
        m.left = m.right;
      } else {
        m.right = m.left;
      }

      return intoCoordSystem(cm, lineObj, m, context);
    }

    var order = getOrder(lineObj, cm.doc.direction),
        ch = pos.ch,
        sticky = pos.sticky;

    if (ch >= lineObj.text.length) {
      ch = lineObj.text.length;
      sticky = "before";
    } else if (ch <= 0) {
      ch = 0;
      sticky = "after";
    }

    if (!order) {
      return get(sticky == "before" ? ch - 1 : ch, sticky == "before");
    }

    function getBidi(ch, partPos, invert) {
      var part = order[partPos],
          right = part.level == 1;
      return get(invert ? ch - 1 : ch, right != invert);
    }

    var partPos = getBidiPartAt(order, ch, sticky);
    var other = bidiOther;
    var val = getBidi(ch, partPos, sticky == "before");

    if (other != null) {
      val.other = getBidi(ch, other, sticky != "before");
    }

    return val;
  } // Used to cheaply estimate the coordinates for a position. Used for
  // intermediate scroll updates.


  function estimateCoords(cm, pos) {
    var left = 0;
    pos = _clipPos(cm.doc, pos);

    if (!cm.options.lineWrapping) {
      left = charWidth(cm.display) * pos.ch;
    }

    var lineObj = getLine(cm.doc, pos.line);
    var top = _heightAtLine(lineObj) + paddingTop(cm.display);
    return {
      left: left,
      right: left,
      top: top,
      bottom: top + lineObj.height
    };
  } // Positions returned by coordsChar contain some extra information.
  // xRel is the relative x position of the input coordinates compared
  // to the found position (so xRel > 0 means the coordinates are to
  // the right of the character position, for example). When outside
  // is true, that means the coordinates lie outside the line's
  // vertical range.


  function PosWithInfo(line, ch, sticky, outside, xRel) {
    var pos = Pos(line, ch, sticky);
    pos.xRel = xRel;

    if (outside) {
      pos.outside = outside;
    }

    return pos;
  } // Compute the character position closest to the given coordinates.
  // Input must be lineSpace-local ("div" coordinate system).


  function _coordsChar(cm, x, y) {
    var doc = cm.doc;
    y += cm.display.viewOffset;

    if (y < 0) {
      return PosWithInfo(doc.first, 0, null, -1, -1);
    }

    var lineN = _lineAtHeight(doc, y),
        last = doc.first + doc.size - 1;

    if (lineN > last) {
      return PosWithInfo(doc.first + doc.size - 1, getLine(doc, last).text.length, null, 1, 1);
    }

    if (x < 0) {
      x = 0;
    }

    var lineObj = getLine(doc, lineN);

    for (;;) {
      var found = coordsCharInner(cm, lineObj, lineN, x, y);
      var collapsed = collapsedSpanAround(lineObj, found.ch + (found.xRel > 0 || found.outside > 0 ? 1 : 0));

      if (!collapsed) {
        return found;
      }

      var rangeEnd = collapsed.find(1);

      if (rangeEnd.line == lineN) {
        return rangeEnd;
      }

      lineObj = getLine(doc, lineN = rangeEnd.line);
    }
  }

  function wrappedLineExtent(cm, lineObj, preparedMeasure, y) {
    y -= widgetTopHeight(lineObj);
    var end = lineObj.text.length;
    var begin = findFirst(function (ch) {
      return measureCharPrepared(cm, preparedMeasure, ch - 1).bottom <= y;
    }, end, 0);
    end = findFirst(function (ch) {
      return measureCharPrepared(cm, preparedMeasure, ch).top > y;
    }, begin, end);
    return {
      begin: begin,
      end: end
    };
  }

  function wrappedLineExtentChar(cm, lineObj, preparedMeasure, target) {
    if (!preparedMeasure) {
      preparedMeasure = prepareMeasureForLine(cm, lineObj);
    }

    var targetTop = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, target), "line").top;
    return wrappedLineExtent(cm, lineObj, preparedMeasure, targetTop);
  } // Returns true if the given side of a box is after the given
  // coordinates, in top-to-bottom, left-to-right order.


  function boxIsAfter(box, x, y, left) {
    return box.bottom <= y ? false : box.top > y ? true : (left ? box.left : box.right) > x;
  }

  function coordsCharInner(cm, lineObj, lineNo$$1, x, y) {
    // Move y into line-local coordinate space
    y -= _heightAtLine(lineObj);
    var preparedMeasure = prepareMeasureForLine(cm, lineObj); // When directly calling `measureCharPrepared`, we have to adjust
    // for the widgets at this line.

    var widgetHeight$$1 = widgetTopHeight(lineObj);
    var begin = 0,
        end = lineObj.text.length,
        ltr = true;
    var order = getOrder(lineObj, cm.doc.direction); // If the line isn't plain left-to-right text, first figure out
    // which bidi section the coordinates fall into.

    if (order) {
      var part = (cm.options.lineWrapping ? coordsBidiPartWrapped : coordsBidiPart)(cm, lineObj, lineNo$$1, preparedMeasure, order, x, y);
      ltr = part.level != 1; // The awkward -1 offsets are needed because findFirst (called
      // on these below) will treat its first bound as inclusive,
      // second as exclusive, but we want to actually address the
      // characters in the part's range

      begin = ltr ? part.from : part.to - 1;
      end = ltr ? part.to : part.from - 1;
    } // A binary search to find the first character whose bounding box
    // starts after the coordinates. If we run across any whose box wrap
    // the coordinates, store that.


    var chAround = null,
        boxAround = null;
    var ch = findFirst(function (ch) {
      var box = measureCharPrepared(cm, preparedMeasure, ch);
      box.top += widgetHeight$$1;
      box.bottom += widgetHeight$$1;

      if (!boxIsAfter(box, x, y, false)) {
        return false;
      }

      if (box.top <= y && box.left <= x) {
        chAround = ch;
        boxAround = box;
      }

      return true;
    }, begin, end);
    var baseX,
        sticky,
        outside = false; // If a box around the coordinates was found, use that

    if (boxAround) {
      // Distinguish coordinates nearer to the left or right side of the box
      var atLeft = x - boxAround.left < boxAround.right - x,
          atStart = atLeft == ltr;
      ch = chAround + (atStart ? 0 : 1);
      sticky = atStart ? "after" : "before";
      baseX = atLeft ? boxAround.left : boxAround.right;
    } else {
      // (Adjust for extended bound, if necessary.)
      if (!ltr && (ch == end || ch == begin)) {
        ch++;
      } // To determine which side to associate with, get the box to the
      // left of the character and compare it's vertical position to the
      // coordinates


      sticky = ch == 0 ? "after" : ch == lineObj.text.length ? "before" : measureCharPrepared(cm, preparedMeasure, ch - (ltr ? 1 : 0)).bottom + widgetHeight$$1 <= y == ltr ? "after" : "before"; // Now get accurate coordinates for this place, in order to get a
      // base X position

      var coords = _cursorCoords(cm, Pos(lineNo$$1, ch, sticky), "line", lineObj, preparedMeasure);

      baseX = coords.left;
      outside = y < coords.top ? -1 : y >= coords.bottom ? 1 : 0;
    }

    ch = skipExtendingChars(lineObj.text, ch, 1);
    return PosWithInfo(lineNo$$1, ch, sticky, outside, x - baseX);
  }

  function coordsBidiPart(cm, lineObj, lineNo$$1, preparedMeasure, order, x, y) {
    // Bidi parts are sorted left-to-right, and in a non-line-wrapping
    // situation, we can take this ordering to correspond to the visual
    // ordering. This finds the first part whose end is after the given
    // coordinates.
    var index = findFirst(function (i) {
      var part = order[i],
          ltr = part.level != 1;
      return boxIsAfter(_cursorCoords(cm, Pos(lineNo$$1, ltr ? part.to : part.from, ltr ? "before" : "after"), "line", lineObj, preparedMeasure), x, y, true);
    }, 0, order.length - 1);
    var part = order[index]; // If this isn't the first part, the part's start is also after
    // the coordinates, and the coordinates aren't on the same line as
    // that start, move one part back.

    if (index > 0) {
      var ltr = part.level != 1;

      var start = _cursorCoords(cm, Pos(lineNo$$1, ltr ? part.from : part.to, ltr ? "after" : "before"), "line", lineObj, preparedMeasure);

      if (boxIsAfter(start, x, y, true) && start.top > y) {
        part = order[index - 1];
      }
    }

    return part;
  }

  function coordsBidiPartWrapped(cm, lineObj, _lineNo, preparedMeasure, order, x, y) {
    // In a wrapped line, rtl text on wrapping boundaries can do things
    // that don't correspond to the ordering in our `order` array at
    // all, so a binary search doesn't work, and we want to return a
    // part that only spans one line so that the binary search in
    // coordsCharInner is safe. As such, we first find the extent of the
    // wrapped line, and then do a flat search in which we discard any
    // spans that aren't on the line.
    var ref = wrappedLineExtent(cm, lineObj, preparedMeasure, y);
    var begin = ref.begin;
    var end = ref.end;

    if (/\s/.test(lineObj.text.charAt(end - 1))) {
      end--;
    }

    var part = null,
        closestDist = null;

    for (var i = 0; i < order.length; i++) {
      var p = order[i];

      if (p.from >= end || p.to <= begin) {
        continue;
      }

      var ltr = p.level != 1;
      var endX = measureCharPrepared(cm, preparedMeasure, ltr ? Math.min(end, p.to) - 1 : Math.max(begin, p.from)).right; // Weigh against spans ending before this, so that they are only
      // picked if nothing ends after

      var dist = endX < x ? x - endX + 1e9 : endX - x;

      if (!part || closestDist > dist) {
        part = p;
        closestDist = dist;
      }
    }

    if (!part) {
      part = order[order.length - 1];
    } // Clip the part to the wrapped line.


    if (part.from < begin) {
      part = {
        from: begin,
        to: part.to,
        level: part.level
      };
    }

    if (part.to > end) {
      part = {
        from: part.from,
        to: end,
        level: part.level
      };
    }

    return part;
  }

  var measureText; // Compute the default text height.

  function textHeight(display) {
    if (display.cachedTextHeight != null) {
      return display.cachedTextHeight;
    }

    if (measureText == null) {
      measureText = elt("pre", null, "CodeMirror-line-like"); // Measure a bunch of lines, for browsers that compute
      // fractional heights.

      for (var i = 0; i < 49; ++i) {
        measureText.appendChild(document.createTextNode("x"));
        measureText.appendChild(elt("br"));
      }

      measureText.appendChild(document.createTextNode("x"));
    }

    removeChildrenAndAdd(display.measure, measureText);
    var height = measureText.offsetHeight / 50;

    if (height > 3) {
      display.cachedTextHeight = height;
    }

    removeChildren(display.measure);
    return height || 1;
  } // Compute the default character width.


  function charWidth(display) {
    if (display.cachedCharWidth != null) {
      return display.cachedCharWidth;
    }

    var anchor = elt("span", "xxxxxxxxxx");
    var pre = elt("pre", [anchor], "CodeMirror-line-like");
    removeChildrenAndAdd(display.measure, pre);
    var rect = anchor.getBoundingClientRect(),
        width = (rect.right - rect.left) / 10;

    if (width > 2) {
      display.cachedCharWidth = width;
    }

    return width || 10;
  } // Do a bulk-read of the DOM positions and sizes needed to draw the
  // view, so that we don't interleave reading and writing to the DOM.


  function getDimensions(cm) {
    var d = cm.display,
        left = {},
        width = {};
    var gutterLeft = d.gutters.clientLeft;

    for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
      var id = cm.display.gutterSpecs[i].className;
      left[id] = n.offsetLeft + n.clientLeft + gutterLeft;
      width[id] = n.clientWidth;
    }

    return {
      fixedPos: compensateForHScroll(d),
      gutterTotalWidth: d.gutters.offsetWidth,
      gutterLeft: left,
      gutterWidth: width,
      wrapperWidth: d.wrapper.clientWidth
    };
  } // Computes display.scroller.scrollLeft + display.gutters.offsetWidth,
  // but using getBoundingClientRect to get a sub-pixel-accurate
  // result.


  function compensateForHScroll(display) {
    return display.scroller.getBoundingClientRect().left - display.sizer.getBoundingClientRect().left;
  } // Returns a function that estimates the height of a line, to use as
  // first approximation until the line becomes visible (and is thus
  // properly measurable).


  function estimateHeight(cm) {
    var th = textHeight(cm.display),
        wrapping = cm.options.lineWrapping;
    var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3);
    return function (line) {
      if (lineIsHidden(cm.doc, line)) {
        return 0;
      }

      var widgetsHeight = 0;

      if (line.widgets) {
        for (var i = 0; i < line.widgets.length; i++) {
          if (line.widgets[i].height) {
            widgetsHeight += line.widgets[i].height;
          }
        }
      }

      if (wrapping) {
        return widgetsHeight + (Math.ceil(line.text.length / perLine) || 1) * th;
      } else {
        return widgetsHeight + th;
      }
    };
  }

  function estimateLineHeights(cm) {
    var doc = cm.doc,
        est = estimateHeight(cm);
    doc.iter(function (line) {
      var estHeight = est(line);

      if (estHeight != line.height) {
        updateLineHeight(line, estHeight);
      }
    });
  } // Given a mouse event, find the corresponding position. If liberal
  // is false, it checks whether a gutter or scrollbar was clicked,
  // and returns null if it was. forRect is used by rectangular
  // selections, and tries to estimate a character position even for
  // coordinates beyond the right of the text.


  function posFromMouse(cm, e, liberal, forRect) {
    var display = cm.display;

    if (!liberal && e_target(e).getAttribute("cm-not-content") == "true") {
      return null;
    }

    var x,
        y,
        space = display.lineSpace.getBoundingClientRect(); // Fails unpredictably on IE[67] when mouse is dragged around quickly.

    try {
      x = e.clientX - space.left;
      y = e.clientY - space.top;
    } catch (e) {
      return null;
    }

    var coords = _coordsChar(cm, x, y),
        line;

    if (forRect && coords.xRel > 0 && (line = getLine(cm.doc, coords.line).text).length == coords.ch) {
      var colDiff = countColumn(line, line.length, cm.options.tabSize) - line.length;
      coords = Pos(coords.line, Math.max(0, Math.round((x - paddingH(cm.display).left) / charWidth(cm.display)) - colDiff));
    }

    return coords;
  } // Find the view element corresponding to a given line. Return null
  // when the line isn't visible.


  function findViewIndex(cm, n) {
    if (n >= cm.display.viewTo) {
      return null;
    }

    n -= cm.display.viewFrom;

    if (n < 0) {
      return null;
    }

    var view = cm.display.view;

    for (var i = 0; i < view.length; i++) {
      n -= view[i].size;

      if (n < 0) {
        return i;
      }
    }
  } // Updates the display.view data structure for a given change to the
  // document. From and to are in pre-change coordinates. Lendiff is
  // the amount of lines added or subtracted by the change. This is
  // used for changes that span multiple lines, or change the way
  // lines are divided into visual lines. regLineChange (below)
  // registers single-line changes.


  function regChange(cm, from, to, lendiff) {
    if (from == null) {
      from = cm.doc.first;
    }

    if (to == null) {
      to = cm.doc.first + cm.doc.size;
    }

    if (!lendiff) {
      lendiff = 0;
    }

    var display = cm.display;

    if (lendiff && to < display.viewTo && (display.updateLineNumbers == null || display.updateLineNumbers > from)) {
      display.updateLineNumbers = from;
    }

    cm.curOp.viewChanged = true;

    if (from >= display.viewTo) {
      // Change after
      if (sawCollapsedSpans && visualLineNo(cm.doc, from) < display.viewTo) {
        resetView(cm);
      }
    } else if (to <= display.viewFrom) {
      // Change before
      if (sawCollapsedSpans && visualLineEndNo(cm.doc, to + lendiff) > display.viewFrom) {
        resetView(cm);
      } else {
        display.viewFrom += lendiff;
        display.viewTo += lendiff;
      }
    } else if (from <= display.viewFrom && to >= display.viewTo) {
      // Full overlap
      resetView(cm);
    } else if (from <= display.viewFrom) {
      // Top overlap
      var cut = viewCuttingPoint(cm, to, to + lendiff, 1);

      if (cut) {
        display.view = display.view.slice(cut.index);
        display.viewFrom = cut.lineN;
        display.viewTo += lendiff;
      } else {
        resetView(cm);
      }
    } else if (to >= display.viewTo) {
      // Bottom overlap
      var cut$1 = viewCuttingPoint(cm, from, from, -1);

      if (cut$1) {
        display.view = display.view.slice(0, cut$1.index);
        display.viewTo = cut$1.lineN;
      } else {
        resetView(cm);
      }
    } else {
      // Gap in the middle
      var cutTop = viewCuttingPoint(cm, from, from, -1);
      var cutBot = viewCuttingPoint(cm, to, to + lendiff, 1);

      if (cutTop && cutBot) {
        display.view = display.view.slice(0, cutTop.index).concat(buildViewArray(cm, cutTop.lineN, cutBot.lineN)).concat(display.view.slice(cutBot.index));
        display.viewTo += lendiff;
      } else {
        resetView(cm);
      }
    }

    var ext = display.externalMeasured;

    if (ext) {
      if (to < ext.lineN) {
        ext.lineN += lendiff;
      } else if (from < ext.lineN + ext.size) {
        display.externalMeasured = null;
      }
    }
  } // Register a change to a single line. Type must be one of "text",
  // "gutter", "class", "widget"


  function regLineChange(cm, line, type) {
    cm.curOp.viewChanged = true;
    var display = cm.display,
        ext = cm.display.externalMeasured;

    if (ext && line >= ext.lineN && line < ext.lineN + ext.size) {
      display.externalMeasured = null;
    }

    if (line < display.viewFrom || line >= display.viewTo) {
      return;
    }

    var lineView = display.view[findViewIndex(cm, line)];

    if (lineView.node == null) {
      return;
    }

    var arr = lineView.changes || (lineView.changes = []);

    if (indexOf(arr, type) == -1) {
      arr.push(type);
    }
  } // Clear the view.


  function resetView(cm) {
    cm.display.viewFrom = cm.display.viewTo = cm.doc.first;
    cm.display.view = [];
    cm.display.viewOffset = 0;
  }

  function viewCuttingPoint(cm, oldN, newN, dir) {
    var index = findViewIndex(cm, oldN),
        diff,
        view = cm.display.view;

    if (!sawCollapsedSpans || newN == cm.doc.first + cm.doc.size) {
      return {
        index: index,
        lineN: newN
      };
    }

    var n = cm.display.viewFrom;

    for (var i = 0; i < index; i++) {
      n += view[i].size;
    }

    if (n != oldN) {
      if (dir > 0) {
        if (index == view.length - 1) {
          return null;
        }

        diff = n + view[index].size - oldN;
        index++;
      } else {
        diff = n - oldN;
      }

      oldN += diff;
      newN += diff;
    }

    while (visualLineNo(cm.doc, newN) != newN) {
      if (index == (dir < 0 ? 0 : view.length - 1)) {
        return null;
      }

      newN += dir * view[index - (dir < 0 ? 1 : 0)].size;
      index += dir;
    }

    return {
      index: index,
      lineN: newN
    };
  } // Force the view to cover a given range, adding empty view element
  // or clipping off existing ones as needed.


  function adjustView(cm, from, to) {
    var display = cm.display,
        view = display.view;

    if (view.length == 0 || from >= display.viewTo || to <= display.viewFrom) {
      display.view = buildViewArray(cm, from, to);
      display.viewFrom = from;
    } else {
      if (display.viewFrom > from) {
        display.view = buildViewArray(cm, from, display.viewFrom).concat(display.view);
      } else if (display.viewFrom < from) {
        display.view = display.view.slice(findViewIndex(cm, from));
      }

      display.viewFrom = from;

      if (display.viewTo < to) {
        display.view = display.view.concat(buildViewArray(cm, display.viewTo, to));
      } else if (display.viewTo > to) {
        display.view = display.view.slice(0, findViewIndex(cm, to));
      }
    }

    display.viewTo = to;
  } // Count the number of lines in the view whose DOM representation is
  // out of date (or nonexistent).


  function countDirtyView(cm) {
    var view = cm.display.view,
        dirty = 0;

    for (var i = 0; i < view.length; i++) {
      var lineView = view[i];

      if (!lineView.hidden && (!lineView.node || lineView.changes)) {
        ++dirty;
      }
    }

    return dirty;
  }

  function updateSelection(cm) {
    cm.display.input.showSelection(cm.display.input.prepareSelection());
  }

  function prepareSelection(cm, primary) {
    if (primary === void 0) primary = true;
    var doc = cm.doc,
        result = {};
    var curFragment = result.cursors = document.createDocumentFragment();
    var selFragment = result.selection = document.createDocumentFragment();

    for (var i = 0; i < doc.sel.ranges.length; i++) {
      if (!primary && i == doc.sel.primIndex) {
        continue;
      }

      var range$$1 = doc.sel.ranges[i];

      if (range$$1.from().line >= cm.display.viewTo || range$$1.to().line < cm.display.viewFrom) {
        continue;
      }

      var collapsed = range$$1.empty();

      if (collapsed || cm.options.showCursorWhenSelecting) {
        drawSelectionCursor(cm, range$$1.head, curFragment);
      }

      if (!collapsed) {
        drawSelectionRange(cm, range$$1, selFragment);
      }
    }

    return result;
  } // Draws a cursor for the given range


  function drawSelectionCursor(cm, head, output) {
    var pos = _cursorCoords(cm, head, "div", null, null, !cm.options.singleCursorHeightPerLine);

    var cursor = output.appendChild(elt("div", "\xA0", "CodeMirror-cursor"));
    cursor.style.left = pos.left + "px";
    cursor.style.top = pos.top + "px";
    cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px";

    if (pos.other) {
      // Secondary cursor, shown when on a 'jump' in bi-directional text
      var otherCursor = output.appendChild(elt("div", "\xA0", "CodeMirror-cursor CodeMirror-secondarycursor"));
      otherCursor.style.display = "";
      otherCursor.style.left = pos.other.left + "px";
      otherCursor.style.top = pos.other.top + "px";
      otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px";
    }
  }

  function cmpCoords(a, b) {
    return a.top - b.top || a.left - b.left;
  } // Draws the given range as a highlighted selection


  function drawSelectionRange(cm, range$$1, output) {
    var display = cm.display,
        doc = cm.doc;
    var fragment = document.createDocumentFragment();
    var padding = paddingH(cm.display),
        leftSide = padding.left;
    var rightSide = Math.max(display.sizerWidth, displayWidth(cm) - display.sizer.offsetLeft) - padding.right;
    var docLTR = doc.direction == "ltr";

    function add(left, top, width, bottom) {
      if (top < 0) {
        top = 0;
      }

      top = Math.round(top);
      bottom = Math.round(bottom);
      fragment.appendChild(elt("div", null, "CodeMirror-selected", "position: absolute; left: " + left + "px;\n                             top: " + top + "px; width: " + (width == null ? rightSide - left : width) + "px;\n                             height: " + (bottom - top) + "px"));
    }

    function drawForLine(line, fromArg, toArg) {
      var lineObj = getLine(doc, line);
      var lineLen = lineObj.text.length;
      var start, end;

      function coords(ch, bias) {
        return _charCoords(cm, Pos(line, ch), "div", lineObj, bias);
      }

      function wrapX(pos, dir, side) {
        var extent = wrappedLineExtentChar(cm, lineObj, null, pos);
        var prop = dir == "ltr" == (side == "after") ? "left" : "right";
        var ch = side == "after" ? extent.begin : extent.end - (/\s/.test(lineObj.text.charAt(extent.end - 1)) ? 2 : 1);
        return coords(ch, prop)[prop];
      }

      var order = getOrder(lineObj, doc.direction);
      iterateBidiSections(order, fromArg || 0, toArg == null ? lineLen : toArg, function (from, to, dir, i) {
        var ltr = dir == "ltr";
        var fromPos = coords(from, ltr ? "left" : "right");
        var toPos = coords(to - 1, ltr ? "right" : "left");
        var openStart = fromArg == null && from == 0,
            openEnd = toArg == null && to == lineLen;
        var first = i == 0,
            last = !order || i == order.length - 1;

        if (toPos.top - fromPos.top <= 3) {
          // Single line
          var openLeft = (docLTR ? openStart : openEnd) && first;
          var openRight = (docLTR ? openEnd : openStart) && last;
          var left = openLeft ? leftSide : (ltr ? fromPos : toPos).left;
          var right = openRight ? rightSide : (ltr ? toPos : fromPos).right;
          add(left, fromPos.top, right - left, fromPos.bottom);
        } else {
          // Multiple lines
          var topLeft, topRight, botLeft, botRight;

          if (ltr) {
            topLeft = docLTR && openStart && first ? leftSide : fromPos.left;
            topRight = docLTR ? rightSide : wrapX(from, dir, "before");
            botLeft = docLTR ? leftSide : wrapX(to, dir, "after");
            botRight = docLTR && openEnd && last ? rightSide : toPos.right;
          } else {
            topLeft = !docLTR ? leftSide : wrapX(from, dir, "before");
            topRight = !docLTR && openStart && first ? rightSide : fromPos.right;
            botLeft = !docLTR && openEnd && last ? leftSide : toPos.left;
            botRight = !docLTR ? rightSide : wrapX(to, dir, "after");
          }

          add(topLeft, fromPos.top, topRight - topLeft, fromPos.bottom);

          if (fromPos.bottom < toPos.top) {
            add(leftSide, fromPos.bottom, null, toPos.top);
          }

          add(botLeft, toPos.top, botRight - botLeft, toPos.bottom);
        }

        if (!start || cmpCoords(fromPos, start) < 0) {
          start = fromPos;
        }

        if (cmpCoords(toPos, start) < 0) {
          start = toPos;
        }

        if (!end || cmpCoords(fromPos, end) < 0) {
          end = fromPos;
        }

        if (cmpCoords(toPos, end) < 0) {
          end = toPos;
        }
      });
      return {
        start: start,
        end: end
      };
    }

    var sFrom = range$$1.from(),
        sTo = range$$1.to();

    if (sFrom.line == sTo.line) {
      drawForLine(sFrom.line, sFrom.ch, sTo.ch);
    } else {
      var fromLine = getLine(doc, sFrom.line),
          toLine = getLine(doc, sTo.line);
      var singleVLine = visualLine(fromLine) == visualLine(toLine);
      var leftEnd = drawForLine(sFrom.line, sFrom.ch, singleVLine ? fromLine.text.length + 1 : null).end;
      var rightStart = drawForLine(sTo.line, singleVLine ? 0 : null, sTo.ch).start;

      if (singleVLine) {
        if (leftEnd.top < rightStart.top - 2) {
          add(leftEnd.right, leftEnd.top, null, leftEnd.bottom);
          add(leftSide, rightStart.top, rightStart.left, rightStart.bottom);
        } else {
          add(leftEnd.right, leftEnd.top, rightStart.left - leftEnd.right, leftEnd.bottom);
        }
      }

      if (leftEnd.bottom < rightStart.top) {
        add(leftSide, leftEnd.bottom, null, rightStart.top);
      }
    }

    output.appendChild(fragment);
  } // Cursor-blinking


  function restartBlink(cm) {
    if (!cm.state.focused) {
      return;
    }

    var display = cm.display;
    clearInterval(display.blinker);
    var on = true;
    display.cursorDiv.style.visibility = "";

    if (cm.options.cursorBlinkRate > 0) {
      display.blinker = setInterval(function () {
        return display.cursorDiv.style.visibility = (on = !on) ? "" : "hidden";
      }, cm.options.cursorBlinkRate);
    } else if (cm.options.cursorBlinkRate < 0) {
      display.cursorDiv.style.visibility = "hidden";
    }
  }

  function ensureFocus(cm) {
    if (!cm.state.focused) {
      cm.display.input.focus();
      onFocus(cm);
    }
  }

  function delayBlurEvent(cm) {
    cm.state.delayingBlurEvent = true;
    setTimeout(function () {
      if (cm.state.delayingBlurEvent) {
        cm.state.delayingBlurEvent = false;
        onBlur(cm);
      }
    }, 100);
  }

  function onFocus(cm, e) {
    if (cm.state.delayingBlurEvent) {
      cm.state.delayingBlurEvent = false;
    }

    if (cm.options.readOnly == "nocursor") {
      return;
    }

    if (!cm.state.focused) {
      signal(cm, "focus", cm, e);
      cm.state.focused = true;
      addClass(cm.display.wrapper, "CodeMirror-focused"); // This test prevents this from firing when a context
      // menu is closed (since the input reset would kill the
      // select-all detection hack)

      if (!cm.curOp && cm.display.selForContextMenu != cm.doc.sel) {
        cm.display.input.reset();

        if (webkit) {
          setTimeout(function () {
            return cm.display.input.reset(true);
          }, 20);
        } // Issue #1730

      }

      cm.display.input.receivedFocus();
    }

    restartBlink(cm);
  }

  function onBlur(cm, e) {
    if (cm.state.delayingBlurEvent) {
      return;
    }

    if (cm.state.focused) {
      signal(cm, "blur", cm, e);
      cm.state.focused = false;
      rmClass(cm.display.wrapper, "CodeMirror-focused");
    }

    clearInterval(cm.display.blinker);
    setTimeout(function () {
      if (!cm.state.focused) {
        cm.display.shift = false;
      }
    }, 150);
  } // Read the actual heights of the rendered lines, and update their
  // stored heights to match.


  function updateHeightsInViewport(cm) {
    var display = cm.display;
    var prevBottom = display.lineDiv.offsetTop;

    for (var i = 0; i < display.view.length; i++) {
      var cur = display.view[i],
          wrapping = cm.options.lineWrapping;
      var height = void 0,
          width = 0;

      if (cur.hidden) {
        continue;
      }

      if (ie && ie_version < 8) {
        var bot = cur.node.offsetTop + cur.node.offsetHeight;
        height = bot - prevBottom;
        prevBottom = bot;
      } else {
        var box = cur.node.getBoundingClientRect();
        height = box.bottom - box.top; // Check that lines don't extend past the right of the current
        // editor width

        if (!wrapping && cur.text.firstChild) {
          width = cur.text.firstChild.getBoundingClientRect().right - box.left - 1;
        }
      }

      var diff = cur.line.height - height;

      if (diff > .005 || diff < -.005) {
        updateLineHeight(cur.line, height);
        updateWidgetHeight(cur.line);

        if (cur.rest) {
          for (var j = 0; j < cur.rest.length; j++) {
            updateWidgetHeight(cur.rest[j]);
          }
        }
      }

      if (width > cm.display.sizerWidth) {
        var chWidth = Math.ceil(width / charWidth(cm.display));

        if (chWidth > cm.display.maxLineLength) {
          cm.display.maxLineLength = chWidth;
          cm.display.maxLine = cur.line;
          cm.display.maxLineChanged = true;
        }
      }
    }
  } // Read and store the height of line widgets associated with the
  // given line.


  function updateWidgetHeight(line) {
    if (line.widgets) {
      for (var i = 0; i < line.widgets.length; ++i) {
        var w = line.widgets[i],
            parent = w.node.parentNode;

        if (parent) {
          w.height = parent.offsetHeight;
        }
      }
    }
  } // Compute the lines that are visible in a given viewport (defaults
  // the the current scroll position). viewport may contain top,
  // height, and ensure (see op.scrollToPos) properties.


  function visibleLines(display, doc, viewport) {
    var top = viewport && viewport.top != null ? Math.max(0, viewport.top) : display.scroller.scrollTop;
    top = Math.floor(top - paddingTop(display));
    var bottom = viewport && viewport.bottom != null ? viewport.bottom : top + display.wrapper.clientHeight;

    var from = _lineAtHeight(doc, top),
        to = _lineAtHeight(doc, bottom); // Ensure is a {from: {line, ch}, to: {line, ch}} object, and
    // forces those lines into the viewport (if possible).


    if (viewport && viewport.ensure) {
      var ensureFrom = viewport.ensure.from.line,
          ensureTo = viewport.ensure.to.line;

      if (ensureFrom < from) {
        from = ensureFrom;
        to = _lineAtHeight(doc, _heightAtLine(getLine(doc, ensureFrom)) + display.wrapper.clientHeight);
      } else if (Math.min(ensureTo, doc.lastLine()) >= to) {
        from = _lineAtHeight(doc, _heightAtLine(getLine(doc, ensureTo)) - display.wrapper.clientHeight);
        to = ensureTo;
      }
    }

    return {
      from: from,
      to: Math.max(to, from + 1)
    };
  } // SCROLLING THINGS INTO VIEW
  // If an editor sits on the top or bottom of the window, partially
  // scrolled out of view, this ensures that the cursor is visible.


  function maybeScrollWindow(cm, rect) {
    if (signalDOMEvent(cm, "scrollCursorIntoView")) {
      return;
    }

    var display = cm.display,
        box = display.sizer.getBoundingClientRect(),
        doScroll = null;

    if (rect.top + box.top < 0) {
      doScroll = true;
    } else if (rect.bottom + box.top > (window.innerHeight || document.documentElement.clientHeight)) {
      doScroll = false;
    }

    if (doScroll != null && !phantom) {
      var scrollNode = elt("div", "\u200B", null, "position: absolute;\n                         top: " + (rect.top - display.viewOffset - paddingTop(cm.display)) + "px;\n                         height: " + (rect.bottom - rect.top + scrollGap(cm) + display.barHeight) + "px;\n                         left: " + rect.left + "px; width: " + Math.max(2, rect.right - rect.left) + "px;");
      cm.display.lineSpace.appendChild(scrollNode);
      scrollNode.scrollIntoView(doScroll);
      cm.display.lineSpace.removeChild(scrollNode);
    }
  } // Scroll a given position into view (immediately), verifying that
  // it actually became visible (as line heights are accurately
  // measured, the position of something may 'drift' during drawing).


  function scrollPosIntoView(cm, pos, end, margin) {
    if (margin == null) {
      margin = 0;
    }

    var rect;

    if (!cm.options.lineWrapping && pos == end) {
      // Set pos and end to the cursor positions around the character pos sticks to
      // If pos.sticky == "before", that is around pos.ch - 1, otherwise around pos.ch
      // If pos == Pos(_, 0, "before"), pos and end are unchanged
      pos = pos.ch ? Pos(pos.line, pos.sticky == "before" ? pos.ch - 1 : pos.ch, "after") : pos;
      end = pos.sticky == "before" ? Pos(pos.line, pos.ch + 1, "before") : pos;
    }

    for (var limit = 0; limit < 5; limit++) {
      var changed = false;

      var coords = _cursorCoords(cm, pos);

      var endCoords = !end || end == pos ? coords : _cursorCoords(cm, end);
      rect = {
        left: Math.min(coords.left, endCoords.left),
        top: Math.min(coords.top, endCoords.top) - margin,
        right: Math.max(coords.left, endCoords.left),
        bottom: Math.max(coords.bottom, endCoords.bottom) + margin
      };
      var scrollPos = calculateScrollPos(cm, rect);
      var startTop = cm.doc.scrollTop,
          startLeft = cm.doc.scrollLeft;

      if (scrollPos.scrollTop != null) {
        updateScrollTop(cm, scrollPos.scrollTop);

        if (Math.abs(cm.doc.scrollTop - startTop) > 1) {
          changed = true;
        }
      }

      if (scrollPos.scrollLeft != null) {
        setScrollLeft(cm, scrollPos.scrollLeft);

        if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) {
          changed = true;
        }
      }

      if (!changed) {
        break;
      }
    }

    return rect;
  } // Scroll a given set of coordinates into view (immediately).


  function scrollIntoView(cm, rect) {
    var scrollPos = calculateScrollPos(cm, rect);

    if (scrollPos.scrollTop != null) {
      updateScrollTop(cm, scrollPos.scrollTop);
    }

    if (scrollPos.scrollLeft != null) {
      setScrollLeft(cm, scrollPos.scrollLeft);
    }
  } // Calculate a new scroll position needed to scroll the given
  // rectangle into view. Returns an object with scrollTop and
  // scrollLeft properties. When these are undefined, the
  // vertical/horizontal position does not need to be adjusted.


  function calculateScrollPos(cm, rect) {
    var display = cm.display,
        snapMargin = textHeight(cm.display);

    if (rect.top < 0) {
      rect.top = 0;
    }

    var screentop = cm.curOp && cm.curOp.scrollTop != null ? cm.curOp.scrollTop : display.scroller.scrollTop;
    var screen = displayHeight(cm),
        result = {};

    if (rect.bottom - rect.top > screen) {
      rect.bottom = rect.top + screen;
    }

    var docBottom = cm.doc.height + paddingVert(display);
    var atTop = rect.top < snapMargin,
        atBottom = rect.bottom > docBottom - snapMargin;

    if (rect.top < screentop) {
      result.scrollTop = atTop ? 0 : rect.top;
    } else if (rect.bottom > screentop + screen) {
      var newTop = Math.min(rect.top, (atBottom ? docBottom : rect.bottom) - screen);

      if (newTop != screentop) {
        result.scrollTop = newTop;
      }
    }

    var screenleft = cm.curOp && cm.curOp.scrollLeft != null ? cm.curOp.scrollLeft : display.scroller.scrollLeft;
    var screenw = displayWidth(cm) - (cm.options.fixedGutter ? display.gutters.offsetWidth : 0);
    var tooWide = rect.right - rect.left > screenw;

    if (tooWide) {
      rect.right = rect.left + screenw;
    }

    if (rect.left < 10) {
      result.scrollLeft = 0;
    } else if (rect.left < screenleft) {
      result.scrollLeft = Math.max(0, rect.left - (tooWide ? 0 : 10));
    } else if (rect.right > screenw + screenleft - 3) {
      result.scrollLeft = rect.right + (tooWide ? 0 : 10) - screenw;
    }

    return result;
  } // Store a relative adjustment to the scroll position in the current
  // operation (to be applied when the operation finishes).


  function addToScrollTop(cm, top) {
    if (top == null) {
      return;
    }

    resolveScrollToPos(cm);
    cm.curOp.scrollTop = (cm.curOp.scrollTop == null ? cm.doc.scrollTop : cm.curOp.scrollTop) + top;
  } // Make sure that at the end of the operation the current cursor is
  // shown.


  function ensureCursorVisible(cm) {
    resolveScrollToPos(cm);
    var cur = cm.getCursor();
    cm.curOp.scrollToPos = {
      from: cur,
      to: cur,
      margin: cm.options.cursorScrollMargin
    };
  }

  function scrollToCoords(cm, x, y) {
    if (x != null || y != null) {
      resolveScrollToPos(cm);
    }

    if (x != null) {
      cm.curOp.scrollLeft = x;
    }

    if (y != null) {
      cm.curOp.scrollTop = y;
    }
  }

  function scrollToRange(cm, range$$1) {
    resolveScrollToPos(cm);
    cm.curOp.scrollToPos = range$$1;
  } // When an operation has its scrollToPos property set, and another
  // scroll action is applied before the end of the operation, this
  // 'simulates' scrolling that position into view in a cheap way, so
  // that the effect of intermediate scroll commands is not ignored.


  function resolveScrollToPos(cm) {
    var range$$1 = cm.curOp.scrollToPos;

    if (range$$1) {
      cm.curOp.scrollToPos = null;
      var from = estimateCoords(cm, range$$1.from),
          to = estimateCoords(cm, range$$1.to);
      scrollToCoordsRange(cm, from, to, range$$1.margin);
    }
  }

  function scrollToCoordsRange(cm, from, to, margin) {
    var sPos = calculateScrollPos(cm, {
      left: Math.min(from.left, to.left),
      top: Math.min(from.top, to.top) - margin,
      right: Math.max(from.right, to.right),
      bottom: Math.max(from.bottom, to.bottom) + margin
    });
    scrollToCoords(cm, sPos.scrollLeft, sPos.scrollTop);
  } // Sync the scrollable area and scrollbars, ensure the viewport
  // covers the visible area.


  function updateScrollTop(cm, val) {
    if (Math.abs(cm.doc.scrollTop - val) < 2) {
      return;
    }

    if (!gecko) {
      updateDisplaySimple(cm, {
        top: val
      });
    }

    setScrollTop(cm, val, true);

    if (gecko) {
      updateDisplaySimple(cm);
    }

    startWorker(cm, 100);
  }

  function setScrollTop(cm, val, forceScroll) {
    val = Math.min(cm.display.scroller.scrollHeight - cm.display.scroller.clientHeight, val);

    if (cm.display.scroller.scrollTop == val && !forceScroll) {
      return;
    }

    cm.doc.scrollTop = val;
    cm.display.scrollbars.setScrollTop(val);

    if (cm.display.scroller.scrollTop != val) {
      cm.display.scroller.scrollTop = val;
    }
  } // Sync scroller and scrollbar, ensure the gutter elements are
  // aligned.


  function setScrollLeft(cm, val, isScroller, forceScroll) {
    val = Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth);

    if ((isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) && !forceScroll) {
      return;
    }

    cm.doc.scrollLeft = val;
    alignHorizontally(cm);

    if (cm.display.scroller.scrollLeft != val) {
      cm.display.scroller.scrollLeft = val;
    }

    cm.display.scrollbars.setScrollLeft(val);
  } // SCROLLBARS
  // Prepare DOM reads needed to update the scrollbars. Done in one
  // shot to minimize update/measure roundtrips.


  function measureForScrollbars(cm) {
    var d = cm.display,
        gutterW = d.gutters.offsetWidth;
    var docH = Math.round(cm.doc.height + paddingVert(cm.display));
    return {
      clientHeight: d.scroller.clientHeight,
      viewHeight: d.wrapper.clientHeight,
      scrollWidth: d.scroller.scrollWidth,
      clientWidth: d.scroller.clientWidth,
      viewWidth: d.wrapper.clientWidth,
      barLeft: cm.options.fixedGutter ? gutterW : 0,
      docHeight: docH,
      scrollHeight: docH + scrollGap(cm) + d.barHeight,
      nativeBarWidth: d.nativeBarWidth,
      gutterWidth: gutterW
    };
  }

  var NativeScrollbars = function NativeScrollbars(place, scroll, cm) {
    this.cm = cm;
    var vert = this.vert = elt("div", [elt("div", null, null, "min-width: 1px")], "CodeMirror-vscrollbar");
    var horiz = this.horiz = elt("div", [elt("div", null, null, "height: 100%; min-height: 1px")], "CodeMirror-hscrollbar");
    vert.tabIndex = horiz.tabIndex = -1;
    place(vert);
    place(horiz);
    on(vert, "scroll", function () {
      if (vert.clientHeight) {
        scroll(vert.scrollTop, "vertical");
      }
    });
    on(horiz, "scroll", function () {
      if (horiz.clientWidth) {
        scroll(horiz.scrollLeft, "horizontal");
      }
    });
    this.checkedZeroWidth = false; // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).

    if (ie && ie_version < 8) {
      this.horiz.style.minHeight = this.vert.style.minWidth = "18px";
    }
  };

  NativeScrollbars.prototype.update = function (measure) {
    var needsH = measure.scrollWidth > measure.clientWidth + 1;
    var needsV = measure.scrollHeight > measure.clientHeight + 1;
    var sWidth = measure.nativeBarWidth;

    if (needsV) {
      this.vert.style.display = "block";
      this.vert.style.bottom = needsH ? sWidth + "px" : "0";
      var totalHeight = measure.viewHeight - (needsH ? sWidth : 0); // A bug in IE8 can cause this value to be negative, so guard it.

      this.vert.firstChild.style.height = Math.max(0, measure.scrollHeight - measure.clientHeight + totalHeight) + "px";
    } else {
      this.vert.style.display = "";
      this.vert.firstChild.style.height = "0";
    }

    if (needsH) {
      this.horiz.style.display = "block";
      this.horiz.style.right = needsV ? sWidth + "px" : "0";
      this.horiz.style.left = measure.barLeft + "px";
      var totalWidth = measure.viewWidth - measure.barLeft - (needsV ? sWidth : 0);
      this.horiz.firstChild.style.width = Math.max(0, measure.scrollWidth - measure.clientWidth + totalWidth) + "px";
    } else {
      this.horiz.style.display = "";
      this.horiz.firstChild.style.width = "0";
    }

    if (!this.checkedZeroWidth && measure.clientHeight > 0) {
      if (sWidth == 0) {
        this.zeroWidthHack();
      }

      this.checkedZeroWidth = true;
    }

    return {
      right: needsV ? sWidth : 0,
      bottom: needsH ? sWidth : 0
    };
  };

  NativeScrollbars.prototype.setScrollLeft = function (pos) {
    if (this.horiz.scrollLeft != pos) {
      this.horiz.scrollLeft = pos;
    }

    if (this.disableHoriz) {
      this.enableZeroWidthBar(this.horiz, this.disableHoriz, "horiz");
    }
  };

  NativeScrollbars.prototype.setScrollTop = function (pos) {
    if (this.vert.scrollTop != pos) {
      this.vert.scrollTop = pos;
    }

    if (this.disableVert) {
      this.enableZeroWidthBar(this.vert, this.disableVert, "vert");
    }
  };

  NativeScrollbars.prototype.zeroWidthHack = function () {
    var w = mac && !mac_geMountainLion ? "12px" : "18px";
    this.horiz.style.height = this.vert.style.width = w;
    this.horiz.style.pointerEvents = this.vert.style.pointerEvents = "none";
    this.disableHoriz = new Delayed();
    this.disableVert = new Delayed();
  };

  NativeScrollbars.prototype.enableZeroWidthBar = function (bar, delay, type) {
    bar.style.pointerEvents = "auto";

    function maybeDisable() {
      // To find out whether the scrollbar is still visible, we
      // check whether the element under the pixel in the bottom
      // right corner of the scrollbar box is the scrollbar box
      // itself (when the bar is still visible) or its filler child
      // (when the bar is hidden). If it is still visible, we keep
      // it enabled, if it's hidden, we disable pointer events.
      var box = bar.getBoundingClientRect();
      var elt$$1 = type == "vert" ? document.elementFromPoint(box.right - 1, (box.top + box.bottom) / 2) : document.elementFromPoint((box.right + box.left) / 2, box.bottom - 1);

      if (elt$$1 != bar) {
        bar.style.pointerEvents = "none";
      } else {
        delay.set(1000, maybeDisable);
      }
    }

    delay.set(1000, maybeDisable);
  };

  NativeScrollbars.prototype.clear = function () {
    var parent = this.horiz.parentNode;
    parent.removeChild(this.horiz);
    parent.removeChild(this.vert);
  };

  var NullScrollbars = function NullScrollbars() {};

  NullScrollbars.prototype.update = function () {
    return {
      bottom: 0,
      right: 0
    };
  };

  NullScrollbars.prototype.setScrollLeft = function () {};

  NullScrollbars.prototype.setScrollTop = function () {};

  NullScrollbars.prototype.clear = function () {};

  function updateScrollbars(cm, measure) {
    if (!measure) {
      measure = measureForScrollbars(cm);
    }

    var startWidth = cm.display.barWidth,
        startHeight = cm.display.barHeight;
    updateScrollbarsInner(cm, measure);

    for (var i = 0; i < 4 && startWidth != cm.display.barWidth || startHeight != cm.display.barHeight; i++) {
      if (startWidth != cm.display.barWidth && cm.options.lineWrapping) {
        updateHeightsInViewport(cm);
      }

      updateScrollbarsInner(cm, measureForScrollbars(cm));
      startWidth = cm.display.barWidth;
      startHeight = cm.display.barHeight;
    }
  } // Re-synchronize the fake scrollbars with the actual size of the
  // content.


  function updateScrollbarsInner(cm, measure) {
    var d = cm.display;
    var sizes = d.scrollbars.update(measure);
    d.sizer.style.paddingRight = (d.barWidth = sizes.right) + "px";
    d.sizer.style.paddingBottom = (d.barHeight = sizes.bottom) + "px";
    d.heightForcer.style.borderBottom = sizes.bottom + "px solid transparent";

    if (sizes.right && sizes.bottom) {
      d.scrollbarFiller.style.display = "block";
      d.scrollbarFiller.style.height = sizes.bottom + "px";
      d.scrollbarFiller.style.width = sizes.right + "px";
    } else {
      d.scrollbarFiller.style.display = "";
    }

    if (sizes.bottom && cm.options.coverGutterNextToScrollbar && cm.options.fixedGutter) {
      d.gutterFiller.style.display = "block";
      d.gutterFiller.style.height = sizes.bottom + "px";
      d.gutterFiller.style.width = measure.gutterWidth + "px";
    } else {
      d.gutterFiller.style.display = "";
    }
  }

  var scrollbarModel = {
    "native": NativeScrollbars,
    "null": NullScrollbars
  };

  function initScrollbars(cm) {
    if (cm.display.scrollbars) {
      cm.display.scrollbars.clear();

      if (cm.display.scrollbars.addClass) {
        rmClass(cm.display.wrapper, cm.display.scrollbars.addClass);
      }
    }

    cm.display.scrollbars = new scrollbarModel[cm.options.scrollbarStyle](function (node) {
      cm.display.wrapper.insertBefore(node, cm.display.scrollbarFiller); // Prevent clicks in the scrollbars from killing focus

      on(node, "mousedown", function () {
        if (cm.state.focused) {
          setTimeout(function () {
            return cm.display.input.focus();
          }, 0);
        }
      });
      node.setAttribute("cm-not-content", "true");
    }, function (pos, axis) {
      if (axis == "horizontal") {
        setScrollLeft(cm, pos);
      } else {
        updateScrollTop(cm, pos);
      }
    }, cm);

    if (cm.display.scrollbars.addClass) {
      addClass(cm.display.wrapper, cm.display.scrollbars.addClass);
    }
  } // Operations are used to wrap a series of changes to the editor
  // state in such a way that each change won't have to update the
  // cursor and display (which would be awkward, slow, and
  // error-prone). Instead, display updates are batched and then all
  // combined and executed at once.


  var nextOpId = 0; // Start a new operation.

  function _startOperation(cm) {
    cm.curOp = {
      cm: cm,
      viewChanged: false,
      // Flag that indicates that lines might need to be redrawn
      startHeight: cm.doc.height,
      // Used to detect need to update scrollbar
      forceUpdate: false,
      // Used to force a redraw
      updateInput: 0,
      // Whether to reset the input textarea
      typing: false,
      // Whether this reset should be careful to leave existing text (for compositing)
      changeObjs: null,
      // Accumulated changes, for firing change events
      cursorActivityHandlers: null,
      // Set of handlers to fire cursorActivity on
      cursorActivityCalled: 0,
      // Tracks which cursorActivity handlers have been called already
      selectionChanged: false,
      // Whether the selection needs to be redrawn
      updateMaxLine: false,
      // Set when the widest line needs to be determined anew
      scrollLeft: null,
      scrollTop: null,
      // Intermediate scroll position, not pushed to DOM yet
      scrollToPos: null,
      // Used to scroll to a specific position
      focus: false,
      id: ++nextOpId // Unique ID

    };
    pushOperation(cm.curOp);
  } // Finish an operation, updating the display and signalling delayed events


  function _endOperation(cm) {
    var op = cm.curOp;

    if (op) {
      finishOperation(op, function (group) {
        for (var i = 0; i < group.ops.length; i++) {
          group.ops[i].cm.curOp = null;
        }

        endOperations(group);
      });
    }
  } // The DOM updates done when an operation finishes are batched so
  // that the minimum number of relayouts are required.


  function endOperations(group) {
    var ops = group.ops;

    for (var i = 0; i < ops.length; i++) // Read DOM
    {
      endOperation_R1(ops[i]);
    }

    for (var i$1 = 0; i$1 < ops.length; i$1++) // Write DOM (maybe)
    {
      endOperation_W1(ops[i$1]);
    }

    for (var i$2 = 0; i$2 < ops.length; i$2++) // Read DOM
    {
      endOperation_R2(ops[i$2]);
    }

    for (var i$3 = 0; i$3 < ops.length; i$3++) // Write DOM (maybe)
    {
      endOperation_W2(ops[i$3]);
    }

    for (var i$4 = 0; i$4 < ops.length; i$4++) // Read DOM
    {
      endOperation_finish(ops[i$4]);
    }
  }

  function endOperation_R1(op) {
    var cm = op.cm,
        display = cm.display;
    maybeClipScrollbars(cm);

    if (op.updateMaxLine) {
      findMaxLine(cm);
    }

    op.mustUpdate = op.viewChanged || op.forceUpdate || op.scrollTop != null || op.scrollToPos && (op.scrollToPos.from.line < display.viewFrom || op.scrollToPos.to.line >= display.viewTo) || display.maxLineChanged && cm.options.lineWrapping;
    op.update = op.mustUpdate && new DisplayUpdate(cm, op.mustUpdate && {
      top: op.scrollTop,
      ensure: op.scrollToPos
    }, op.forceUpdate);
  }

  function endOperation_W1(op) {
    op.updatedDisplay = op.mustUpdate && updateDisplayIfNeeded(op.cm, op.update);
  }

  function endOperation_R2(op) {
    var cm = op.cm,
        display = cm.display;

    if (op.updatedDisplay) {
      updateHeightsInViewport(cm);
    }

    op.barMeasure = measureForScrollbars(cm); // If the max line changed since it was last measured, measure it,
    // and ensure the document's width matches it.
    // updateDisplay_W2 will use these properties to do the actual resizing

    if (display.maxLineChanged && !cm.options.lineWrapping) {
      op.adjustWidthTo = measureChar(cm, display.maxLine, display.maxLine.text.length).left + 3;
      cm.display.sizerWidth = op.adjustWidthTo;
      op.barMeasure.scrollWidth = Math.max(display.scroller.clientWidth, display.sizer.offsetLeft + op.adjustWidthTo + scrollGap(cm) + cm.display.barWidth);
      op.maxScrollLeft = Math.max(0, display.sizer.offsetLeft + op.adjustWidthTo - displayWidth(cm));
    }

    if (op.updatedDisplay || op.selectionChanged) {
      op.preparedSelection = display.input.prepareSelection();
    }
  }

  function endOperation_W2(op) {
    var cm = op.cm;

    if (op.adjustWidthTo != null) {
      cm.display.sizer.style.minWidth = op.adjustWidthTo + "px";

      if (op.maxScrollLeft < cm.doc.scrollLeft) {
        setScrollLeft(cm, Math.min(cm.display.scroller.scrollLeft, op.maxScrollLeft), true);
      }

      cm.display.maxLineChanged = false;
    }

    var takeFocus = op.focus && op.focus == activeElt();

    if (op.preparedSelection) {
      cm.display.input.showSelection(op.preparedSelection, takeFocus);
    }

    if (op.updatedDisplay || op.startHeight != cm.doc.height) {
      updateScrollbars(cm, op.barMeasure);
    }

    if (op.updatedDisplay) {
      setDocumentHeight(cm, op.barMeasure);
    }

    if (op.selectionChanged) {
      restartBlink(cm);
    }

    if (cm.state.focused && op.updateInput) {
      cm.display.input.reset(op.typing);
    }

    if (takeFocus) {
      ensureFocus(op.cm);
    }
  }

  function endOperation_finish(op) {
    var cm = op.cm,
        display = cm.display,
        doc = cm.doc;

    if (op.updatedDisplay) {
      postUpdateDisplay(cm, op.update);
    } // Abort mouse wheel delta measurement, when scrolling explicitly


    if (display.wheelStartX != null && (op.scrollTop != null || op.scrollLeft != null || op.scrollToPos)) {
      display.wheelStartX = display.wheelStartY = null;
    } // Propagate the scroll position to the actual DOM scroller


    if (op.scrollTop != null) {
      setScrollTop(cm, op.scrollTop, op.forceScroll);
    }

    if (op.scrollLeft != null) {
      setScrollLeft(cm, op.scrollLeft, true, true);
    } // If we need to scroll a specific position into view, do so.


    if (op.scrollToPos) {
      var rect = scrollPosIntoView(cm, _clipPos(doc, op.scrollToPos.from), _clipPos(doc, op.scrollToPos.to), op.scrollToPos.margin);
      maybeScrollWindow(cm, rect);
    } // Fire events for markers that are hidden/unidden by editing or
    // undoing


    var hidden = op.maybeHiddenMarkers,
        unhidden = op.maybeUnhiddenMarkers;

    if (hidden) {
      for (var i = 0; i < hidden.length; ++i) {
        if (!hidden[i].lines.length) {
          signal(hidden[i], "hide");
        }
      }
    }

    if (unhidden) {
      for (var i$1 = 0; i$1 < unhidden.length; ++i$1) {
        if (unhidden[i$1].lines.length) {
          signal(unhidden[i$1], "unhide");
        }
      }
    }

    if (display.wrapper.offsetHeight) {
      doc.scrollTop = cm.display.scroller.scrollTop;
    } // Fire change events, and delayed event handlers


    if (op.changeObjs) {
      signal(cm, "changes", cm, op.changeObjs);
    }

    if (op.update) {
      op.update.finish();
    }
  } // Run the given function in an operation


  function runInOp(cm, f) {
    if (cm.curOp) {
      return f();
    }

    _startOperation(cm);

    try {
      return f();
    } finally {
      _endOperation(cm);
    }
  } // Wraps a function in an operation. Returns the wrapped function.


  function operation(cm, f) {
    return function () {
      if (cm.curOp) {
        return f.apply(cm, arguments);
      }

      _startOperation(cm);

      try {
        return f.apply(cm, arguments);
      } finally {
        _endOperation(cm);
      }
    };
  } // Used to add methods to editor and doc instances, wrapping them in
  // operations.


  function methodOp(f) {
    return function () {
      if (this.curOp) {
        return f.apply(this, arguments);
      }

      _startOperation(this);

      try {
        return f.apply(this, arguments);
      } finally {
        _endOperation(this);
      }
    };
  }

  function docMethodOp(f) {
    return function () {
      var cm = this.cm;

      if (!cm || cm.curOp) {
        return f.apply(this, arguments);
      }

      _startOperation(cm);

      try {
        return f.apply(this, arguments);
      } finally {
        _endOperation(cm);
      }
    };
  } // HIGHLIGHT WORKER


  function startWorker(cm, time) {
    if (cm.doc.highlightFrontier < cm.display.viewTo) {
      cm.state.highlight.set(time, bind(highlightWorker, cm));
    }
  }

  function highlightWorker(cm) {
    var doc = cm.doc;

    if (doc.highlightFrontier >= cm.display.viewTo) {
      return;
    }

    var end = +new Date() + cm.options.workTime;
    var context = getContextBefore(cm, doc.highlightFrontier);
    var changedLines = [];
    doc.iter(context.line, Math.min(doc.first + doc.size, cm.display.viewTo + 500), function (line) {
      if (context.line >= cm.display.viewFrom) {
        // Visible
        var oldStyles = line.styles;
        var resetState = line.text.length > cm.options.maxHighlightLength ? copyState(doc.mode, context.state) : null;
        var highlighted = highlightLine(cm, line, context, true);

        if (resetState) {
          context.state = resetState;
        }

        line.styles = highlighted.styles;
        var oldCls = line.styleClasses,
            newCls = highlighted.classes;

        if (newCls) {
          line.styleClasses = newCls;
        } else if (oldCls) {
          line.styleClasses = null;
        }

        var ischange = !oldStyles || oldStyles.length != line.styles.length || oldCls != newCls && (!oldCls || !newCls || oldCls.bgClass != newCls.bgClass || oldCls.textClass != newCls.textClass);

        for (var i = 0; !ischange && i < oldStyles.length; ++i) {
          ischange = oldStyles[i] != line.styles[i];
        }

        if (ischange) {
          changedLines.push(context.line);
        }

        line.stateAfter = context.save();
        context.nextLine();
      } else {
        if (line.text.length <= cm.options.maxHighlightLength) {
          processLine(cm, line.text, context);
        }

        line.stateAfter = context.line % 5 == 0 ? context.save() : null;
        context.nextLine();
      }

      if (+new Date() > end) {
        startWorker(cm, cm.options.workDelay);
        return true;
      }
    });
    doc.highlightFrontier = context.line;
    doc.modeFrontier = Math.max(doc.modeFrontier, context.line);

    if (changedLines.length) {
      runInOp(cm, function () {
        for (var i = 0; i < changedLines.length; i++) {
          regLineChange(cm, changedLines[i], "text");
        }
      });
    }
  } // DISPLAY DRAWING


  var DisplayUpdate = function DisplayUpdate(cm, viewport, force) {
    var display = cm.display;
    this.viewport = viewport; // Store some values that we'll need later (but don't want to force a relayout for)

    this.visible = visibleLines(display, cm.doc, viewport);
    this.editorIsHidden = !display.wrapper.offsetWidth;
    this.wrapperHeight = display.wrapper.clientHeight;
    this.wrapperWidth = display.wrapper.clientWidth;
    this.oldDisplayWidth = displayWidth(cm);
    this.force = force;
    this.dims = getDimensions(cm);
    this.events = [];
  };

  DisplayUpdate.prototype.signal = function (emitter, type) {
    if (hasHandler(emitter, type)) {
      this.events.push(arguments);
    }
  };

  DisplayUpdate.prototype.finish = function () {
    var this$1 = this;

    for (var i = 0; i < this.events.length; i++) {
      signal.apply(null, this$1.events[i]);
    }
  };

  function maybeClipScrollbars(cm) {
    var display = cm.display;

    if (!display.scrollbarsClipped && display.scroller.offsetWidth) {
      display.nativeBarWidth = display.scroller.offsetWidth - display.scroller.clientWidth;
      display.heightForcer.style.height = scrollGap(cm) + "px";
      display.sizer.style.marginBottom = -display.nativeBarWidth + "px";
      display.sizer.style.borderRightWidth = scrollGap(cm) + "px";
      display.scrollbarsClipped = true;
    }
  }

  function selectionSnapshot(cm) {
    if (cm.hasFocus()) {
      return null;
    }

    var active = activeElt();

    if (!active || !contains(cm.display.lineDiv, active)) {
      return null;
    }

    var result = {
      activeElt: active
    };

    if (window.getSelection) {
      var sel = window.getSelection();

      if (sel.anchorNode && sel.extend && contains(cm.display.lineDiv, sel.anchorNode)) {
        result.anchorNode = sel.anchorNode;
        result.anchorOffset = sel.anchorOffset;
        result.focusNode = sel.focusNode;
        result.focusOffset = sel.focusOffset;
      }
    }

    return result;
  }

  function restoreSelection(snapshot) {
    if (!snapshot || !snapshot.activeElt || snapshot.activeElt == activeElt()) {
      return;
    }

    snapshot.activeElt.focus();

    if (snapshot.anchorNode && contains(document.body, snapshot.anchorNode) && contains(document.body, snapshot.focusNode)) {
      var sel = window.getSelection(),
          range$$1 = document.createRange();
      range$$1.setEnd(snapshot.anchorNode, snapshot.anchorOffset);
      range$$1.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range$$1);
      sel.extend(snapshot.focusNode, snapshot.focusOffset);
    }
  } // Does the actual updating of the line display. Bails out
  // (returning false) when there is nothing to be done and forced is
  // false.


  function updateDisplayIfNeeded(cm, update) {
    var display = cm.display,
        doc = cm.doc;

    if (update.editorIsHidden) {
      resetView(cm);
      return false;
    } // Bail out if the visible area is already rendered and nothing changed.


    if (!update.force && update.visible.from >= display.viewFrom && update.visible.to <= display.viewTo && (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo) && display.renderedView == display.view && countDirtyView(cm) == 0) {
      return false;
    }

    if (maybeUpdateLineNumberWidth(cm)) {
      resetView(cm);
      update.dims = getDimensions(cm);
    } // Compute a suitable new viewport (from & to)


    var end = doc.first + doc.size;
    var from = Math.max(update.visible.from - cm.options.viewportMargin, doc.first);
    var to = Math.min(end, update.visible.to + cm.options.viewportMargin);

    if (display.viewFrom < from && from - display.viewFrom < 20) {
      from = Math.max(doc.first, display.viewFrom);
    }

    if (display.viewTo > to && display.viewTo - to < 20) {
      to = Math.min(end, display.viewTo);
    }

    if (sawCollapsedSpans) {
      from = visualLineNo(cm.doc, from);
      to = visualLineEndNo(cm.doc, to);
    }

    var different = from != display.viewFrom || to != display.viewTo || display.lastWrapHeight != update.wrapperHeight || display.lastWrapWidth != update.wrapperWidth;
    adjustView(cm, from, to);
    display.viewOffset = _heightAtLine(getLine(cm.doc, display.viewFrom)); // Position the mover div to align with the current scroll position

    cm.display.mover.style.top = display.viewOffset + "px";
    var toUpdate = countDirtyView(cm);

    if (!different && toUpdate == 0 && !update.force && display.renderedView == display.view && (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo)) {
      return false;
    } // For big changes, we hide the enclosing element during the
    // update, since that speeds up the operations on most browsers.


    var selSnapshot = selectionSnapshot(cm);

    if (toUpdate > 4) {
      display.lineDiv.style.display = "none";
    }

    patchDisplay(cm, display.updateLineNumbers, update.dims);

    if (toUpdate > 4) {
      display.lineDiv.style.display = "";
    }

    display.renderedView = display.view; // There might have been a widget with a focused element that got
    // hidden or updated, if so re-focus it.

    restoreSelection(selSnapshot); // Prevent selection and cursors from interfering with the scroll
    // width and height.

    removeChildren(display.cursorDiv);
    removeChildren(display.selectionDiv);
    display.gutters.style.height = display.sizer.style.minHeight = 0;

    if (different) {
      display.lastWrapHeight = update.wrapperHeight;
      display.lastWrapWidth = update.wrapperWidth;
      startWorker(cm, 400);
    }

    display.updateLineNumbers = null;
    return true;
  }

  function postUpdateDisplay(cm, update) {
    var viewport = update.viewport;

    for (var first = true;; first = false) {
      if (!first || !cm.options.lineWrapping || update.oldDisplayWidth == displayWidth(cm)) {
        // Clip forced viewport to actual scrollable area.
        if (viewport && viewport.top != null) {
          viewport = {
            top: Math.min(cm.doc.height + paddingVert(cm.display) - displayHeight(cm), viewport.top)
          };
        } // Updated line heights might result in the drawn area not
        // actually covering the viewport. Keep looping until it does.


        update.visible = visibleLines(cm.display, cm.doc, viewport);

        if (update.visible.from >= cm.display.viewFrom && update.visible.to <= cm.display.viewTo) {
          break;
        }
      }

      if (!updateDisplayIfNeeded(cm, update)) {
        break;
      }

      updateHeightsInViewport(cm);
      var barMeasure = measureForScrollbars(cm);
      updateSelection(cm);
      updateScrollbars(cm, barMeasure);
      setDocumentHeight(cm, barMeasure);
      update.force = false;
    }

    update.signal(cm, "update", cm);

    if (cm.display.viewFrom != cm.display.reportedViewFrom || cm.display.viewTo != cm.display.reportedViewTo) {
      update.signal(cm, "viewportChange", cm, cm.display.viewFrom, cm.display.viewTo);
      cm.display.reportedViewFrom = cm.display.viewFrom;
      cm.display.reportedViewTo = cm.display.viewTo;
    }
  }

  function updateDisplaySimple(cm, viewport) {
    var update = new DisplayUpdate(cm, viewport);

    if (updateDisplayIfNeeded(cm, update)) {
      updateHeightsInViewport(cm);
      postUpdateDisplay(cm, update);
      var barMeasure = measureForScrollbars(cm);
      updateSelection(cm);
      updateScrollbars(cm, barMeasure);
      setDocumentHeight(cm, barMeasure);
      update.finish();
    }
  } // Sync the actual display DOM structure with display.view, removing
  // nodes for lines that are no longer in view, and creating the ones
  // that are not there yet, and updating the ones that are out of
  // date.


  function patchDisplay(cm, updateNumbersFrom, dims) {
    var display = cm.display,
        lineNumbers = cm.options.lineNumbers;
    var container = display.lineDiv,
        cur = container.firstChild;

    function rm(node) {
      var next = node.nextSibling; // Works around a throw-scroll bug in OS X Webkit

      if (webkit && mac && cm.display.currentWheelTarget == node) {
        node.style.display = "none";
      } else {
        node.parentNode.removeChild(node);
      }

      return next;
    }

    var view = display.view,
        lineN = display.viewFrom; // Loop over the elements in the view, syncing cur (the DOM nodes
    // in display.lineDiv) with the view as we go.

    for (var i = 0; i < view.length; i++) {
      var lineView = view[i];
      if (lineView.hidden) ;else if (!lineView.node || lineView.node.parentNode != container) {
        // Not drawn yet
        var node = buildLineElement(cm, lineView, lineN, dims);
        container.insertBefore(node, cur);
      } else {
        // Already drawn
        while (cur != lineView.node) {
          cur = rm(cur);
        }

        var updateNumber = lineNumbers && updateNumbersFrom != null && updateNumbersFrom <= lineN && lineView.lineNumber;

        if (lineView.changes) {
          if (indexOf(lineView.changes, "gutter") > -1) {
            updateNumber = false;
          }

          updateLineForChanges(cm, lineView, lineN, dims);
        }

        if (updateNumber) {
          removeChildren(lineView.lineNumber);
          lineView.lineNumber.appendChild(document.createTextNode(lineNumberFor(cm.options, lineN)));
        }

        cur = lineView.node.nextSibling;
      }
      lineN += lineView.size;
    }

    while (cur) {
      cur = rm(cur);
    }
  }

  function updateGutterSpace(display) {
    var width = display.gutters.offsetWidth;
    display.sizer.style.marginLeft = width + "px";
  }

  function setDocumentHeight(cm, measure) {
    cm.display.sizer.style.minHeight = measure.docHeight + "px";
    cm.display.heightForcer.style.top = measure.docHeight + "px";
    cm.display.gutters.style.height = measure.docHeight + cm.display.barHeight + scrollGap(cm) + "px";
  } // Re-align line numbers and gutter marks to compensate for
  // horizontal scrolling.


  function alignHorizontally(cm) {
    var display = cm.display,
        view = display.view;

    if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) {
      return;
    }

    var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft;
    var gutterW = display.gutters.offsetWidth,
        left = comp + "px";

    for (var i = 0; i < view.length; i++) {
      if (!view[i].hidden) {
        if (cm.options.fixedGutter) {
          if (view[i].gutter) {
            view[i].gutter.style.left = left;
          }

          if (view[i].gutterBackground) {
            view[i].gutterBackground.style.left = left;
          }
        }

        var align = view[i].alignable;

        if (align) {
          for (var j = 0; j < align.length; j++) {
            align[j].style.left = left;
          }
        }
      }
    }

    if (cm.options.fixedGutter) {
      display.gutters.style.left = comp + gutterW + "px";
    }
  } // Used to ensure that the line number gutter is still the right
  // size for the current document size. Returns true when an update
  // is needed.


  function maybeUpdateLineNumberWidth(cm) {
    if (!cm.options.lineNumbers) {
      return false;
    }

    var doc = cm.doc,
        last = lineNumberFor(cm.options, doc.first + doc.size - 1),
        display = cm.display;

    if (last.length != display.lineNumChars) {
      var test = display.measure.appendChild(elt("div", [elt("div", last)], "CodeMirror-linenumber CodeMirror-gutter-elt"));
      var innerW = test.firstChild.offsetWidth,
          padding = test.offsetWidth - innerW;
      display.lineGutter.style.width = "";
      display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding) + 1;
      display.lineNumWidth = display.lineNumInnerWidth + padding;
      display.lineNumChars = display.lineNumInnerWidth ? last.length : -1;
      display.lineGutter.style.width = display.lineNumWidth + "px";
      updateGutterSpace(cm.display);
      return true;
    }

    return false;
  }

  function getGutters(gutters, lineNumbers) {
    var result = [],
        sawLineNumbers = false;

    for (var i = 0; i < gutters.length; i++) {
      var name = gutters[i],
          style = null;

      if (typeof name != "string") {
        style = name.style;
        name = name.className;
      }

      if (name == "CodeMirror-linenumbers") {
        if (!lineNumbers) {
          continue;
        } else {
          sawLineNumbers = true;
        }
      }

      result.push({
        className: name,
        style: style
      });
    }

    if (lineNumbers && !sawLineNumbers) {
      result.push({
        className: "CodeMirror-linenumbers",
        style: null
      });
    }

    return result;
  } // Rebuild the gutter elements, ensure the margin to the left of the
  // code matches their width.


  function renderGutters(display) {
    var gutters = display.gutters,
        specs = display.gutterSpecs;
    removeChildren(gutters);
    display.lineGutter = null;

    for (var i = 0; i < specs.length; ++i) {
      var ref = specs[i];
      var className = ref.className;
      var style = ref.style;
      var gElt = gutters.appendChild(elt("div", null, "CodeMirror-gutter " + className));

      if (style) {
        gElt.style.cssText = style;
      }

      if (className == "CodeMirror-linenumbers") {
        display.lineGutter = gElt;
        gElt.style.width = (display.lineNumWidth || 1) + "px";
      }
    }

    gutters.style.display = specs.length ? "" : "none";
    updateGutterSpace(display);
  }

  function updateGutters(cm) {
    renderGutters(cm.display);
    regChange(cm);
    alignHorizontally(cm);
  } // The display handles the DOM integration, both for input reading
  // and content drawing. It holds references to DOM nodes and
  // display-related state.


  function Display(place, doc, input, options) {
    var d = this;
    this.input = input; // Covers bottom-right square when both scrollbars are present.

    d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler");
    d.scrollbarFiller.setAttribute("cm-not-content", "true"); // Covers bottom of gutter when coverGutterNextToScrollbar is on
    // and h scrollbar is present.

    d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler");
    d.gutterFiller.setAttribute("cm-not-content", "true"); // Will contain the actual code, positioned to cover the viewport.

    d.lineDiv = eltP("div", null, "CodeMirror-code"); // Elements are added to these to represent selection and cursors.

    d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1");
    d.cursorDiv = elt("div", null, "CodeMirror-cursors"); // A visibility: hidden element used to find the size of things.

    d.measure = elt("div", null, "CodeMirror-measure"); // When lines outside of the viewport are measured, they are drawn in this.

    d.lineMeasure = elt("div", null, "CodeMirror-measure"); // Wraps everything that needs to exist inside the vertically-padded coordinate system

    d.lineSpace = eltP("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv], null, "position: relative; outline: none");
    var lines = eltP("div", [d.lineSpace], "CodeMirror-lines"); // Moved around its parent to cover visible view.

    d.mover = elt("div", [lines], null, "position: relative"); // Set to the height of the document, allowing scrolling.

    d.sizer = elt("div", [d.mover], "CodeMirror-sizer");
    d.sizerWidth = null; // Behavior of elts with overflow: auto and padding is
    // inconsistent across browsers. This is used to ensure the
    // scrollable area is big enough.

    d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;"); // Will contain the gutters, if any.

    d.gutters = elt("div", null, "CodeMirror-gutters");
    d.lineGutter = null; // Actual scrollable element.

    d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll");
    d.scroller.setAttribute("tabIndex", "-1"); // The element in which the editor lives.

    d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror"); // Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)

    if (ie && ie_version < 8) {
      d.gutters.style.zIndex = -1;
      d.scroller.style.paddingRight = 0;
    }

    if (!webkit && !(gecko && mobile)) {
      d.scroller.draggable = true;
    }

    if (place) {
      if (place.appendChild) {
        place.appendChild(d.wrapper);
      } else {
        place(d.wrapper);
      }
    } // Current rendered range (may be bigger than the view window).


    d.viewFrom = d.viewTo = doc.first;
    d.reportedViewFrom = d.reportedViewTo = doc.first; // Information about the rendered lines.

    d.view = [];
    d.renderedView = null; // Holds info about a single rendered line when it was rendered
    // for measurement, while not in view.

    d.externalMeasured = null; // Empty space (in pixels) above the view

    d.viewOffset = 0;
    d.lastWrapHeight = d.lastWrapWidth = 0;
    d.updateLineNumbers = null;
    d.nativeBarWidth = d.barHeight = d.barWidth = 0;
    d.scrollbarsClipped = false; // Used to only resize the line number gutter when necessary (when
    // the amount of lines crosses a boundary that makes its width change)

    d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null; // Set to true when a non-horizontal-scrolling line widget is
    // added. As an optimization, line widget aligning is skipped when
    // this is false.

    d.alignWidgets = false;
    d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null; // Tracks the maximum line length so that the horizontal scrollbar
    // can be kept static when scrolling.

    d.maxLine = null;
    d.maxLineLength = 0;
    d.maxLineChanged = false; // Used for measuring wheel scrolling granularity

    d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null; // True when shift is held down.

    d.shift = false; // Used to track whether anything happened since the context menu
    // was opened.

    d.selForContextMenu = null;
    d.activeTouch = null;
    d.gutterSpecs = getGutters(options.gutters, options.lineNumbers);
    renderGutters(d);
    input.init(d);
  } // Since the delta values reported on mouse wheel events are
  // unstandardized between browsers and even browser versions, and
  // generally horribly unpredictable, this code starts by measuring
  // the scroll effect that the first few mouse wheel events have,
  // and, from that, detects the way it can convert deltas to pixel
  // offsets afterwards.
  //
  // The reason we want to know the amount a wheel event will scroll
  // is that it gives us a chance to update the display before the
  // actual scrolling happens, reducing flickering.


  var wheelSamples = 0,
      wheelPixelsPerUnit = null; // Fill in a browser-detected starting value on browsers where we
  // know one. These don't have to be accurate -- the result of them
  // being wrong would just be a slight flicker on the first wheel
  // scroll (if it is large enough).

  if (ie) {
    wheelPixelsPerUnit = -.53;
  } else if (gecko) {
    wheelPixelsPerUnit = 15;
  } else if (chrome) {
    wheelPixelsPerUnit = -.7;
  } else if (safari) {
    wheelPixelsPerUnit = -1 / 3;
  }

  function wheelEventDelta(e) {
    var dx = e.wheelDeltaX,
        dy = e.wheelDeltaY;

    if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) {
      dx = e.detail;
    }

    if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) {
      dy = e.detail;
    } else if (dy == null) {
      dy = e.wheelDelta;
    }

    return {
      x: dx,
      y: dy
    };
  }

  function wheelEventPixels(e) {
    var delta = wheelEventDelta(e);
    delta.x *= wheelPixelsPerUnit;
    delta.y *= wheelPixelsPerUnit;
    return delta;
  }

  function onScrollWheel(cm, e) {
    var delta = wheelEventDelta(e),
        dx = delta.x,
        dy = delta.y;
    var display = cm.display,
        scroll = display.scroller; // Quit if there's nothing to scroll here

    var canScrollX = scroll.scrollWidth > scroll.clientWidth;
    var canScrollY = scroll.scrollHeight > scroll.clientHeight;

    if (!(dx && canScrollX || dy && canScrollY)) {
      return;
    } // Webkit browsers on OS X abort momentum scrolls when the target
    // of the scroll event is removed from the scrollable element.
    // This hack (see related code in patchDisplay) makes sure the
    // element is kept around.


    if (dy && mac && webkit) {
      outer: for (var cur = e.target, view = display.view; cur != scroll; cur = cur.parentNode) {
        for (var i = 0; i < view.length; i++) {
          if (view[i].node == cur) {
            cm.display.currentWheelTarget = cur;
            break outer;
          }
        }
      }
    } // On some browsers, horizontal scrolling will cause redraws to
    // happen before the gutter has been realigned, causing it to
    // wriggle around in a most unseemly way. When we have an
    // estimated pixels/delta value, we just handle horizontal
    // scrolling entirely here. It'll be slightly off from native, but
    // better than glitching out.


    if (dx && !gecko && !presto && wheelPixelsPerUnit != null) {
      if (dy && canScrollY) {
        updateScrollTop(cm, Math.max(0, scroll.scrollTop + dy * wheelPixelsPerUnit));
      }

      setScrollLeft(cm, Math.max(0, scroll.scrollLeft + dx * wheelPixelsPerUnit)); // Only prevent default scrolling if vertical scrolling is
      // actually possible. Otherwise, it causes vertical scroll
      // jitter on OSX trackpads when deltaX is small and deltaY
      // is large (issue #3579)

      if (!dy || dy && canScrollY) {
        e_preventDefault(e);
      }

      display.wheelStartX = null; // Abort measurement, if in progress

      return;
    } // 'Project' the visible viewport to cover the area that is being
    // scrolled into view (if we know enough to estimate it).


    if (dy && wheelPixelsPerUnit != null) {
      var pixels = dy * wheelPixelsPerUnit;
      var top = cm.doc.scrollTop,
          bot = top + display.wrapper.clientHeight;

      if (pixels < 0) {
        top = Math.max(0, top + pixels - 50);
      } else {
        bot = Math.min(cm.doc.height, bot + pixels + 50);
      }

      updateDisplaySimple(cm, {
        top: top,
        bottom: bot
      });
    }

    if (wheelSamples < 20) {
      if (display.wheelStartX == null) {
        display.wheelStartX = scroll.scrollLeft;
        display.wheelStartY = scroll.scrollTop;
        display.wheelDX = dx;
        display.wheelDY = dy;
        setTimeout(function () {
          if (display.wheelStartX == null) {
            return;
          }

          var movedX = scroll.scrollLeft - display.wheelStartX;
          var movedY = scroll.scrollTop - display.wheelStartY;
          var sample = movedY && display.wheelDY && movedY / display.wheelDY || movedX && display.wheelDX && movedX / display.wheelDX;
          display.wheelStartX = display.wheelStartY = null;

          if (!sample) {
            return;
          }

          wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1);
          ++wheelSamples;
        }, 200);
      } else {
        display.wheelDX += dx;
        display.wheelDY += dy;
      }
    }
  } // Selection objects are immutable. A new one is created every time
  // the selection changes. A selection is one or more non-overlapping
  // (and non-touching) ranges, sorted, and an integer that indicates
  // which one is the primary selection (the one that's scrolled into
  // view, that getCursor returns, etc).


  var Selection = function Selection(ranges, primIndex) {
    this.ranges = ranges;
    this.primIndex = primIndex;
  };

  Selection.prototype.primary = function () {
    return this.ranges[this.primIndex];
  };

  Selection.prototype.equals = function (other) {
    var this$1 = this;

    if (other == this) {
      return true;
    }

    if (other.primIndex != this.primIndex || other.ranges.length != this.ranges.length) {
      return false;
    }

    for (var i = 0; i < this.ranges.length; i++) {
      var here = this$1.ranges[i],
          there = other.ranges[i];

      if (!equalCursorPos(here.anchor, there.anchor) || !equalCursorPos(here.head, there.head)) {
        return false;
      }
    }

    return true;
  };

  Selection.prototype.deepCopy = function () {
    var this$1 = this;
    var out = [];

    for (var i = 0; i < this.ranges.length; i++) {
      out[i] = new Range(copyPos(this$1.ranges[i].anchor), copyPos(this$1.ranges[i].head));
    }

    return new Selection(out, this.primIndex);
  };

  Selection.prototype.somethingSelected = function () {
    var this$1 = this;

    for (var i = 0; i < this.ranges.length; i++) {
      if (!this$1.ranges[i].empty()) {
        return true;
      }
    }

    return false;
  };

  Selection.prototype.contains = function (pos, end) {
    var this$1 = this;

    if (!end) {
      end = pos;
    }

    for (var i = 0; i < this.ranges.length; i++) {
      var range = this$1.ranges[i];

      if (cmp(end, range.from()) >= 0 && cmp(pos, range.to()) <= 0) {
        return i;
      }
    }

    return -1;
  };

  var Range = function Range(anchor, head) {
    this.anchor = anchor;
    this.head = head;
  };

  Range.prototype.from = function () {
    return minPos(this.anchor, this.head);
  };

  Range.prototype.to = function () {
    return maxPos(this.anchor, this.head);
  };

  Range.prototype.empty = function () {
    return this.head.line == this.anchor.line && this.head.ch == this.anchor.ch;
  }; // Take an unsorted, potentially overlapping set of ranges, and
  // build a selection out of it. 'Consumes' ranges array (modifying
  // it).


  function normalizeSelection(cm, ranges, primIndex) {
    var mayTouch = cm && cm.options.selectionsMayTouch;
    var prim = ranges[primIndex];
    ranges.sort(function (a, b) {
      return cmp(a.from(), b.from());
    });
    primIndex = indexOf(ranges, prim);

    for (var i = 1; i < ranges.length; i++) {
      var cur = ranges[i],
          prev = ranges[i - 1];
      var diff = cmp(prev.to(), cur.from());

      if (mayTouch && !cur.empty() ? diff > 0 : diff >= 0) {
        var from = minPos(prev.from(), cur.from()),
            to = maxPos(prev.to(), cur.to());
        var inv = prev.empty() ? cur.from() == cur.head : prev.from() == prev.head;

        if (i <= primIndex) {
          --primIndex;
        }

        ranges.splice(--i, 2, new Range(inv ? to : from, inv ? from : to));
      }
    }

    return new Selection(ranges, primIndex);
  }

  function simpleSelection(anchor, head) {
    return new Selection([new Range(anchor, head || anchor)], 0);
  } // Compute the position of the end of a change (its 'to' property
  // refers to the pre-change end).


  function changeEnd(change) {
    if (!change.text) {
      return change.to;
    }

    return Pos(change.from.line + change.text.length - 1, lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0));
  } // Adjust a position to refer to the post-change position of the
  // same text, or the end of the change if the change covers it.


  function adjustForChange(pos, change) {
    if (cmp(pos, change.from) < 0) {
      return pos;
    }

    if (cmp(pos, change.to) <= 0) {
      return changeEnd(change);
    }

    var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1,
        ch = pos.ch;

    if (pos.line == change.to.line) {
      ch += changeEnd(change).ch - change.to.ch;
    }

    return Pos(line, ch);
  }

  function computeSelAfterChange(doc, change) {
    var out = [];

    for (var i = 0; i < doc.sel.ranges.length; i++) {
      var range = doc.sel.ranges[i];
      out.push(new Range(adjustForChange(range.anchor, change), adjustForChange(range.head, change)));
    }

    return normalizeSelection(doc.cm, out, doc.sel.primIndex);
  }

  function offsetPos(pos, old, nw) {
    if (pos.line == old.line) {
      return Pos(nw.line, pos.ch - old.ch + nw.ch);
    } else {
      return Pos(nw.line + (pos.line - old.line), pos.ch);
    }
  } // Used by replaceSelections to allow moving the selection to the
  // start or around the replaced test. Hint may be "start" or "around".


  function computeReplacedSel(doc, changes, hint) {
    var out = [];
    var oldPrev = Pos(doc.first, 0),
        newPrev = oldPrev;

    for (var i = 0; i < changes.length; i++) {
      var change = changes[i];
      var from = offsetPos(change.from, oldPrev, newPrev);
      var to = offsetPos(changeEnd(change), oldPrev, newPrev);
      oldPrev = change.to;
      newPrev = to;

      if (hint == "around") {
        var range = doc.sel.ranges[i],
            inv = cmp(range.head, range.anchor) < 0;
        out[i] = new Range(inv ? to : from, inv ? from : to);
      } else {
        out[i] = new Range(from, from);
      }
    }

    return new Selection(out, doc.sel.primIndex);
  } // Used to get the editor into a consistent state again when options change.


  function loadMode(cm) {
    cm.doc.mode = getMode(cm.options, cm.doc.modeOption);
    resetModeState(cm);
  }

  function resetModeState(cm) {
    cm.doc.iter(function (line) {
      if (line.stateAfter) {
        line.stateAfter = null;
      }

      if (line.styles) {
        line.styles = null;
      }
    });
    cm.doc.modeFrontier = cm.doc.highlightFrontier = cm.doc.first;
    startWorker(cm, 100);
    cm.state.modeGen++;

    if (cm.curOp) {
      regChange(cm);
    }
  } // DOCUMENT DATA STRUCTURE
  // By default, updates that start and end at the beginning of a line
  // are treated specially, in order to make the association of line
  // widgets and marker elements with the text behave more intuitive.


  function isWholeLineUpdate(doc, change) {
    return change.from.ch == 0 && change.to.ch == 0 && lst(change.text) == "" && (!doc.cm || doc.cm.options.wholeLineUpdateBefore);
  } // Perform a change on the document data structure.


  function updateDoc(doc, change, markedSpans, estimateHeight$$1) {
    function spansFor(n) {
      return markedSpans ? markedSpans[n] : null;
    }

    function update(line, text, spans) {
      updateLine(line, text, spans, estimateHeight$$1);
      signalLater(line, "change", line, change);
    }

    function linesFor(start, end) {
      var result = [];

      for (var i = start; i < end; ++i) {
        result.push(new Line(text[i], spansFor(i), estimateHeight$$1));
      }

      return result;
    }

    var from = change.from,
        to = change.to,
        text = change.text;
    var firstLine = getLine(doc, from.line),
        lastLine = getLine(doc, to.line);
    var lastText = lst(text),
        lastSpans = spansFor(text.length - 1),
        nlines = to.line - from.line; // Adjust the line structure

    if (change.full) {
      doc.insert(0, linesFor(0, text.length));
      doc.remove(text.length, doc.size - text.length);
    } else if (isWholeLineUpdate(doc, change)) {
      // This is a whole-line replace. Treated specially to make
      // sure line objects move the way they are supposed to.
      var added = linesFor(0, text.length - 1);
      update(lastLine, lastLine.text, lastSpans);

      if (nlines) {
        doc.remove(from.line, nlines);
      }

      if (added.length) {
        doc.insert(from.line, added);
      }
    } else if (firstLine == lastLine) {
      if (text.length == 1) {
        update(firstLine, firstLine.text.slice(0, from.ch) + lastText + firstLine.text.slice(to.ch), lastSpans);
      } else {
        var added$1 = linesFor(1, text.length - 1);
        added$1.push(new Line(lastText + firstLine.text.slice(to.ch), lastSpans, estimateHeight$$1));
        update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
        doc.insert(from.line + 1, added$1);
      }
    } else if (text.length == 1) {
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0] + lastLine.text.slice(to.ch), spansFor(0));
      doc.remove(from.line + 1, nlines);
    } else {
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
      update(lastLine, lastText + lastLine.text.slice(to.ch), lastSpans);
      var added$2 = linesFor(1, text.length - 1);

      if (nlines > 1) {
        doc.remove(from.line + 1, nlines - 1);
      }

      doc.insert(from.line + 1, added$2);
    }

    signalLater(doc, "change", doc, change);
  } // Call f for all linked documents.


  function linkedDocs(doc, f, sharedHistOnly) {
    function propagate(doc, skip, sharedHist) {
      if (doc.linked) {
        for (var i = 0; i < doc.linked.length; ++i) {
          var rel = doc.linked[i];

          if (rel.doc == skip) {
            continue;
          }

          var shared = sharedHist && rel.sharedHist;

          if (sharedHistOnly && !shared) {
            continue;
          }

          f(rel.doc, shared);
          propagate(rel.doc, doc, shared);
        }
      }
    }

    propagate(doc, null, true);
  } // Attach a document to an editor.


  function attachDoc(cm, doc) {
    if (doc.cm) {
      throw new Error("This document is already in use.");
    }

    cm.doc = doc;
    doc.cm = cm;
    estimateLineHeights(cm);
    loadMode(cm);
    setDirectionClass(cm);

    if (!cm.options.lineWrapping) {
      findMaxLine(cm);
    }

    cm.options.mode = doc.modeOption;
    regChange(cm);
  }

  function setDirectionClass(cm) {
    (cm.doc.direction == "rtl" ? addClass : rmClass)(cm.display.lineDiv, "CodeMirror-rtl");
  }

  function directionChanged(cm) {
    runInOp(cm, function () {
      setDirectionClass(cm);
      regChange(cm);
    });
  }

  function History(startGen) {
    // Arrays of change events and selections. Doing something adds an
    // event to done and clears undo. Undoing moves events from done
    // to undone, redoing moves them in the other direction.
    this.done = [];
    this.undone = [];
    this.undoDepth = Infinity; // Used to track when changes can be merged into a single undo
    // event

    this.lastModTime = this.lastSelTime = 0;
    this.lastOp = this.lastSelOp = null;
    this.lastOrigin = this.lastSelOrigin = null; // Used by the isClean() method

    this.generation = this.maxGeneration = startGen || 1;
  } // Create a history change event from an updateDoc-style change
  // object.


  function historyChangeFromChange(doc, change) {
    var histChange = {
      from: copyPos(change.from),
      to: changeEnd(change),
      text: getBetween(doc, change.from, change.to)
    };
    attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
    linkedDocs(doc, function (doc) {
      return attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
    }, true);
    return histChange;
  } // Pop all selection events off the end of a history array. Stop at
  // a change event.


  function clearSelectionEvents(array) {
    while (array.length) {
      var last = lst(array);

      if (last.ranges) {
        array.pop();
      } else {
        break;
      }
    }
  } // Find the top change event in the history. Pop off selection
  // events that are in the way.


  function lastChangeEvent(hist, force) {
    if (force) {
      clearSelectionEvents(hist.done);
      return lst(hist.done);
    } else if (hist.done.length && !lst(hist.done).ranges) {
      return lst(hist.done);
    } else if (hist.done.length > 1 && !hist.done[hist.done.length - 2].ranges) {
      hist.done.pop();
      return lst(hist.done);
    }
  } // Register a change in the history. Merges changes that are within
  // a single operation, or are close together with an origin that
  // allows merging (starting with "+") into a single event.


  function addChangeToHistory(doc, change, selAfter, opId) {
    var hist = doc.history;
    hist.undone.length = 0;
    var time = +new Date(),
        cur;
    var last;

    if ((hist.lastOp == opId || hist.lastOrigin == change.origin && change.origin && (change.origin.charAt(0) == "+" && hist.lastModTime > time - (doc.cm ? doc.cm.options.historyEventDelay : 500) || change.origin.charAt(0) == "*")) && (cur = lastChangeEvent(hist, hist.lastOp == opId))) {
      // Merge this change into the last event
      last = lst(cur.changes);

      if (cmp(change.from, change.to) == 0 && cmp(change.from, last.to) == 0) {
        // Optimized case for simple insertion -- don't want to add
        // new changesets for every character typed
        last.to = changeEnd(change);
      } else {
        // Add new sub-event
        cur.changes.push(historyChangeFromChange(doc, change));
      }
    } else {
      // Can not be merged, start a new event.
      var before = lst(hist.done);

      if (!before || !before.ranges) {
        pushSelectionToHistory(doc.sel, hist.done);
      }

      cur = {
        changes: [historyChangeFromChange(doc, change)],
        generation: hist.generation
      };
      hist.done.push(cur);

      while (hist.done.length > hist.undoDepth) {
        hist.done.shift();

        if (!hist.done[0].ranges) {
          hist.done.shift();
        }
      }
    }

    hist.done.push(selAfter);
    hist.generation = ++hist.maxGeneration;
    hist.lastModTime = hist.lastSelTime = time;
    hist.lastOp = hist.lastSelOp = opId;
    hist.lastOrigin = hist.lastSelOrigin = change.origin;

    if (!last) {
      signal(doc, "historyAdded");
    }
  }

  function selectionEventCanBeMerged(doc, origin, prev, sel) {
    var ch = origin.charAt(0);
    return ch == "*" || ch == "+" && prev.ranges.length == sel.ranges.length && prev.somethingSelected() == sel.somethingSelected() && new Date() - doc.history.lastSelTime <= (doc.cm ? doc.cm.options.historyEventDelay : 500);
  } // Called whenever the selection changes, sets the new selection as
  // the pending selection in the history, and pushes the old pending
  // selection into the 'done' array when it was significantly
  // different (in number of selected ranges, emptiness, or time).


  function addSelectionToHistory(doc, sel, opId, options) {
    var hist = doc.history,
        origin = options && options.origin; // A new event is started when the previous origin does not match
    // the current, or the origins don't allow matching. Origins
    // starting with * are always merged, those starting with + are
    // merged when similar and close together in time.

    if (opId == hist.lastSelOp || origin && hist.lastSelOrigin == origin && (hist.lastModTime == hist.lastSelTime && hist.lastOrigin == origin || selectionEventCanBeMerged(doc, origin, lst(hist.done), sel))) {
      hist.done[hist.done.length - 1] = sel;
    } else {
      pushSelectionToHistory(sel, hist.done);
    }

    hist.lastSelTime = +new Date();
    hist.lastSelOrigin = origin;
    hist.lastSelOp = opId;

    if (options && options.clearRedo !== false) {
      clearSelectionEvents(hist.undone);
    }
  }

  function pushSelectionToHistory(sel, dest) {
    var top = lst(dest);

    if (!(top && top.ranges && top.equals(sel))) {
      dest.push(sel);
    }
  } // Used to store marked span information in the history.


  function attachLocalSpans(doc, change, from, to) {
    var existing = change["spans_" + doc.id],
        n = 0;
    doc.iter(Math.max(doc.first, from), Math.min(doc.first + doc.size, to), function (line) {
      if (line.markedSpans) {
        (existing || (existing = change["spans_" + doc.id] = {}))[n] = line.markedSpans;
      }

      ++n;
    });
  } // When un/re-doing restores text containing marked spans, those
  // that have been explicitly cleared should not be restored.


  function removeClearedSpans(spans) {
    if (!spans) {
      return null;
    }

    var out;

    for (var i = 0; i < spans.length; ++i) {
      if (spans[i].marker.explicitlyCleared) {
        if (!out) {
          out = spans.slice(0, i);
        }
      } else if (out) {
        out.push(spans[i]);
      }
    }

    return !out ? spans : out.length ? out : null;
  } // Retrieve and filter the old marked spans stored in a change event.


  function getOldSpans(doc, change) {
    var found = change["spans_" + doc.id];

    if (!found) {
      return null;
    }

    var nw = [];

    for (var i = 0; i < change.text.length; ++i) {
      nw.push(removeClearedSpans(found[i]));
    }

    return nw;
  } // Used for un/re-doing changes from the history. Combines the
  // result of computing the existing spans with the set of spans that
  // existed in the history (so that deleting around a span and then
  // undoing brings back the span).


  function mergeOldSpans(doc, change) {
    var old = getOldSpans(doc, change);
    var stretched = stretchSpansOverChange(doc, change);

    if (!old) {
      return stretched;
    }

    if (!stretched) {
      return old;
    }

    for (var i = 0; i < old.length; ++i) {
      var oldCur = old[i],
          stretchCur = stretched[i];

      if (oldCur && stretchCur) {
        spans: for (var j = 0; j < stretchCur.length; ++j) {
          var span = stretchCur[j];

          for (var k = 0; k < oldCur.length; ++k) {
            if (oldCur[k].marker == span.marker) {
              continue spans;
            }
          }

          oldCur.push(span);
        }
      } else if (stretchCur) {
        old[i] = stretchCur;
      }
    }

    return old;
  } // Used both to provide a JSON-safe object in .getHistory, and, when
  // detaching a document, to split the history in two


  function copyHistoryArray(events, newGroup, instantiateSel) {
    var copy = [];

    for (var i = 0; i < events.length; ++i) {
      var event = events[i];

      if (event.ranges) {
        copy.push(instantiateSel ? Selection.prototype.deepCopy.call(event) : event);
        continue;
      }

      var changes = event.changes,
          newChanges = [];
      copy.push({
        changes: newChanges
      });

      for (var j = 0; j < changes.length; ++j) {
        var change = changes[j],
            m = void 0;
        newChanges.push({
          from: change.from,
          to: change.to,
          text: change.text
        });

        if (newGroup) {
          for (var prop in change) {
            if (m = prop.match(/^spans_(\d+)$/)) {
              if (indexOf(newGroup, Number(m[1])) > -1) {
                lst(newChanges)[prop] = change[prop];
                delete change[prop];
              }
            }
          }
        }
      }
    }

    return copy;
  } // The 'scroll' parameter given to many of these indicated whether
  // the new cursor position should be scrolled into view after
  // modifying the selection.
  // If shift is held or the extend flag is set, extends a range to
  // include a given position (and optionally a second position).
  // Otherwise, simply returns the range between the given positions.
  // Used for cursor motion and such.


  function extendRange(range, head, other, extend) {
    if (extend) {
      var anchor = range.anchor;

      if (other) {
        var posBefore = cmp(head, anchor) < 0;

        if (posBefore != cmp(other, anchor) < 0) {
          anchor = head;
          head = other;
        } else if (posBefore != cmp(head, other) < 0) {
          head = other;
        }
      }

      return new Range(anchor, head);
    } else {
      return new Range(other || head, head);
    }
  } // Extend the primary selection range, discard the rest.


  function extendSelection(doc, head, other, options, extend) {
    if (extend == null) {
      extend = doc.cm && (doc.cm.display.shift || doc.extend);
    }

    setSelection(doc, new Selection([extendRange(doc.sel.primary(), head, other, extend)], 0), options);
  } // Extend all selections (pos is an array of selections with length
  // equal the number of selections)


  function extendSelections(doc, heads, options) {
    var out = [];
    var extend = doc.cm && (doc.cm.display.shift || doc.extend);

    for (var i = 0; i < doc.sel.ranges.length; i++) {
      out[i] = extendRange(doc.sel.ranges[i], heads[i], null, extend);
    }

    var newSel = normalizeSelection(doc.cm, out, doc.sel.primIndex);
    setSelection(doc, newSel, options);
  } // Updates a single range in the selection.


  function replaceOneSelection(doc, i, range, options) {
    var ranges = doc.sel.ranges.slice(0);
    ranges[i] = range;
    setSelection(doc, normalizeSelection(doc.cm, ranges, doc.sel.primIndex), options);
  } // Reset the selection to a single range.


  function setSimpleSelection(doc, anchor, head, options) {
    setSelection(doc, simpleSelection(anchor, head), options);
  } // Give beforeSelectionChange handlers a change to influence a
  // selection update.


  function filterSelectionChange(doc, sel, options) {
    var obj = {
      ranges: sel.ranges,
      update: function update(ranges) {
        var this$1 = this;
        this.ranges = [];

        for (var i = 0; i < ranges.length; i++) {
          this$1.ranges[i] = new Range(_clipPos(doc, ranges[i].anchor), _clipPos(doc, ranges[i].head));
        }
      },
      origin: options && options.origin
    };
    signal(doc, "beforeSelectionChange", doc, obj);

    if (doc.cm) {
      signal(doc.cm, "beforeSelectionChange", doc.cm, obj);
    }

    if (obj.ranges != sel.ranges) {
      return normalizeSelection(doc.cm, obj.ranges, obj.ranges.length - 1);
    } else {
      return sel;
    }
  }

  function setSelectionReplaceHistory(doc, sel, options) {
    var done = doc.history.done,
        last = lst(done);

    if (last && last.ranges) {
      done[done.length - 1] = sel;
      setSelectionNoUndo(doc, sel, options);
    } else {
      setSelection(doc, sel, options);
    }
  } // Set a new selection.


  function setSelection(doc, sel, options) {
    setSelectionNoUndo(doc, sel, options);
    addSelectionToHistory(doc, doc.sel, doc.cm ? doc.cm.curOp.id : NaN, options);
  }

  function setSelectionNoUndo(doc, sel, options) {
    if (hasHandler(doc, "beforeSelectionChange") || doc.cm && hasHandler(doc.cm, "beforeSelectionChange")) {
      sel = filterSelectionChange(doc, sel, options);
    }

    var bias = options && options.bias || (cmp(sel.primary().head, doc.sel.primary().head) < 0 ? -1 : 1);
    setSelectionInner(doc, skipAtomicInSelection(doc, sel, bias, true));

    if (!(options && options.scroll === false) && doc.cm) {
      ensureCursorVisible(doc.cm);
    }
  }

  function setSelectionInner(doc, sel) {
    if (sel.equals(doc.sel)) {
      return;
    }

    doc.sel = sel;

    if (doc.cm) {
      doc.cm.curOp.updateInput = 1;
      doc.cm.curOp.selectionChanged = true;
      signalCursorActivity(doc.cm);
    }

    signalLater(doc, "cursorActivity", doc);
  } // Verify that the selection does not partially select any atomic
  // marked ranges.


  function reCheckSelection(doc) {
    setSelectionInner(doc, skipAtomicInSelection(doc, doc.sel, null, false));
  } // Return a selection that does not partially select any atomic
  // ranges.


  function skipAtomicInSelection(doc, sel, bias, mayClear) {
    var out;

    for (var i = 0; i < sel.ranges.length; i++) {
      var range = sel.ranges[i];
      var old = sel.ranges.length == doc.sel.ranges.length && doc.sel.ranges[i];
      var newAnchor = skipAtomic(doc, range.anchor, old && old.anchor, bias, mayClear);
      var newHead = skipAtomic(doc, range.head, old && old.head, bias, mayClear);

      if (out || newAnchor != range.anchor || newHead != range.head) {
        if (!out) {
          out = sel.ranges.slice(0, i);
        }

        out[i] = new Range(newAnchor, newHead);
      }
    }

    return out ? normalizeSelection(doc.cm, out, sel.primIndex) : sel;
  }

  function skipAtomicInner(doc, pos, oldPos, dir, mayClear) {
    var line = getLine(doc, pos.line);

    if (line.markedSpans) {
      for (var i = 0; i < line.markedSpans.length; ++i) {
        var sp = line.markedSpans[i],
            m = sp.marker; // Determine if we should prevent the cursor being placed to the left/right of an atomic marker
        // Historically this was determined using the inclusiveLeft/Right option, but the new way to control it
        // is with selectLeft/Right

        var preventCursorLeft = "selectLeft" in m ? !m.selectLeft : m.inclusiveLeft;
        var preventCursorRight = "selectRight" in m ? !m.selectRight : m.inclusiveRight;

        if ((sp.from == null || (preventCursorLeft ? sp.from <= pos.ch : sp.from < pos.ch)) && (sp.to == null || (preventCursorRight ? sp.to >= pos.ch : sp.to > pos.ch))) {
          if (mayClear) {
            signal(m, "beforeCursorEnter");

            if (m.explicitlyCleared) {
              if (!line.markedSpans) {
                break;
              } else {
                --i;
                continue;
              }
            }
          }

          if (!m.atomic) {
            continue;
          }

          if (oldPos) {
            var near = m.find(dir < 0 ? 1 : -1),
                diff = void 0;

            if (dir < 0 ? preventCursorRight : preventCursorLeft) {
              near = movePos(doc, near, -dir, near && near.line == pos.line ? line : null);
            }

            if (near && near.line == pos.line && (diff = cmp(near, oldPos)) && (dir < 0 ? diff < 0 : diff > 0)) {
              return skipAtomicInner(doc, near, pos, dir, mayClear);
            }
          }

          var far = m.find(dir < 0 ? -1 : 1);

          if (dir < 0 ? preventCursorLeft : preventCursorRight) {
            far = movePos(doc, far, dir, far.line == pos.line ? line : null);
          }

          return far ? skipAtomicInner(doc, far, pos, dir, mayClear) : null;
        }
      }
    }

    return pos;
  } // Ensure a given position is not inside an atomic range.


  function skipAtomic(doc, pos, oldPos, bias, mayClear) {
    var dir = bias || 1;
    var found = skipAtomicInner(doc, pos, oldPos, dir, mayClear) || !mayClear && skipAtomicInner(doc, pos, oldPos, dir, true) || skipAtomicInner(doc, pos, oldPos, -dir, mayClear) || !mayClear && skipAtomicInner(doc, pos, oldPos, -dir, true);

    if (!found) {
      doc.cantEdit = true;
      return Pos(doc.first, 0);
    }

    return found;
  }

  function movePos(doc, pos, dir, line) {
    if (dir < 0 && pos.ch == 0) {
      if (pos.line > doc.first) {
        return _clipPos(doc, Pos(pos.line - 1));
      } else {
        return null;
      }
    } else if (dir > 0 && pos.ch == (line || getLine(doc, pos.line)).text.length) {
      if (pos.line < doc.first + doc.size - 1) {
        return Pos(pos.line + 1, 0);
      } else {
        return null;
      }
    } else {
      return new Pos(pos.line, pos.ch + dir);
    }
  }

  function selectAll(cm) {
    cm.setSelection(Pos(cm.firstLine(), 0), Pos(cm.lastLine()), sel_dontScroll);
  } // UPDATING
  // Allow "beforeChange" event handlers to influence a change


  function filterChange(doc, change, update) {
    var obj = {
      canceled: false,
      from: change.from,
      to: change.to,
      text: change.text,
      origin: change.origin,
      cancel: function cancel() {
        return obj.canceled = true;
      }
    };

    if (update) {
      obj.update = function (from, to, text, origin) {
        if (from) {
          obj.from = _clipPos(doc, from);
        }

        if (to) {
          obj.to = _clipPos(doc, to);
        }

        if (text) {
          obj.text = text;
        }

        if (origin !== undefined) {
          obj.origin = origin;
        }
      };
    }

    signal(doc, "beforeChange", doc, obj);

    if (doc.cm) {
      signal(doc.cm, "beforeChange", doc.cm, obj);
    }

    if (obj.canceled) {
      if (doc.cm) {
        doc.cm.curOp.updateInput = 2;
      }

      return null;
    }

    return {
      from: obj.from,
      to: obj.to,
      text: obj.text,
      origin: obj.origin
    };
  } // Apply a change to a document, and add it to the document's
  // history, and propagating it to all linked documents.


  function makeChange(doc, change, ignoreReadOnly) {
    if (doc.cm) {
      if (!doc.cm.curOp) {
        return operation(doc.cm, makeChange)(doc, change, ignoreReadOnly);
      }

      if (doc.cm.state.suppressEdits) {
        return;
      }
    }

    if (hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange")) {
      change = filterChange(doc, change, true);

      if (!change) {
        return;
      }
    } // Possibly split or suppress the update based on the presence
    // of read-only spans in its range.


    var split = sawReadOnlySpans && !ignoreReadOnly && removeReadOnlyRanges(doc, change.from, change.to);

    if (split) {
      for (var i = split.length - 1; i >= 0; --i) {
        makeChangeInner(doc, {
          from: split[i].from,
          to: split[i].to,
          text: i ? [""] : change.text,
          origin: change.origin
        });
      }
    } else {
      makeChangeInner(doc, change);
    }
  }

  function makeChangeInner(doc, change) {
    if (change.text.length == 1 && change.text[0] == "" && cmp(change.from, change.to) == 0) {
      return;
    }

    var selAfter = computeSelAfterChange(doc, change);
    addChangeToHistory(doc, change, selAfter, doc.cm ? doc.cm.curOp.id : NaN);
    makeChangeSingleDoc(doc, change, selAfter, stretchSpansOverChange(doc, change));
    var rebased = [];
    linkedDocs(doc, function (doc, sharedHist) {
      if (!sharedHist && indexOf(rebased, doc.history) == -1) {
        rebaseHist(doc.history, change);
        rebased.push(doc.history);
      }

      makeChangeSingleDoc(doc, change, null, stretchSpansOverChange(doc, change));
    });
  } // Revert a change stored in a document's history.


  function makeChangeFromHistory(doc, type, allowSelectionOnly) {
    var suppress = doc.cm && doc.cm.state.suppressEdits;

    if (suppress && !allowSelectionOnly) {
      return;
    }

    var hist = doc.history,
        event,
        selAfter = doc.sel;
    var source = type == "undo" ? hist.done : hist.undone,
        dest = type == "undo" ? hist.undone : hist.done; // Verify that there is a useable event (so that ctrl-z won't
    // needlessly clear selection events)

    var i = 0;

    for (; i < source.length; i++) {
      event = source[i];

      if (allowSelectionOnly ? event.ranges && !event.equals(doc.sel) : !event.ranges) {
        break;
      }
    }

    if (i == source.length) {
      return;
    }

    hist.lastOrigin = hist.lastSelOrigin = null;

    for (;;) {
      event = source.pop();

      if (event.ranges) {
        pushSelectionToHistory(event, dest);

        if (allowSelectionOnly && !event.equals(doc.sel)) {
          setSelection(doc, event, {
            clearRedo: false
          });
          return;
        }

        selAfter = event;
      } else if (suppress) {
        source.push(event);
        return;
      } else {
        break;
      }
    } // Build up a reverse change object to add to the opposite history
    // stack (redo when undoing, and vice versa).


    var antiChanges = [];
    pushSelectionToHistory(selAfter, dest);
    dest.push({
      changes: antiChanges,
      generation: hist.generation
    });
    hist.generation = event.generation || ++hist.maxGeneration;
    var filter = hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange");

    var loop = function loop(i) {
      var change = event.changes[i];
      change.origin = type;

      if (filter && !filterChange(doc, change, false)) {
        source.length = 0;
        return {};
      }

      antiChanges.push(historyChangeFromChange(doc, change));
      var after = i ? computeSelAfterChange(doc, change) : lst(source);
      makeChangeSingleDoc(doc, change, after, mergeOldSpans(doc, change));

      if (!i && doc.cm) {
        doc.cm.scrollIntoView({
          from: change.from,
          to: changeEnd(change)
        });
      }

      var rebased = []; // Propagate to the linked documents

      linkedDocs(doc, function (doc, sharedHist) {
        if (!sharedHist && indexOf(rebased, doc.history) == -1) {
          rebaseHist(doc.history, change);
          rebased.push(doc.history);
        }

        makeChangeSingleDoc(doc, change, null, mergeOldSpans(doc, change));
      });
    };

    for (var i$1 = event.changes.length - 1; i$1 >= 0; --i$1) {
      var returned = loop(i$1);
      if (returned) return returned.v;
    }
  } // Sub-views need their line numbers shifted when text is added
  // above or below them in the parent document.


  function shiftDoc(doc, distance) {
    if (distance == 0) {
      return;
    }

    doc.first += distance;
    doc.sel = new Selection(map(doc.sel.ranges, function (range) {
      return new Range(Pos(range.anchor.line + distance, range.anchor.ch), Pos(range.head.line + distance, range.head.ch));
    }), doc.sel.primIndex);

    if (doc.cm) {
      regChange(doc.cm, doc.first, doc.first - distance, distance);

      for (var d = doc.cm.display, l = d.viewFrom; l < d.viewTo; l++) {
        regLineChange(doc.cm, l, "gutter");
      }
    }
  } // More lower-level change function, handling only a single document
  // (not linked ones).


  function makeChangeSingleDoc(doc, change, selAfter, spans) {
    if (doc.cm && !doc.cm.curOp) {
      return operation(doc.cm, makeChangeSingleDoc)(doc, change, selAfter, spans);
    }

    if (change.to.line < doc.first) {
      shiftDoc(doc, change.text.length - 1 - (change.to.line - change.from.line));
      return;
    }

    if (change.from.line > doc.lastLine()) {
      return;
    } // Clip the change to the size of this doc


    if (change.from.line < doc.first) {
      var shift = change.text.length - 1 - (doc.first - change.from.line);
      shiftDoc(doc, shift);
      change = {
        from: Pos(doc.first, 0),
        to: Pos(change.to.line + shift, change.to.ch),
        text: [lst(change.text)],
        origin: change.origin
      };
    }

    var last = doc.lastLine();

    if (change.to.line > last) {
      change = {
        from: change.from,
        to: Pos(last, getLine(doc, last).text.length),
        text: [change.text[0]],
        origin: change.origin
      };
    }

    change.removed = getBetween(doc, change.from, change.to);

    if (!selAfter) {
      selAfter = computeSelAfterChange(doc, change);
    }

    if (doc.cm) {
      makeChangeSingleDocInEditor(doc.cm, change, spans);
    } else {
      updateDoc(doc, change, spans);
    }

    setSelectionNoUndo(doc, selAfter, sel_dontScroll);

    if (doc.cantEdit && skipAtomic(doc, Pos(doc.firstLine(), 0))) {
      doc.cantEdit = false;
    }
  } // Handle the interaction of a change to a document with the editor
  // that this document is part of.


  function makeChangeSingleDocInEditor(cm, change, spans) {
    var doc = cm.doc,
        display = cm.display,
        from = change.from,
        to = change.to;
    var recomputeMaxLength = false,
        checkWidthStart = from.line;

    if (!cm.options.lineWrapping) {
      checkWidthStart = lineNo(visualLine(getLine(doc, from.line)));
      doc.iter(checkWidthStart, to.line + 1, function (line) {
        if (line == display.maxLine) {
          recomputeMaxLength = true;
          return true;
        }
      });
    }

    if (doc.sel.contains(change.from, change.to) > -1) {
      signalCursorActivity(cm);
    }

    updateDoc(doc, change, spans, estimateHeight(cm));

    if (!cm.options.lineWrapping) {
      doc.iter(checkWidthStart, from.line + change.text.length, function (line) {
        var len = lineLength(line);

        if (len > display.maxLineLength) {
          display.maxLine = line;
          display.maxLineLength = len;
          display.maxLineChanged = true;
          recomputeMaxLength = false;
        }
      });

      if (recomputeMaxLength) {
        cm.curOp.updateMaxLine = true;
      }
    }

    retreatFrontier(doc, from.line);
    startWorker(cm, 400);
    var lendiff = change.text.length - (to.line - from.line) - 1; // Remember that these lines changed, for updating the display

    if (change.full) {
      regChange(cm);
    } else if (from.line == to.line && change.text.length == 1 && !isWholeLineUpdate(cm.doc, change)) {
      regLineChange(cm, from.line, "text");
    } else {
      regChange(cm, from.line, to.line + 1, lendiff);
    }

    var changesHandler = hasHandler(cm, "changes"),
        changeHandler = hasHandler(cm, "change");

    if (changeHandler || changesHandler) {
      var obj = {
        from: from,
        to: to,
        text: change.text,
        removed: change.removed,
        origin: change.origin
      };

      if (changeHandler) {
        signalLater(cm, "change", cm, obj);
      }

      if (changesHandler) {
        (cm.curOp.changeObjs || (cm.curOp.changeObjs = [])).push(obj);
      }
    }

    cm.display.selForContextMenu = null;
  }

  function _replaceRange(doc, code, from, to, origin) {
    var assign;

    if (!to) {
      to = from;
    }

    if (cmp(to, from) < 0) {
      assign = [to, from], from = assign[0], to = assign[1];
    }

    if (typeof code == "string") {
      code = doc.splitLines(code);
    }

    makeChange(doc, {
      from: from,
      to: to,
      text: code,
      origin: origin
    });
  } // Rebasing/resetting history to deal with externally-sourced changes


  function rebaseHistSelSingle(pos, from, to, diff) {
    if (to < pos.line) {
      pos.line += diff;
    } else if (from < pos.line) {
      pos.line = from;
      pos.ch = 0;
    }
  } // Tries to rebase an array of history events given a change in the
  // document. If the change touches the same lines as the event, the
  // event, and everything 'behind' it, is discarded. If the change is
  // before the event, the event's positions are updated. Uses a
  // copy-on-write scheme for the positions, to avoid having to
  // reallocate them all on every rebase, but also avoid problems with
  // shared position objects being unsafely updated.


  function rebaseHistArray(array, from, to, diff) {
    for (var i = 0; i < array.length; ++i) {
      var sub = array[i],
          ok = true;

      if (sub.ranges) {
        if (!sub.copied) {
          sub = array[i] = sub.deepCopy();
          sub.copied = true;
        }

        for (var j = 0; j < sub.ranges.length; j++) {
          rebaseHistSelSingle(sub.ranges[j].anchor, from, to, diff);
          rebaseHistSelSingle(sub.ranges[j].head, from, to, diff);
        }

        continue;
      }

      for (var j$1 = 0; j$1 < sub.changes.length; ++j$1) {
        var cur = sub.changes[j$1];

        if (to < cur.from.line) {
          cur.from = Pos(cur.from.line + diff, cur.from.ch);
          cur.to = Pos(cur.to.line + diff, cur.to.ch);
        } else if (from <= cur.to.line) {
          ok = false;
          break;
        }
      }

      if (!ok) {
        array.splice(0, i + 1);
        i = 0;
      }
    }
  }

  function rebaseHist(hist, change) {
    var from = change.from.line,
        to = change.to.line,
        diff = change.text.length - (to - from) - 1;
    rebaseHistArray(hist.done, from, to, diff);
    rebaseHistArray(hist.undone, from, to, diff);
  } // Utility for applying a change to a line by handle or number,
  // returning the number and optionally registering the line as
  // changed.


  function changeLine(doc, handle, changeType, op) {
    var no = handle,
        line = handle;

    if (typeof handle == "number") {
      line = getLine(doc, clipLine(doc, handle));
    } else {
      no = lineNo(handle);
    }

    if (no == null) {
      return null;
    }

    if (op(line, no) && doc.cm) {
      regLineChange(doc.cm, no, changeType);
    }

    return line;
  } // The document is represented as a BTree consisting of leaves, with
  // chunk of lines in them, and branches, with up to ten leaves or
  // other branch nodes below them. The top node is always a branch
  // node, and is the document object itself (meaning it has
  // additional methods and properties).
  //
  // All nodes have parent links. The tree is used both to go from
  // line numbers to line objects, and to go from objects to numbers.
  // It also indexes by height, and is used to convert between height
  // and line object, and to find the total height of the document.
  //
  // See also http://marijnhaverbeke.nl/blog/codemirror-line-tree.html


  function LeafChunk(lines) {
    var this$1 = this;
    this.lines = lines;
    this.parent = null;
    var height = 0;

    for (var i = 0; i < lines.length; ++i) {
      lines[i].parent = this$1;
      height += lines[i].height;
    }

    this.height = height;
  }

  LeafChunk.prototype = {
    chunkSize: function chunkSize() {
      return this.lines.length;
    },
    // Remove the n lines at offset 'at'.
    removeInner: function removeInner(at, n) {
      var this$1 = this;

      for (var i = at, e = at + n; i < e; ++i) {
        var line = this$1.lines[i];
        this$1.height -= line.height;
        cleanUpLine(line);
        signalLater(line, "delete");
      }

      this.lines.splice(at, n);
    },
    // Helper used to collapse a small branch into a single leaf.
    collapse: function collapse(lines) {
      lines.push.apply(lines, this.lines);
    },
    // Insert the given array of lines at offset 'at', count them as
    // having the given height.
    insertInner: function insertInner(at, lines, height) {
      var this$1 = this;
      this.height += height;
      this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));

      for (var i = 0; i < lines.length; ++i) {
        lines[i].parent = this$1;
      }
    },
    // Used to iterate over a part of the tree.
    iterN: function iterN(at, n, op) {
      var this$1 = this;

      for (var e = at + n; at < e; ++at) {
        if (op(this$1.lines[at])) {
          return true;
        }
      }
    }
  };

  function BranchChunk(children) {
    var this$1 = this;
    this.children = children;
    var size = 0,
        height = 0;

    for (var i = 0; i < children.length; ++i) {
      var ch = children[i];
      size += ch.chunkSize();
      height += ch.height;
      ch.parent = this$1;
    }

    this.size = size;
    this.height = height;
    this.parent = null;
  }

  BranchChunk.prototype = {
    chunkSize: function chunkSize() {
      return this.size;
    },
    removeInner: function removeInner(at, n) {
      var this$1 = this;
      this.size -= n;

      for (var i = 0; i < this.children.length; ++i) {
        var child = this$1.children[i],
            sz = child.chunkSize();

        if (at < sz) {
          var rm = Math.min(n, sz - at),
              oldHeight = child.height;
          child.removeInner(at, rm);
          this$1.height -= oldHeight - child.height;

          if (sz == rm) {
            this$1.children.splice(i--, 1);
            child.parent = null;
          }

          if ((n -= rm) == 0) {
            break;
          }

          at = 0;
        } else {
          at -= sz;
        }
      } // If the result is smaller than 25 lines, ensure that it is a
      // single leaf node.


      if (this.size - n < 25 && (this.children.length > 1 || !(this.children[0] instanceof LeafChunk))) {
        var lines = [];
        this.collapse(lines);
        this.children = [new LeafChunk(lines)];
        this.children[0].parent = this;
      }
    },
    collapse: function collapse(lines) {
      var this$1 = this;

      for (var i = 0; i < this.children.length; ++i) {
        this$1.children[i].collapse(lines);
      }
    },
    insertInner: function insertInner(at, lines, height) {
      var this$1 = this;
      this.size += lines.length;
      this.height += height;

      for (var i = 0; i < this.children.length; ++i) {
        var child = this$1.children[i],
            sz = child.chunkSize();

        if (at <= sz) {
          child.insertInner(at, lines, height);

          if (child.lines && child.lines.length > 50) {
            // To avoid memory thrashing when child.lines is huge (e.g. first view of a large file), it's never spliced.
            // Instead, small slices are taken. They're taken in order because sequential memory accesses are fastest.
            var remaining = child.lines.length % 25 + 25;

            for (var pos = remaining; pos < child.lines.length;) {
              var leaf = new LeafChunk(child.lines.slice(pos, pos += 25));
              child.height -= leaf.height;
              this$1.children.splice(++i, 0, leaf);
              leaf.parent = this$1;
            }

            child.lines = child.lines.slice(0, remaining);
            this$1.maybeSpill();
          }

          break;
        }

        at -= sz;
      }
    },
    // When a node has grown, check whether it should be split.
    maybeSpill: function maybeSpill() {
      if (this.children.length <= 10) {
        return;
      }

      var me = this;

      do {
        var spilled = me.children.splice(me.children.length - 5, 5);
        var sibling = new BranchChunk(spilled);

        if (!me.parent) {
          // Become the parent node
          var copy = new BranchChunk(me.children);
          copy.parent = me;
          me.children = [copy, sibling];
          me = copy;
        } else {
          me.size -= sibling.size;
          me.height -= sibling.height;
          var myIndex = indexOf(me.parent.children, me);
          me.parent.children.splice(myIndex + 1, 0, sibling);
        }

        sibling.parent = me.parent;
      } while (me.children.length > 10);

      me.parent.maybeSpill();
    },
    iterN: function iterN(at, n, op) {
      var this$1 = this;

      for (var i = 0; i < this.children.length; ++i) {
        var child = this$1.children[i],
            sz = child.chunkSize();

        if (at < sz) {
          var used = Math.min(n, sz - at);

          if (child.iterN(at, used, op)) {
            return true;
          }

          if ((n -= used) == 0) {
            break;
          }

          at = 0;
        } else {
          at -= sz;
        }
      }
    }
  }; // Line widgets are block elements displayed above or below a line.

  var LineWidget = function LineWidget(doc, node, options) {
    var this$1 = this;

    if (options) {
      for (var opt in options) {
        if (options.hasOwnProperty(opt)) {
          this$1[opt] = options[opt];
        }
      }
    }

    this.doc = doc;
    this.node = node;
  };

  LineWidget.prototype.clear = function () {
    var this$1 = this;
    var cm = this.doc.cm,
        ws = this.line.widgets,
        line = this.line,
        no = lineNo(line);

    if (no == null || !ws) {
      return;
    }

    for (var i = 0; i < ws.length; ++i) {
      if (ws[i] == this$1) {
        ws.splice(i--, 1);
      }
    }

    if (!ws.length) {
      line.widgets = null;
    }

    var height = widgetHeight(this);
    updateLineHeight(line, Math.max(0, line.height - height));

    if (cm) {
      runInOp(cm, function () {
        adjustScrollWhenAboveVisible(cm, line, -height);
        regLineChange(cm, no, "widget");
      });
      signalLater(cm, "lineWidgetCleared", cm, this, no);
    }
  };

  LineWidget.prototype.changed = function () {
    var this$1 = this;
    var oldH = this.height,
        cm = this.doc.cm,
        line = this.line;
    this.height = null;
    var diff = widgetHeight(this) - oldH;

    if (!diff) {
      return;
    }

    if (!lineIsHidden(this.doc, line)) {
      updateLineHeight(line, line.height + diff);
    }

    if (cm) {
      runInOp(cm, function () {
        cm.curOp.forceUpdate = true;
        adjustScrollWhenAboveVisible(cm, line, diff);
        signalLater(cm, "lineWidgetChanged", cm, this$1, lineNo(line));
      });
    }
  };

  eventMixin(LineWidget);

  function adjustScrollWhenAboveVisible(cm, line, diff) {
    if (_heightAtLine(line) < (cm.curOp && cm.curOp.scrollTop || cm.doc.scrollTop)) {
      addToScrollTop(cm, diff);
    }
  }

  function addLineWidget(doc, handle, node, options) {
    var widget = new LineWidget(doc, node, options);
    var cm = doc.cm;

    if (cm && widget.noHScroll) {
      cm.display.alignWidgets = true;
    }

    changeLine(doc, handle, "widget", function (line) {
      var widgets = line.widgets || (line.widgets = []);

      if (widget.insertAt == null) {
        widgets.push(widget);
      } else {
        widgets.splice(Math.min(widgets.length - 1, Math.max(0, widget.insertAt)), 0, widget);
      }

      widget.line = line;

      if (cm && !lineIsHidden(doc, line)) {
        var aboveVisible = _heightAtLine(line) < doc.scrollTop;
        updateLineHeight(line, line.height + widgetHeight(widget));

        if (aboveVisible) {
          addToScrollTop(cm, widget.height);
        }

        cm.curOp.forceUpdate = true;
      }

      return true;
    });

    if (cm) {
      signalLater(cm, "lineWidgetAdded", cm, widget, typeof handle == "number" ? handle : lineNo(handle));
    }

    return widget;
  } // TEXTMARKERS
  // Created with markText and setBookmark methods. A TextMarker is a
  // handle that can be used to clear or find a marked position in the
  // document. Line objects hold arrays (markedSpans) containing
  // {from, to, marker} object pointing to such marker objects, and
  // indicating that such a marker is present on that line. Multiple
  // lines may point to the same marker when it spans across lines.
  // The spans will have null for their from/to properties when the
  // marker continues beyond the start/end of the line. Markers have
  // links back to the lines they currently touch.
  // Collapsed markers have unique ids, in order to be able to order
  // them, which is needed for uniquely determining an outer marker
  // when they overlap (they may nest, but not partially overlap).


  var nextMarkerId = 0;

  var TextMarker = function TextMarker(doc, type) {
    this.lines = [];
    this.type = type;
    this.doc = doc;
    this.id = ++nextMarkerId;
  }; // Clear the marker.


  TextMarker.prototype.clear = function () {
    var this$1 = this;

    if (this.explicitlyCleared) {
      return;
    }

    var cm = this.doc.cm,
        withOp = cm && !cm.curOp;

    if (withOp) {
      _startOperation(cm);
    }

    if (hasHandler(this, "clear")) {
      var found = this.find();

      if (found) {
        signalLater(this, "clear", found.from, found.to);
      }
    }

    var min = null,
        max = null;

    for (var i = 0; i < this.lines.length; ++i) {
      var line = this$1.lines[i];
      var span = getMarkedSpanFor(line.markedSpans, this$1);

      if (cm && !this$1.collapsed) {
        regLineChange(cm, lineNo(line), "text");
      } else if (cm) {
        if (span.to != null) {
          max = lineNo(line);
        }

        if (span.from != null) {
          min = lineNo(line);
        }
      }

      line.markedSpans = removeMarkedSpan(line.markedSpans, span);

      if (span.from == null && this$1.collapsed && !lineIsHidden(this$1.doc, line) && cm) {
        updateLineHeight(line, textHeight(cm.display));
      }
    }

    if (cm && this.collapsed && !cm.options.lineWrapping) {
      for (var i$1 = 0; i$1 < this.lines.length; ++i$1) {
        var visual = visualLine(this$1.lines[i$1]),
            len = lineLength(visual);

        if (len > cm.display.maxLineLength) {
          cm.display.maxLine = visual;
          cm.display.maxLineLength = len;
          cm.display.maxLineChanged = true;
        }
      }
    }

    if (min != null && cm && this.collapsed) {
      regChange(cm, min, max + 1);
    }

    this.lines.length = 0;
    this.explicitlyCleared = true;

    if (this.atomic && this.doc.cantEdit) {
      this.doc.cantEdit = false;

      if (cm) {
        reCheckSelection(cm.doc);
      }
    }

    if (cm) {
      signalLater(cm, "markerCleared", cm, this, min, max);
    }

    if (withOp) {
      _endOperation(cm);
    }

    if (this.parent) {
      this.parent.clear();
    }
  }; // Find the position of the marker in the document. Returns a {from,
  // to} object by default. Side can be passed to get a specific side
  // -- 0 (both), -1 (left), or 1 (right). When lineObj is true, the
  // Pos objects returned contain a line object, rather than a line
  // number (used to prevent looking up the same line twice).


  TextMarker.prototype.find = function (side, lineObj) {
    var this$1 = this;

    if (side == null && this.type == "bookmark") {
      side = 1;
    }

    var from, to;

    for (var i = 0; i < this.lines.length; ++i) {
      var line = this$1.lines[i];
      var span = getMarkedSpanFor(line.markedSpans, this$1);

      if (span.from != null) {
        from = Pos(lineObj ? line : lineNo(line), span.from);

        if (side == -1) {
          return from;
        }
      }

      if (span.to != null) {
        to = Pos(lineObj ? line : lineNo(line), span.to);

        if (side == 1) {
          return to;
        }
      }
    }

    return from && {
      from: from,
      to: to
    };
  }; // Signals that the marker's widget changed, and surrounding layout
  // should be recomputed.


  TextMarker.prototype.changed = function () {
    var this$1 = this;
    var pos = this.find(-1, true),
        widget = this,
        cm = this.doc.cm;

    if (!pos || !cm) {
      return;
    }

    runInOp(cm, function () {
      var line = pos.line,
          lineN = lineNo(pos.line);
      var view = findViewForLine(cm, lineN);

      if (view) {
        clearLineMeasurementCacheFor(view);
        cm.curOp.selectionChanged = cm.curOp.forceUpdate = true;
      }

      cm.curOp.updateMaxLine = true;

      if (!lineIsHidden(widget.doc, line) && widget.height != null) {
        var oldHeight = widget.height;
        widget.height = null;
        var dHeight = widgetHeight(widget) - oldHeight;

        if (dHeight) {
          updateLineHeight(line, line.height + dHeight);
        }
      }

      signalLater(cm, "markerChanged", cm, this$1);
    });
  };

  TextMarker.prototype.attachLine = function (line) {
    if (!this.lines.length && this.doc.cm) {
      var op = this.doc.cm.curOp;

      if (!op.maybeHiddenMarkers || indexOf(op.maybeHiddenMarkers, this) == -1) {
        (op.maybeUnhiddenMarkers || (op.maybeUnhiddenMarkers = [])).push(this);
      }
    }

    this.lines.push(line);
  };

  TextMarker.prototype.detachLine = function (line) {
    this.lines.splice(indexOf(this.lines, line), 1);

    if (!this.lines.length && this.doc.cm) {
      var op = this.doc.cm.curOp;
      (op.maybeHiddenMarkers || (op.maybeHiddenMarkers = [])).push(this);
    }
  };

  eventMixin(TextMarker); // Create a marker, wire it up to the right lines, and

  function _markText(doc, from, to, options, type) {
    // Shared markers (across linked documents) are handled separately
    // (markTextShared will call out to this again, once per
    // document).
    if (options && options.shared) {
      return markTextShared(doc, from, to, options, type);
    } // Ensure we are in an operation.


    if (doc.cm && !doc.cm.curOp) {
      return operation(doc.cm, _markText)(doc, from, to, options, type);
    }

    var marker = new TextMarker(doc, type),
        diff = cmp(from, to);

    if (options) {
      copyObj(options, marker, false);
    } // Don't connect empty markers unless clearWhenEmpty is false


    if (diff > 0 || diff == 0 && marker.clearWhenEmpty !== false) {
      return marker;
    }

    if (marker.replacedWith) {
      // Showing up as a widget implies collapsed (widget replaces text)
      marker.collapsed = true;
      marker.widgetNode = eltP("span", [marker.replacedWith], "CodeMirror-widget");

      if (!options.handleMouseEvents) {
        marker.widgetNode.setAttribute("cm-ignore-events", "true");
      }

      if (options.insertLeft) {
        marker.widgetNode.insertLeft = true;
      }
    }

    if (marker.collapsed) {
      if (conflictingCollapsedRange(doc, from.line, from, to, marker) || from.line != to.line && conflictingCollapsedRange(doc, to.line, from, to, marker)) {
        throw new Error("Inserting collapsed marker partially overlapping an existing one");
      }

      seeCollapsedSpans();
    }

    if (marker.addToHistory) {
      addChangeToHistory(doc, {
        from: from,
        to: to,
        origin: "markText"
      }, doc.sel, NaN);
    }

    var curLine = from.line,
        cm = doc.cm,
        updateMaxLine;
    doc.iter(curLine, to.line + 1, function (line) {
      if (cm && marker.collapsed && !cm.options.lineWrapping && visualLine(line) == cm.display.maxLine) {
        updateMaxLine = true;
      }

      if (marker.collapsed && curLine != from.line) {
        updateLineHeight(line, 0);
      }

      addMarkedSpan(line, new MarkedSpan(marker, curLine == from.line ? from.ch : null, curLine == to.line ? to.ch : null));
      ++curLine;
    }); // lineIsHidden depends on the presence of the spans, so needs a second pass

    if (marker.collapsed) {
      doc.iter(from.line, to.line + 1, function (line) {
        if (lineIsHidden(doc, line)) {
          updateLineHeight(line, 0);
        }
      });
    }

    if (marker.clearOnEnter) {
      on(marker, "beforeCursorEnter", function () {
        return marker.clear();
      });
    }

    if (marker.readOnly) {
      seeReadOnlySpans();

      if (doc.history.done.length || doc.history.undone.length) {
        doc.clearHistory();
      }
    }

    if (marker.collapsed) {
      marker.id = ++nextMarkerId;
      marker.atomic = true;
    }

    if (cm) {
      // Sync editor state
      if (updateMaxLine) {
        cm.curOp.updateMaxLine = true;
      }

      if (marker.collapsed) {
        regChange(cm, from.line, to.line + 1);
      } else if (marker.className || marker.startStyle || marker.endStyle || marker.css || marker.attributes || marker.title) {
        for (var i = from.line; i <= to.line; i++) {
          regLineChange(cm, i, "text");
        }
      }

      if (marker.atomic) {
        reCheckSelection(cm.doc);
      }

      signalLater(cm, "markerAdded", cm, marker);
    }

    return marker;
  } // SHARED TEXTMARKERS
  // A shared marker spans multiple linked documents. It is
  // implemented as a meta-marker-object controlling multiple normal
  // markers.


  var SharedTextMarker = function SharedTextMarker(markers, primary) {
    var this$1 = this;
    this.markers = markers;
    this.primary = primary;

    for (var i = 0; i < markers.length; ++i) {
      markers[i].parent = this$1;
    }
  };

  SharedTextMarker.prototype.clear = function () {
    var this$1 = this;

    if (this.explicitlyCleared) {
      return;
    }

    this.explicitlyCleared = true;

    for (var i = 0; i < this.markers.length; ++i) {
      this$1.markers[i].clear();
    }

    signalLater(this, "clear");
  };

  SharedTextMarker.prototype.find = function (side, lineObj) {
    return this.primary.find(side, lineObj);
  };

  eventMixin(SharedTextMarker);

  function markTextShared(doc, from, to, options, type) {
    options = copyObj(options);
    options.shared = false;
    var markers = [_markText(doc, from, to, options, type)],
        primary = markers[0];
    var widget = options.widgetNode;
    linkedDocs(doc, function (doc) {
      if (widget) {
        options.widgetNode = widget.cloneNode(true);
      }

      markers.push(_markText(doc, _clipPos(doc, from), _clipPos(doc, to), options, type));

      for (var i = 0; i < doc.linked.length; ++i) {
        if (doc.linked[i].isParent) {
          return;
        }
      }

      primary = lst(markers);
    });
    return new SharedTextMarker(markers, primary);
  }

  function findSharedMarkers(doc) {
    return doc.findMarks(Pos(doc.first, 0), doc.clipPos(Pos(doc.lastLine())), function (m) {
      return m.parent;
    });
  }

  function copySharedMarkers(doc, markers) {
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i],
          pos = marker.find();
      var mFrom = doc.clipPos(pos.from),
          mTo = doc.clipPos(pos.to);

      if (cmp(mFrom, mTo)) {
        var subMark = _markText(doc, mFrom, mTo, marker.primary, marker.primary.type);

        marker.markers.push(subMark);
        subMark.parent = marker;
      }
    }
  }

  function detachSharedMarkers(markers) {
    var loop = function loop(i) {
      var marker = markers[i],
          linked = [marker.primary.doc];
      linkedDocs(marker.primary.doc, function (d) {
        return linked.push(d);
      });

      for (var j = 0; j < marker.markers.length; j++) {
        var subMarker = marker.markers[j];

        if (indexOf(linked, subMarker.doc) == -1) {
          subMarker.parent = null;
          marker.markers.splice(j--, 1);
        }
      }
    };

    for (var i = 0; i < markers.length; i++) {
      loop(i);
    }
  }

  var nextDocId = 0;

  var Doc = function Doc(text, mode, firstLine, lineSep, direction) {
    if (!(this instanceof Doc)) {
      return new Doc(text, mode, firstLine, lineSep, direction);
    }

    if (firstLine == null) {
      firstLine = 0;
    }

    BranchChunk.call(this, [new LeafChunk([new Line("", null)])]);
    this.first = firstLine;
    this.scrollTop = this.scrollLeft = 0;
    this.cantEdit = false;
    this.cleanGeneration = 1;
    this.modeFrontier = this.highlightFrontier = firstLine;
    var start = Pos(firstLine, 0);
    this.sel = simpleSelection(start);
    this.history = new History(null);
    this.id = ++nextDocId;
    this.modeOption = mode;
    this.lineSep = lineSep;
    this.direction = direction == "rtl" ? "rtl" : "ltr";
    this.extend = false;

    if (typeof text == "string") {
      text = this.splitLines(text);
    }

    updateDoc(this, {
      from: start,
      to: start,
      text: text
    });
    setSelection(this, simpleSelection(start), sel_dontScroll);
  };

  Doc.prototype = createObj(BranchChunk.prototype, {
    constructor: Doc,
    // Iterate over the document. Supports two forms -- with only one
    // argument, it calls that for each line in the document. With
    // three, it iterates over the range given by the first two (with
    // the second being non-inclusive).
    iter: function iter(from, to, op) {
      if (op) {
        this.iterN(from - this.first, to - from, op);
      } else {
        this.iterN(this.first, this.first + this.size, from);
      }
    },
    // Non-public interface for adding and removing lines.
    insert: function insert(at, lines) {
      var height = 0;

      for (var i = 0; i < lines.length; ++i) {
        height += lines[i].height;
      }

      this.insertInner(at - this.first, lines, height);
    },
    remove: function remove(at, n) {
      this.removeInner(at - this.first, n);
    },
    // From here, the methods are part of the public interface. Most
    // are also available from CodeMirror (editor) instances.
    getValue: function getValue(lineSep) {
      var lines = getLines(this, this.first, this.first + this.size);

      if (lineSep === false) {
        return lines;
      }

      return lines.join(lineSep || this.lineSeparator());
    },
    setValue: docMethodOp(function (code) {
      var top = Pos(this.first, 0),
          last = this.first + this.size - 1;
      makeChange(this, {
        from: top,
        to: Pos(last, getLine(this, last).text.length),
        text: this.splitLines(code),
        origin: "setValue",
        full: true
      }, true);

      if (this.cm) {
        scrollToCoords(this.cm, 0, 0);
      }

      setSelection(this, simpleSelection(top), sel_dontScroll);
    }),
    replaceRange: function replaceRange(code, from, to, origin) {
      from = _clipPos(this, from);
      to = to ? _clipPos(this, to) : from;

      _replaceRange(this, code, from, to, origin);
    },
    getRange: function getRange(from, to, lineSep) {
      var lines = getBetween(this, _clipPos(this, from), _clipPos(this, to));

      if (lineSep === false) {
        return lines;
      }

      return lines.join(lineSep || this.lineSeparator());
    },
    getLine: function getLine(line) {
      var l = this.getLineHandle(line);
      return l && l.text;
    },
    getLineHandle: function getLineHandle(line) {
      if (isLine(this, line)) {
        return getLine(this, line);
      }
    },
    getLineNumber: function getLineNumber(line) {
      return lineNo(line);
    },
    getLineHandleVisualStart: function getLineHandleVisualStart(line) {
      if (typeof line == "number") {
        line = getLine(this, line);
      }

      return visualLine(line);
    },
    lineCount: function lineCount() {
      return this.size;
    },
    firstLine: function firstLine() {
      return this.first;
    },
    lastLine: function lastLine() {
      return this.first + this.size - 1;
    },
    clipPos: function clipPos(pos) {
      return _clipPos(this, pos);
    },
    getCursor: function getCursor(start) {
      var range$$1 = this.sel.primary(),
          pos;

      if (start == null || start == "head") {
        pos = range$$1.head;
      } else if (start == "anchor") {
        pos = range$$1.anchor;
      } else if (start == "end" || start == "to" || start === false) {
        pos = range$$1.to();
      } else {
        pos = range$$1.from();
      }

      return pos;
    },
    listSelections: function listSelections() {
      return this.sel.ranges;
    },
    somethingSelected: function somethingSelected() {
      return this.sel.somethingSelected();
    },
    setCursor: docMethodOp(function (line, ch, options) {
      setSimpleSelection(this, _clipPos(this, typeof line == "number" ? Pos(line, ch || 0) : line), null, options);
    }),
    setSelection: docMethodOp(function (anchor, head, options) {
      setSimpleSelection(this, _clipPos(this, anchor), _clipPos(this, head || anchor), options);
    }),
    extendSelection: docMethodOp(function (head, other, options) {
      extendSelection(this, _clipPos(this, head), other && _clipPos(this, other), options);
    }),
    extendSelections: docMethodOp(function (heads, options) {
      extendSelections(this, clipPosArray(this, heads), options);
    }),
    extendSelectionsBy: docMethodOp(function (f, options) {
      var heads = map(this.sel.ranges, f);
      extendSelections(this, clipPosArray(this, heads), options);
    }),
    setSelections: docMethodOp(function (ranges, primary, options) {
      var this$1 = this;

      if (!ranges.length) {
        return;
      }

      var out = [];

      for (var i = 0; i < ranges.length; i++) {
        out[i] = new Range(_clipPos(this$1, ranges[i].anchor), _clipPos(this$1, ranges[i].head));
      }

      if (primary == null) {
        primary = Math.min(ranges.length - 1, this.sel.primIndex);
      }

      setSelection(this, normalizeSelection(this.cm, out, primary), options);
    }),
    addSelection: docMethodOp(function (anchor, head, options) {
      var ranges = this.sel.ranges.slice(0);
      ranges.push(new Range(_clipPos(this, anchor), _clipPos(this, head || anchor)));
      setSelection(this, normalizeSelection(this.cm, ranges, ranges.length - 1), options);
    }),
    getSelection: function getSelection(lineSep) {
      var this$1 = this;
      var ranges = this.sel.ranges,
          lines;

      for (var i = 0; i < ranges.length; i++) {
        var sel = getBetween(this$1, ranges[i].from(), ranges[i].to());
        lines = lines ? lines.concat(sel) : sel;
      }

      if (lineSep === false) {
        return lines;
      } else {
        return lines.join(lineSep || this.lineSeparator());
      }
    },
    getSelections: function getSelections(lineSep) {
      var this$1 = this;
      var parts = [],
          ranges = this.sel.ranges;

      for (var i = 0; i < ranges.length; i++) {
        var sel = getBetween(this$1, ranges[i].from(), ranges[i].to());

        if (lineSep !== false) {
          sel = sel.join(lineSep || this$1.lineSeparator());
        }

        parts[i] = sel;
      }

      return parts;
    },
    replaceSelection: function replaceSelection(code, collapse, origin) {
      var dup = [];

      for (var i = 0; i < this.sel.ranges.length; i++) {
        dup[i] = code;
      }

      this.replaceSelections(dup, collapse, origin || "+input");
    },
    replaceSelections: docMethodOp(function (code, collapse, origin) {
      var this$1 = this;
      var changes = [],
          sel = this.sel;

      for (var i = 0; i < sel.ranges.length; i++) {
        var range$$1 = sel.ranges[i];
        changes[i] = {
          from: range$$1.from(),
          to: range$$1.to(),
          text: this$1.splitLines(code[i]),
          origin: origin
        };
      }

      var newSel = collapse && collapse != "end" && computeReplacedSel(this, changes, collapse);

      for (var i$1 = changes.length - 1; i$1 >= 0; i$1--) {
        makeChange(this$1, changes[i$1]);
      }

      if (newSel) {
        setSelectionReplaceHistory(this, newSel);
      } else if (this.cm) {
        ensureCursorVisible(this.cm);
      }
    }),
    undo: docMethodOp(function () {
      makeChangeFromHistory(this, "undo");
    }),
    redo: docMethodOp(function () {
      makeChangeFromHistory(this, "redo");
    }),
    undoSelection: docMethodOp(function () {
      makeChangeFromHistory(this, "undo", true);
    }),
    redoSelection: docMethodOp(function () {
      makeChangeFromHistory(this, "redo", true);
    }),
    setExtending: function setExtending(val) {
      this.extend = val;
    },
    getExtending: function getExtending() {
      return this.extend;
    },
    historySize: function historySize() {
      var hist = this.history,
          done = 0,
          undone = 0;

      for (var i = 0; i < hist.done.length; i++) {
        if (!hist.done[i].ranges) {
          ++done;
        }
      }

      for (var i$1 = 0; i$1 < hist.undone.length; i$1++) {
        if (!hist.undone[i$1].ranges) {
          ++undone;
        }
      }

      return {
        undo: done,
        redo: undone
      };
    },
    clearHistory: function clearHistory() {
      this.history = new History(this.history.maxGeneration);
    },
    markClean: function markClean() {
      this.cleanGeneration = this.changeGeneration(true);
    },
    changeGeneration: function changeGeneration(forceSplit) {
      if (forceSplit) {
        this.history.lastOp = this.history.lastSelOp = this.history.lastOrigin = null;
      }

      return this.history.generation;
    },
    isClean: function isClean(gen) {
      return this.history.generation == (gen || this.cleanGeneration);
    },
    getHistory: function getHistory() {
      return {
        done: copyHistoryArray(this.history.done),
        undone: copyHistoryArray(this.history.undone)
      };
    },
    setHistory: function setHistory(histData) {
      var hist = this.history = new History(this.history.maxGeneration);
      hist.done = copyHistoryArray(histData.done.slice(0), null, true);
      hist.undone = copyHistoryArray(histData.undone.slice(0), null, true);
    },
    setGutterMarker: docMethodOp(function (line, gutterID, value) {
      return changeLine(this, line, "gutter", function (line) {
        var markers = line.gutterMarkers || (line.gutterMarkers = {});
        markers[gutterID] = value;

        if (!value && isEmpty(markers)) {
          line.gutterMarkers = null;
        }

        return true;
      });
    }),
    clearGutter: docMethodOp(function (gutterID) {
      var this$1 = this;
      this.iter(function (line) {
        if (line.gutterMarkers && line.gutterMarkers[gutterID]) {
          changeLine(this$1, line, "gutter", function () {
            line.gutterMarkers[gutterID] = null;

            if (isEmpty(line.gutterMarkers)) {
              line.gutterMarkers = null;
            }

            return true;
          });
        }
      });
    }),
    lineInfo: function lineInfo(line) {
      var n;

      if (typeof line == "number") {
        if (!isLine(this, line)) {
          return null;
        }

        n = line;
        line = getLine(this, line);

        if (!line) {
          return null;
        }
      } else {
        n = lineNo(line);

        if (n == null) {
          return null;
        }
      }

      return {
        line: n,
        handle: line,
        text: line.text,
        gutterMarkers: line.gutterMarkers,
        textClass: line.textClass,
        bgClass: line.bgClass,
        wrapClass: line.wrapClass,
        widgets: line.widgets
      };
    },
    addLineClass: docMethodOp(function (handle, where, cls) {
      return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
        var prop = where == "text" ? "textClass" : where == "background" ? "bgClass" : where == "gutter" ? "gutterClass" : "wrapClass";

        if (!line[prop]) {
          line[prop] = cls;
        } else if (classTest(cls).test(line[prop])) {
          return false;
        } else {
          line[prop] += " " + cls;
        }

        return true;
      });
    }),
    removeLineClass: docMethodOp(function (handle, where, cls) {
      return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
        var prop = where == "text" ? "textClass" : where == "background" ? "bgClass" : where == "gutter" ? "gutterClass" : "wrapClass";
        var cur = line[prop];

        if (!cur) {
          return false;
        } else if (cls == null) {
          line[prop] = null;
        } else {
          var found = cur.match(classTest(cls));

          if (!found) {
            return false;
          }

          var end = found.index + found[0].length;
          line[prop] = cur.slice(0, found.index) + (!found.index || end == cur.length ? "" : " ") + cur.slice(end) || null;
        }

        return true;
      });
    }),
    addLineWidget: docMethodOp(function (handle, node, options) {
      return addLineWidget(this, handle, node, options);
    }),
    removeLineWidget: function removeLineWidget(widget) {
      widget.clear();
    },
    markText: function markText(from, to, options) {
      return _markText(this, _clipPos(this, from), _clipPos(this, to), options, options && options.type || "range");
    },
    setBookmark: function setBookmark(pos, options) {
      var realOpts = {
        replacedWith: options && (options.nodeType == null ? options.widget : options),
        insertLeft: options && options.insertLeft,
        clearWhenEmpty: false,
        shared: options && options.shared,
        handleMouseEvents: options && options.handleMouseEvents
      };
      pos = _clipPos(this, pos);
      return _markText(this, pos, pos, realOpts, "bookmark");
    },
    findMarksAt: function findMarksAt(pos) {
      pos = _clipPos(this, pos);
      var markers = [],
          spans = getLine(this, pos.line).markedSpans;

      if (spans) {
        for (var i = 0; i < spans.length; ++i) {
          var span = spans[i];

          if ((span.from == null || span.from <= pos.ch) && (span.to == null || span.to >= pos.ch)) {
            markers.push(span.marker.parent || span.marker);
          }
        }
      }

      return markers;
    },
    findMarks: function findMarks(from, to, filter) {
      from = _clipPos(this, from);
      to = _clipPos(this, to);
      var found = [],
          lineNo$$1 = from.line;
      this.iter(from.line, to.line + 1, function (line) {
        var spans = line.markedSpans;

        if (spans) {
          for (var i = 0; i < spans.length; i++) {
            var span = spans[i];

            if (!(span.to != null && lineNo$$1 == from.line && from.ch >= span.to || span.from == null && lineNo$$1 != from.line || span.from != null && lineNo$$1 == to.line && span.from >= to.ch) && (!filter || filter(span.marker))) {
              found.push(span.marker.parent || span.marker);
            }
          }
        }

        ++lineNo$$1;
      });
      return found;
    },
    getAllMarks: function getAllMarks() {
      var markers = [];
      this.iter(function (line) {
        var sps = line.markedSpans;

        if (sps) {
          for (var i = 0; i < sps.length; ++i) {
            if (sps[i].from != null) {
              markers.push(sps[i].marker);
            }
          }
        }
      });
      return markers;
    },
    posFromIndex: function posFromIndex(off) {
      var ch,
          lineNo$$1 = this.first,
          sepSize = this.lineSeparator().length;
      this.iter(function (line) {
        var sz = line.text.length + sepSize;

        if (sz > off) {
          ch = off;
          return true;
        }

        off -= sz;
        ++lineNo$$1;
      });
      return _clipPos(this, Pos(lineNo$$1, ch));
    },
    indexFromPos: function indexFromPos(coords) {
      coords = _clipPos(this, coords);
      var index = coords.ch;

      if (coords.line < this.first || coords.ch < 0) {
        return 0;
      }

      var sepSize = this.lineSeparator().length;
      this.iter(this.first, coords.line, function (line) {
        // iter aborts when callback returns a truthy value
        index += line.text.length + sepSize;
      });
      return index;
    },
    copy: function copy(copyHistory) {
      var doc = new Doc(getLines(this, this.first, this.first + this.size), this.modeOption, this.first, this.lineSep, this.direction);
      doc.scrollTop = this.scrollTop;
      doc.scrollLeft = this.scrollLeft;
      doc.sel = this.sel;
      doc.extend = false;

      if (copyHistory) {
        doc.history.undoDepth = this.history.undoDepth;
        doc.setHistory(this.getHistory());
      }

      return doc;
    },
    linkedDoc: function linkedDoc(options) {
      if (!options) {
        options = {};
      }

      var from = this.first,
          to = this.first + this.size;

      if (options.from != null && options.from > from) {
        from = options.from;
      }

      if (options.to != null && options.to < to) {
        to = options.to;
      }

      var copy = new Doc(getLines(this, from, to), options.mode || this.modeOption, from, this.lineSep, this.direction);

      if (options.sharedHist) {
        copy.history = this.history;
      }

      (this.linked || (this.linked = [])).push({
        doc: copy,
        sharedHist: options.sharedHist
      });
      copy.linked = [{
        doc: this,
        isParent: true,
        sharedHist: options.sharedHist
      }];
      copySharedMarkers(copy, findSharedMarkers(this));
      return copy;
    },
    unlinkDoc: function unlinkDoc(other) {
      var this$1 = this;

      if (other instanceof CodeMirror) {
        other = other.doc;
      }

      if (this.linked) {
        for (var i = 0; i < this.linked.length; ++i) {
          var link = this$1.linked[i];

          if (link.doc != other) {
            continue;
          }

          this$1.linked.splice(i, 1);
          other.unlinkDoc(this$1);
          detachSharedMarkers(findSharedMarkers(this$1));
          break;
        }
      } // If the histories were shared, split them again


      if (other.history == this.history) {
        var splitIds = [other.id];
        linkedDocs(other, function (doc) {
          return splitIds.push(doc.id);
        }, true);
        other.history = new History(null);
        other.history.done = copyHistoryArray(this.history.done, splitIds);
        other.history.undone = copyHistoryArray(this.history.undone, splitIds);
      }
    },
    iterLinkedDocs: function iterLinkedDocs(f) {
      linkedDocs(this, f);
    },
    getMode: function getMode() {
      return this.mode;
    },
    getEditor: function getEditor() {
      return this.cm;
    },
    splitLines: function splitLines(str) {
      if (this.lineSep) {
        return str.split(this.lineSep);
      }

      return splitLinesAuto(str);
    },
    lineSeparator: function lineSeparator() {
      return this.lineSep || "\n";
    },
    setDirection: docMethodOp(function (dir) {
      if (dir != "rtl") {
        dir = "ltr";
      }

      if (dir == this.direction) {
        return;
      }

      this.direction = dir;
      this.iter(function (line) {
        return line.order = null;
      });

      if (this.cm) {
        directionChanged(this.cm);
      }
    })
  }); // Public alias.

  Doc.prototype.eachLine = Doc.prototype.iter; // Kludge to work around strange IE behavior where it'll sometimes
  // re-fire a series of drag-related events right after the drop (#1551)

  var lastDrop = 0;

  function onDrop(e) {
    var cm = this;
    clearDragCursor(cm);

    if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e)) {
      return;
    }

    e_preventDefault(e);

    if (ie) {
      lastDrop = +new Date();
    }

    var pos = posFromMouse(cm, e, true),
        files = e.dataTransfer.files;

    if (!pos || cm.isReadOnly()) {
      return;
    } // Might be a file drop, in which case we simply extract the text
    // and insert it.


    if (files && files.length && window.FileReader && window.File) {
      var n = files.length,
          text = Array(n),
          read = 0;

      var loadFile = function loadFile(file, i) {
        if (cm.options.allowDropFileTypes && indexOf(cm.options.allowDropFileTypes, file.type) == -1) {
          return;
        }

        var reader = new FileReader();
        reader.onload = operation(cm, function () {
          var content = reader.result;

          if (/[\x00-\x08\x0e-\x1f]{2}/.test(content)) {
            content = "";
          }

          text[i] = content;

          if (++read == n) {
            pos = _clipPos(cm.doc, pos);
            var change = {
              from: pos,
              to: pos,
              text: cm.doc.splitLines(text.join(cm.doc.lineSeparator())),
              origin: "paste"
            };
            makeChange(cm.doc, change);
            setSelectionReplaceHistory(cm.doc, simpleSelection(pos, changeEnd(change)));
          }
        });
        reader.readAsText(file);
      };

      for (var i = 0; i < n; ++i) {
        loadFile(files[i], i);
      }
    } else {
      // Normal drop
      // Don't do a replace if the drop happened inside of the selected text.
      if (cm.state.draggingText && cm.doc.sel.contains(pos) > -1) {
        cm.state.draggingText(e); // Ensure the editor is re-focused

        setTimeout(function () {
          return cm.display.input.focus();
        }, 20);
        return;
      }

      try {
        var text$1 = e.dataTransfer.getData("Text");

        if (text$1) {
          var selected;

          if (cm.state.draggingText && !cm.state.draggingText.copy) {
            selected = cm.listSelections();
          }

          setSelectionNoUndo(cm.doc, simpleSelection(pos, pos));

          if (selected) {
            for (var i$1 = 0; i$1 < selected.length; ++i$1) {
              _replaceRange(cm.doc, "", selected[i$1].anchor, selected[i$1].head, "drag");
            }
          }

          cm.replaceSelection(text$1, "around", "paste");
          cm.display.input.focus();
        }
      } catch (e) {}
    }
  }

  function onDragStart(cm, e) {
    if (ie && (!cm.state.draggingText || +new Date() - lastDrop < 100)) {
      e_stop(e);
      return;
    }

    if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e)) {
      return;
    }

    e.dataTransfer.setData("Text", cm.getSelection());
    e.dataTransfer.effectAllowed = "copyMove"; // Use dummy image instead of default browsers image.
    // Recent Safari (~6.0.2) have a tendency to segfault when this happens, so we don't do it there.

    if (e.dataTransfer.setDragImage && !safari) {
      var img = elt("img", null, null, "position: fixed; left: 0; top: 0;");
      img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

      if (presto) {
        img.width = img.height = 1;
        cm.display.wrapper.appendChild(img); // Force a relayout, or Opera won't use our image for some obscure reason

        img._top = img.offsetTop;
      }

      e.dataTransfer.setDragImage(img, 0, 0);

      if (presto) {
        img.parentNode.removeChild(img);
      }
    }
  }

  function onDragOver(cm, e) {
    var pos = posFromMouse(cm, e);

    if (!pos) {
      return;
    }

    var frag = document.createDocumentFragment();
    drawSelectionCursor(cm, pos, frag);

    if (!cm.display.dragCursor) {
      cm.display.dragCursor = elt("div", null, "CodeMirror-cursors CodeMirror-dragcursors");
      cm.display.lineSpace.insertBefore(cm.display.dragCursor, cm.display.cursorDiv);
    }

    removeChildrenAndAdd(cm.display.dragCursor, frag);
  }

  function clearDragCursor(cm) {
    if (cm.display.dragCursor) {
      cm.display.lineSpace.removeChild(cm.display.dragCursor);
      cm.display.dragCursor = null;
    }
  } // These must be handled carefully, because naively registering a
  // handler for each editor will cause the editors to never be
  // garbage collected.


  function forEachCodeMirror(f) {
    if (!document.getElementsByClassName) {
      return;
    }

    var byClass = document.getElementsByClassName("CodeMirror"),
        editors = [];

    for (var i = 0; i < byClass.length; i++) {
      var cm = byClass[i].CodeMirror;

      if (cm) {
        editors.push(cm);
      }
    }

    if (editors.length) {
      editors[0].operation(function () {
        for (var i = 0; i < editors.length; i++) {
          f(editors[i]);
        }
      });
    }
  }

  var globalsRegistered = false;

  function ensureGlobalHandlers() {
    if (globalsRegistered) {
      return;
    }

    registerGlobalHandlers();
    globalsRegistered = true;
  }

  function registerGlobalHandlers() {
    // When the window resizes, we need to refresh active editors.
    var resizeTimer;
    on(window, "resize", function () {
      if (resizeTimer == null) {
        resizeTimer = setTimeout(function () {
          resizeTimer = null;
          forEachCodeMirror(onResize);
        }, 100);
      }
    }); // When the window loses focus, we want to show the editor as blurred

    on(window, "blur", function () {
      return forEachCodeMirror(onBlur);
    });
  } // Called when the window resizes


  function onResize(cm) {
    var d = cm.display; // Might be a text scaling operation, clear size caches.

    d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;
    d.scrollbarsClipped = false;
    cm.setSize();
  }

  var keyNames = {
    3: "Pause",
    8: "Backspace",
    9: "Tab",
    13: "Enter",
    16: "Shift",
    17: "Ctrl",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Esc",
    32: "Space",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "Left",
    38: "Up",
    39: "Right",
    40: "Down",
    44: "PrintScrn",
    45: "Insert",
    46: "Delete",
    59: ";",
    61: "=",
    91: "Mod",
    92: "Mod",
    93: "Mod",
    106: "*",
    107: "=",
    109: "-",
    110: ".",
    111: "/",
    145: "ScrollLock",
    173: "-",
    186: ";",
    187: "=",
    188: ",",
    189: "-",
    190: ".",
    191: "/",
    192: "`",
    219: "[",
    220: "\\",
    221: "]",
    222: "'",
    63232: "Up",
    63233: "Down",
    63234: "Left",
    63235: "Right",
    63272: "Delete",
    63273: "Home",
    63275: "End",
    63276: "PageUp",
    63277: "PageDown",
    63302: "Insert"
  }; // Number keys

  for (var i = 0; i < 10; i++) {
    keyNames[i + 48] = keyNames[i + 96] = String(i);
  } // Alphabetic keys


  for (var i$1 = 65; i$1 <= 90; i$1++) {
    keyNames[i$1] = String.fromCharCode(i$1);
  } // Function keys


  for (var i$2 = 1; i$2 <= 12; i$2++) {
    keyNames[i$2 + 111] = keyNames[i$2 + 63235] = "F" + i$2;
  }

  var keyMap = {};
  keyMap.basic = {
    "Left": "goCharLeft",
    "Right": "goCharRight",
    "Up": "goLineUp",
    "Down": "goLineDown",
    "End": "goLineEnd",
    "Home": "goLineStartSmart",
    "PageUp": "goPageUp",
    "PageDown": "goPageDown",
    "Delete": "delCharAfter",
    "Backspace": "delCharBefore",
    "Shift-Backspace": "delCharBefore",
    "Tab": "defaultTab",
    "Shift-Tab": "indentAuto",
    "Enter": "newlineAndIndent",
    "Insert": "toggleOverwrite",
    "Esc": "singleSelection"
  }; // Note that the save and find-related commands aren't defined by
  // default. User code or addons can define them. Unknown commands
  // are simply ignored.

  keyMap.pcDefault = {
    "Ctrl-A": "selectAll",
    "Ctrl-D": "deleteLine",
    "Ctrl-Z": "undo",
    "Shift-Ctrl-Z": "redo",
    "Ctrl-Y": "redo",
    "Ctrl-Home": "goDocStart",
    "Ctrl-End": "goDocEnd",
    "Ctrl-Up": "goLineUp",
    "Ctrl-Down": "goLineDown",
    "Ctrl-Left": "goGroupLeft",
    "Ctrl-Right": "goGroupRight",
    "Alt-Left": "goLineStart",
    "Alt-Right": "goLineEnd",
    "Ctrl-Backspace": "delGroupBefore",
    "Ctrl-Delete": "delGroupAfter",
    "Ctrl-S": "save",
    "Ctrl-F": "find",
    "Ctrl-G": "findNext",
    "Shift-Ctrl-G": "findPrev",
    "Shift-Ctrl-F": "replace",
    "Shift-Ctrl-R": "replaceAll",
    "Ctrl-[": "indentLess",
    "Ctrl-]": "indentMore",
    "Ctrl-U": "undoSelection",
    "Shift-Ctrl-U": "redoSelection",
    "Alt-U": "redoSelection",
    "fallthrough": "basic"
  }; // Very basic readline/emacs-style bindings, which are standard on Mac.

  keyMap.emacsy = {
    "Ctrl-F": "goCharRight",
    "Ctrl-B": "goCharLeft",
    "Ctrl-P": "goLineUp",
    "Ctrl-N": "goLineDown",
    "Alt-F": "goWordRight",
    "Alt-B": "goWordLeft",
    "Ctrl-A": "goLineStart",
    "Ctrl-E": "goLineEnd",
    "Ctrl-V": "goPageDown",
    "Shift-Ctrl-V": "goPageUp",
    "Ctrl-D": "delCharAfter",
    "Ctrl-H": "delCharBefore",
    "Alt-D": "delWordAfter",
    "Alt-Backspace": "delWordBefore",
    "Ctrl-K": "killLine",
    "Ctrl-T": "transposeChars",
    "Ctrl-O": "openLine"
  };
  keyMap.macDefault = {
    "Cmd-A": "selectAll",
    "Cmd-D": "deleteLine",
    "Cmd-Z": "undo",
    "Shift-Cmd-Z": "redo",
    "Cmd-Y": "redo",
    "Cmd-Home": "goDocStart",
    "Cmd-Up": "goDocStart",
    "Cmd-End": "goDocEnd",
    "Cmd-Down": "goDocEnd",
    "Alt-Left": "goGroupLeft",
    "Alt-Right": "goGroupRight",
    "Cmd-Left": "goLineLeft",
    "Cmd-Right": "goLineRight",
    "Alt-Backspace": "delGroupBefore",
    "Ctrl-Alt-Backspace": "delGroupAfter",
    "Alt-Delete": "delGroupAfter",
    "Cmd-S": "save",
    "Cmd-F": "find",
    "Cmd-G": "findNext",
    "Shift-Cmd-G": "findPrev",
    "Cmd-Alt-F": "replace",
    "Shift-Cmd-Alt-F": "replaceAll",
    "Cmd-[": "indentLess",
    "Cmd-]": "indentMore",
    "Cmd-Backspace": "delWrappedLineLeft",
    "Cmd-Delete": "delWrappedLineRight",
    "Cmd-U": "undoSelection",
    "Shift-Cmd-U": "redoSelection",
    "Ctrl-Up": "goDocStart",
    "Ctrl-Down": "goDocEnd",
    "fallthrough": ["basic", "emacsy"]
  };
  keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault; // KEYMAP DISPATCH

  function normalizeKeyName(name) {
    var parts = name.split(/-(?!$)/);
    name = parts[parts.length - 1];
    var alt, ctrl, shift, cmd;

    for (var i = 0; i < parts.length - 1; i++) {
      var mod = parts[i];

      if (/^(cmd|meta|m)$/i.test(mod)) {
        cmd = true;
      } else if (/^a(lt)?$/i.test(mod)) {
        alt = true;
      } else if (/^(c|ctrl|control)$/i.test(mod)) {
        ctrl = true;
      } else if (/^s(hift)?$/i.test(mod)) {
        shift = true;
      } else {
        throw new Error("Unrecognized modifier name: " + mod);
      }
    }

    if (alt) {
      name = "Alt-" + name;
    }

    if (ctrl) {
      name = "Ctrl-" + name;
    }

    if (cmd) {
      name = "Cmd-" + name;
    }

    if (shift) {
      name = "Shift-" + name;
    }

    return name;
  } // This is a kludge to keep keymaps mostly working as raw objects
  // (backwards compatibility) while at the same time support features
  // like normalization and multi-stroke key bindings. It compiles a
  // new normalized keymap, and then updates the old object to reflect
  // this.


  function normalizeKeyMap(keymap) {
    var copy = {};

    for (var keyname in keymap) {
      if (keymap.hasOwnProperty(keyname)) {
        var value = keymap[keyname];

        if (/^(name|fallthrough|(de|at)tach)$/.test(keyname)) {
          continue;
        }

        if (value == "...") {
          delete keymap[keyname];
          continue;
        }

        var keys = map(keyname.split(" "), normalizeKeyName);

        for (var i = 0; i < keys.length; i++) {
          var val = void 0,
              name = void 0;

          if (i == keys.length - 1) {
            name = keys.join(" ");
            val = value;
          } else {
            name = keys.slice(0, i + 1).join(" ");
            val = "...";
          }

          var prev = copy[name];

          if (!prev) {
            copy[name] = val;
          } else if (prev != val) {
            throw new Error("Inconsistent bindings for " + name);
          }
        }

        delete keymap[keyname];
      }
    }

    for (var prop in copy) {
      keymap[prop] = copy[prop];
    }

    return keymap;
  }

  function lookupKey(key, map$$1, handle, context) {
    map$$1 = getKeyMap(map$$1);
    var found = map$$1.call ? map$$1.call(key, context) : map$$1[key];

    if (found === false) {
      return "nothing";
    }

    if (found === "...") {
      return "multi";
    }

    if (found != null && handle(found)) {
      return "handled";
    }

    if (map$$1.fallthrough) {
      if (Object.prototype.toString.call(map$$1.fallthrough) != "[object Array]") {
        return lookupKey(key, map$$1.fallthrough, handle, context);
      }

      for (var i = 0; i < map$$1.fallthrough.length; i++) {
        var result = lookupKey(key, map$$1.fallthrough[i], handle, context);

        if (result) {
          return result;
        }
      }
    }
  } // Modifier key presses don't count as 'real' key presses for the
  // purpose of keymap fallthrough.


  function isModifierKey(value) {
    var name = typeof value == "string" ? value : keyNames[value.keyCode];
    return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod";
  }

  function addModifierNames(name, event, noShift) {
    var base = name;

    if (event.altKey && base != "Alt") {
      name = "Alt-" + name;
    }

    if ((flipCtrlCmd ? event.metaKey : event.ctrlKey) && base != "Ctrl") {
      name = "Ctrl-" + name;
    }

    if ((flipCtrlCmd ? event.ctrlKey : event.metaKey) && base != "Cmd") {
      name = "Cmd-" + name;
    }

    if (!noShift && event.shiftKey && base != "Shift") {
      name = "Shift-" + name;
    }

    return name;
  } // Look up the name of a key as indicated by an event object.


  function keyName(event, noShift) {
    if (presto && event.keyCode == 34 && event["char"]) {
      return false;
    }

    var name = keyNames[event.keyCode];

    if (name == null || event.altGraphKey) {
      return false;
    } // Ctrl-ScrollLock has keyCode 3, same as Ctrl-Pause,
    // so we'll use event.code when available (Chrome 48+, FF 38+, Safari 10.1+)


    if (event.keyCode == 3 && event.code) {
      name = event.code;
    }

    return addModifierNames(name, event, noShift);
  }

  function getKeyMap(val) {
    return typeof val == "string" ? keyMap[val] : val;
  } // Helper for deleting text near the selection(s), used to implement
  // backspace, delete, and similar functionality.


  function deleteNearSelection(cm, compute) {
    var ranges = cm.doc.sel.ranges,
        kill = []; // Build up a set of ranges to kill first, merging overlapping
    // ranges.

    for (var i = 0; i < ranges.length; i++) {
      var toKill = compute(ranges[i]);

      while (kill.length && cmp(toKill.from, lst(kill).to) <= 0) {
        var replaced = kill.pop();

        if (cmp(replaced.from, toKill.from) < 0) {
          toKill.from = replaced.from;
          break;
        }
      }

      kill.push(toKill);
    } // Next, remove those actual ranges.


    runInOp(cm, function () {
      for (var i = kill.length - 1; i >= 0; i--) {
        _replaceRange(cm.doc, "", kill[i].from, kill[i].to, "+delete");
      }

      ensureCursorVisible(cm);
    });
  }

  function moveCharLogically(line, ch, dir) {
    var target = skipExtendingChars(line.text, ch + dir, dir);
    return target < 0 || target > line.text.length ? null : target;
  }

  function moveLogically(line, start, dir) {
    var ch = moveCharLogically(line, start.ch, dir);
    return ch == null ? null : new Pos(start.line, ch, dir < 0 ? "after" : "before");
  }

  function endOfLine(visually, cm, lineObj, lineNo, dir) {
    if (visually) {
      var order = getOrder(lineObj, cm.doc.direction);

      if (order) {
        var part = dir < 0 ? lst(order) : order[0];
        var moveInStorageOrder = dir < 0 == (part.level == 1);
        var sticky = moveInStorageOrder ? "after" : "before";
        var ch; // With a wrapped rtl chunk (possibly spanning multiple bidi parts),
        // it could be that the last bidi part is not on the last visual line,
        // since visual lines contain content order-consecutive chunks.
        // Thus, in rtl, we are looking for the first (content-order) character
        // in the rtl chunk that is on the last line (that is, the same line
        // as the last (content-order) character).

        if (part.level > 0 || cm.doc.direction == "rtl") {
          var prep = prepareMeasureForLine(cm, lineObj);
          ch = dir < 0 ? lineObj.text.length - 1 : 0;
          var targetTop = measureCharPrepared(cm, prep, ch).top;
          ch = findFirst(function (ch) {
            return measureCharPrepared(cm, prep, ch).top == targetTop;
          }, dir < 0 == (part.level == 1) ? part.from : part.to - 1, ch);

          if (sticky == "before") {
            ch = moveCharLogically(lineObj, ch, 1);
          }
        } else {
          ch = dir < 0 ? part.to : part.from;
        }

        return new Pos(lineNo, ch, sticky);
      }
    }

    return new Pos(lineNo, dir < 0 ? lineObj.text.length : 0, dir < 0 ? "before" : "after");
  }

  function moveVisually(cm, line, start, dir) {
    var bidi = getOrder(line, cm.doc.direction);

    if (!bidi) {
      return moveLogically(line, start, dir);
    }

    if (start.ch >= line.text.length) {
      start.ch = line.text.length;
      start.sticky = "before";
    } else if (start.ch <= 0) {
      start.ch = 0;
      start.sticky = "after";
    }

    var partPos = getBidiPartAt(bidi, start.ch, start.sticky),
        part = bidi[partPos];

    if (cm.doc.direction == "ltr" && part.level % 2 == 0 && (dir > 0 ? part.to > start.ch : part.from < start.ch)) {
      // Case 1: We move within an ltr part in an ltr editor. Even with wrapped lines,
      // nothing interesting happens.
      return moveLogically(line, start, dir);
    }

    var mv = function mv(pos, dir) {
      return moveCharLogically(line, pos instanceof Pos ? pos.ch : pos, dir);
    };

    var prep;

    var getWrappedLineExtent = function getWrappedLineExtent(ch) {
      if (!cm.options.lineWrapping) {
        return {
          begin: 0,
          end: line.text.length
        };
      }

      prep = prep || prepareMeasureForLine(cm, line);
      return wrappedLineExtentChar(cm, line, prep, ch);
    };

    var wrappedLineExtent = getWrappedLineExtent(start.sticky == "before" ? mv(start, -1) : start.ch);

    if (cm.doc.direction == "rtl" || part.level == 1) {
      var moveInStorageOrder = part.level == 1 == dir < 0;
      var ch = mv(start, moveInStorageOrder ? 1 : -1);

      if (ch != null && (!moveInStorageOrder ? ch >= part.from && ch >= wrappedLineExtent.begin : ch <= part.to && ch <= wrappedLineExtent.end)) {
        // Case 2: We move within an rtl part or in an rtl editor on the same visual line
        var sticky = moveInStorageOrder ? "before" : "after";
        return new Pos(start.line, ch, sticky);
      }
    } // Case 3: Could not move within this bidi part in this visual line, so leave
    // the current bidi part


    var searchInVisualLine = function searchInVisualLine(partPos, dir, wrappedLineExtent) {
      var getRes = function getRes(ch, moveInStorageOrder) {
        return moveInStorageOrder ? new Pos(start.line, mv(ch, 1), "before") : new Pos(start.line, ch, "after");
      };

      for (; partPos >= 0 && partPos < bidi.length; partPos += dir) {
        var part = bidi[partPos];
        var moveInStorageOrder = dir > 0 == (part.level != 1);
        var ch = moveInStorageOrder ? wrappedLineExtent.begin : mv(wrappedLineExtent.end, -1);

        if (part.from <= ch && ch < part.to) {
          return getRes(ch, moveInStorageOrder);
        }

        ch = moveInStorageOrder ? part.from : mv(part.to, -1);

        if (wrappedLineExtent.begin <= ch && ch < wrappedLineExtent.end) {
          return getRes(ch, moveInStorageOrder);
        }
      }
    }; // Case 3a: Look for other bidi parts on the same visual line


    var res = searchInVisualLine(partPos + dir, dir, wrappedLineExtent);

    if (res) {
      return res;
    } // Case 3b: Look for other bidi parts on the next visual line


    var nextCh = dir > 0 ? wrappedLineExtent.end : mv(wrappedLineExtent.begin, -1);

    if (nextCh != null && !(dir > 0 && nextCh == line.text.length)) {
      res = searchInVisualLine(dir > 0 ? 0 : bidi.length - 1, dir, getWrappedLineExtent(nextCh));

      if (res) {
        return res;
      }
    } // Case 4: Nowhere to move


    return null;
  } // Commands are parameter-less actions that can be performed on an
  // editor, mostly used for keybindings.


  var commands = {
    selectAll: selectAll,
    singleSelection: function singleSelection(cm) {
      return cm.setSelection(cm.getCursor("anchor"), cm.getCursor("head"), sel_dontScroll);
    },
    killLine: function killLine(cm) {
      return deleteNearSelection(cm, function (range) {
        if (range.empty()) {
          var len = getLine(cm.doc, range.head.line).text.length;

          if (range.head.ch == len && range.head.line < cm.lastLine()) {
            return {
              from: range.head,
              to: Pos(range.head.line + 1, 0)
            };
          } else {
            return {
              from: range.head,
              to: Pos(range.head.line, len)
            };
          }
        } else {
          return {
            from: range.from(),
            to: range.to()
          };
        }
      });
    },
    deleteLine: function deleteLine(cm) {
      return deleteNearSelection(cm, function (range) {
        return {
          from: Pos(range.from().line, 0),
          to: _clipPos(cm.doc, Pos(range.to().line + 1, 0))
        };
      });
    },
    delLineLeft: function delLineLeft(cm) {
      return deleteNearSelection(cm, function (range) {
        return {
          from: Pos(range.from().line, 0),
          to: range.from()
        };
      });
    },
    delWrappedLineLeft: function delWrappedLineLeft(cm) {
      return deleteNearSelection(cm, function (range) {
        var top = cm.charCoords(range.head, "div").top + 5;
        var leftPos = cm.coordsChar({
          left: 0,
          top: top
        }, "div");
        return {
          from: leftPos,
          to: range.from()
        };
      });
    },
    delWrappedLineRight: function delWrappedLineRight(cm) {
      return deleteNearSelection(cm, function (range) {
        var top = cm.charCoords(range.head, "div").top + 5;
        var rightPos = cm.coordsChar({
          left: cm.display.lineDiv.offsetWidth + 100,
          top: top
        }, "div");
        return {
          from: range.from(),
          to: rightPos
        };
      });
    },
    undo: function undo(cm) {
      return cm.undo();
    },
    redo: function redo(cm) {
      return cm.redo();
    },
    undoSelection: function undoSelection(cm) {
      return cm.undoSelection();
    },
    redoSelection: function redoSelection(cm) {
      return cm.redoSelection();
    },
    goDocStart: function goDocStart(cm) {
      return cm.extendSelection(Pos(cm.firstLine(), 0));
    },
    goDocEnd: function goDocEnd(cm) {
      return cm.extendSelection(Pos(cm.lastLine()));
    },
    goLineStart: function goLineStart(cm) {
      return cm.extendSelectionsBy(function (range) {
        return lineStart(cm, range.head.line);
      }, {
        origin: "+move",
        bias: 1
      });
    },
    goLineStartSmart: function goLineStartSmart(cm) {
      return cm.extendSelectionsBy(function (range) {
        return lineStartSmart(cm, range.head);
      }, {
        origin: "+move",
        bias: 1
      });
    },
    goLineEnd: function goLineEnd(cm) {
      return cm.extendSelectionsBy(function (range) {
        return lineEnd(cm, range.head.line);
      }, {
        origin: "+move",
        bias: -1
      });
    },
    goLineRight: function goLineRight(cm) {
      return cm.extendSelectionsBy(function (range) {
        var top = cm.cursorCoords(range.head, "div").top + 5;
        return cm.coordsChar({
          left: cm.display.lineDiv.offsetWidth + 100,
          top: top
        }, "div");
      }, sel_move);
    },
    goLineLeft: function goLineLeft(cm) {
      return cm.extendSelectionsBy(function (range) {
        var top = cm.cursorCoords(range.head, "div").top + 5;
        return cm.coordsChar({
          left: 0,
          top: top
        }, "div");
      }, sel_move);
    },
    goLineLeftSmart: function goLineLeftSmart(cm) {
      return cm.extendSelectionsBy(function (range) {
        var top = cm.cursorCoords(range.head, "div").top + 5;
        var pos = cm.coordsChar({
          left: 0,
          top: top
        }, "div");

        if (pos.ch < cm.getLine(pos.line).search(/\S/)) {
          return lineStartSmart(cm, range.head);
        }

        return pos;
      }, sel_move);
    },
    goLineUp: function goLineUp(cm) {
      return cm.moveV(-1, "line");
    },
    goLineDown: function goLineDown(cm) {
      return cm.moveV(1, "line");
    },
    goPageUp: function goPageUp(cm) {
      return cm.moveV(-1, "page");
    },
    goPageDown: function goPageDown(cm) {
      return cm.moveV(1, "page");
    },
    goCharLeft: function goCharLeft(cm) {
      return cm.moveH(-1, "char");
    },
    goCharRight: function goCharRight(cm) {
      return cm.moveH(1, "char");
    },
    goColumnLeft: function goColumnLeft(cm) {
      return cm.moveH(-1, "column");
    },
    goColumnRight: function goColumnRight(cm) {
      return cm.moveH(1, "column");
    },
    goWordLeft: function goWordLeft(cm) {
      return cm.moveH(-1, "word");
    },
    goGroupRight: function goGroupRight(cm) {
      return cm.moveH(1, "group");
    },
    goGroupLeft: function goGroupLeft(cm) {
      return cm.moveH(-1, "group");
    },
    goWordRight: function goWordRight(cm) {
      return cm.moveH(1, "word");
    },
    delCharBefore: function delCharBefore(cm) {
      return cm.deleteH(-1, "char");
    },
    delCharAfter: function delCharAfter(cm) {
      return cm.deleteH(1, "char");
    },
    delWordBefore: function delWordBefore(cm) {
      return cm.deleteH(-1, "word");
    },
    delWordAfter: function delWordAfter(cm) {
      return cm.deleteH(1, "word");
    },
    delGroupBefore: function delGroupBefore(cm) {
      return cm.deleteH(-1, "group");
    },
    delGroupAfter: function delGroupAfter(cm) {
      return cm.deleteH(1, "group");
    },
    indentAuto: function indentAuto(cm) {
      return cm.indentSelection("smart");
    },
    indentMore: function indentMore(cm) {
      return cm.indentSelection("add");
    },
    indentLess: function indentLess(cm) {
      return cm.indentSelection("subtract");
    },
    insertTab: function insertTab(cm) {
      return cm.replaceSelection("\t");
    },
    insertSoftTab: function insertSoftTab(cm) {
      var spaces = [],
          ranges = cm.listSelections(),
          tabSize = cm.options.tabSize;

      for (var i = 0; i < ranges.length; i++) {
        var pos = ranges[i].from();
        var col = countColumn(cm.getLine(pos.line), pos.ch, tabSize);
        spaces.push(spaceStr(tabSize - col % tabSize));
      }

      cm.replaceSelections(spaces);
    },
    defaultTab: function defaultTab(cm) {
      if (cm.somethingSelected()) {
        cm.indentSelection("add");
      } else {
        cm.execCommand("insertTab");
      }
    },
    // Swap the two chars left and right of each selection's head.
    // Move cursor behind the two swapped characters afterwards.
    //
    // Doesn't consider line feeds a character.
    // Doesn't scan more than one line above to find a character.
    // Doesn't do anything on an empty line.
    // Doesn't do anything with non-empty selections.
    transposeChars: function transposeChars(cm) {
      return runInOp(cm, function () {
        var ranges = cm.listSelections(),
            newSel = [];

        for (var i = 0; i < ranges.length; i++) {
          if (!ranges[i].empty()) {
            continue;
          }

          var cur = ranges[i].head,
              line = getLine(cm.doc, cur.line).text;

          if (line) {
            if (cur.ch == line.length) {
              cur = new Pos(cur.line, cur.ch - 1);
            }

            if (cur.ch > 0) {
              cur = new Pos(cur.line, cur.ch + 1);
              cm.replaceRange(line.charAt(cur.ch - 1) + line.charAt(cur.ch - 2), Pos(cur.line, cur.ch - 2), cur, "+transpose");
            } else if (cur.line > cm.doc.first) {
              var prev = getLine(cm.doc, cur.line - 1).text;

              if (prev) {
                cur = new Pos(cur.line, 1);
                cm.replaceRange(line.charAt(0) + cm.doc.lineSeparator() + prev.charAt(prev.length - 1), Pos(cur.line - 1, prev.length - 1), cur, "+transpose");
              }
            }
          }

          newSel.push(new Range(cur, cur));
        }

        cm.setSelections(newSel);
      });
    },
    newlineAndIndent: function newlineAndIndent(cm) {
      return runInOp(cm, function () {
        var sels = cm.listSelections();

        for (var i = sels.length - 1; i >= 0; i--) {
          cm.replaceRange(cm.doc.lineSeparator(), sels[i].anchor, sels[i].head, "+input");
        }

        sels = cm.listSelections();

        for (var i$1 = 0; i$1 < sels.length; i$1++) {
          cm.indentLine(sels[i$1].from().line, null, true);
        }

        ensureCursorVisible(cm);
      });
    },
    openLine: function openLine(cm) {
      return cm.replaceSelection("\n", "start");
    },
    toggleOverwrite: function toggleOverwrite(cm) {
      return cm.toggleOverwrite();
    }
  };

  function lineStart(cm, lineN) {
    var line = getLine(cm.doc, lineN);
    var visual = visualLine(line);

    if (visual != line) {
      lineN = lineNo(visual);
    }

    return endOfLine(true, cm, visual, lineN, 1);
  }

  function lineEnd(cm, lineN) {
    var line = getLine(cm.doc, lineN);
    var visual = visualLineEnd(line);

    if (visual != line) {
      lineN = lineNo(visual);
    }

    return endOfLine(true, cm, line, lineN, -1);
  }

  function lineStartSmart(cm, pos) {
    var start = lineStart(cm, pos.line);
    var line = getLine(cm.doc, start.line);
    var order = getOrder(line, cm.doc.direction);

    if (!order || order[0].level == 0) {
      var firstNonWS = Math.max(0, line.text.search(/\S/));
      var inWS = pos.line == start.line && pos.ch <= firstNonWS && pos.ch;
      return Pos(start.line, inWS ? 0 : firstNonWS, start.sticky);
    }

    return start;
  } // Run a handler that was bound to a key.


  function doHandleBinding(cm, bound, dropShift) {
    if (typeof bound == "string") {
      bound = commands[bound];

      if (!bound) {
        return false;
      }
    } // Ensure previous input has been read, so that the handler sees a
    // consistent view of the document


    cm.display.input.ensurePolled();
    var prevShift = cm.display.shift,
        done = false;

    try {
      if (cm.isReadOnly()) {
        cm.state.suppressEdits = true;
      }

      if (dropShift) {
        cm.display.shift = false;
      }

      done = bound(cm) != Pass;
    } finally {
      cm.display.shift = prevShift;
      cm.state.suppressEdits = false;
    }

    return done;
  }

  function lookupKeyForEditor(cm, name, handle) {
    for (var i = 0; i < cm.state.keyMaps.length; i++) {
      var result = lookupKey(name, cm.state.keyMaps[i], handle, cm);

      if (result) {
        return result;
      }
    }

    return cm.options.extraKeys && lookupKey(name, cm.options.extraKeys, handle, cm) || lookupKey(name, cm.options.keyMap, handle, cm);
  } // Note that, despite the name, this function is also used to check
  // for bound mouse clicks.


  var stopSeq = new Delayed();

  function dispatchKey(cm, name, e, handle) {
    var seq = cm.state.keySeq;

    if (seq) {
      if (isModifierKey(name)) {
        return "handled";
      }

      if (/\'$/.test(name)) {
        cm.state.keySeq = null;
      } else {
        stopSeq.set(50, function () {
          if (cm.state.keySeq == seq) {
            cm.state.keySeq = null;
            cm.display.input.reset();
          }
        });
      }

      if (dispatchKeyInner(cm, seq + " " + name, e, handle)) {
        return true;
      }
    }

    return dispatchKeyInner(cm, name, e, handle);
  }

  function dispatchKeyInner(cm, name, e, handle) {
    var result = lookupKeyForEditor(cm, name, handle);

    if (result == "multi") {
      cm.state.keySeq = name;
    }

    if (result == "handled") {
      signalLater(cm, "keyHandled", cm, name, e);
    }

    if (result == "handled" || result == "multi") {
      e_preventDefault(e);
      restartBlink(cm);
    }

    return !!result;
  } // Handle a key from the keydown event.


  function handleKeyBinding(cm, e) {
    var name = keyName(e, true);

    if (!name) {
      return false;
    }

    if (e.shiftKey && !cm.state.keySeq) {
      // First try to resolve full name (including 'Shift-'). Failing
      // that, see if there is a cursor-motion command (starting with
      // 'go') bound to the keyname without 'Shift-'.
      return dispatchKey(cm, "Shift-" + name, e, function (b) {
        return doHandleBinding(cm, b, true);
      }) || dispatchKey(cm, name, e, function (b) {
        if (typeof b == "string" ? /^go[A-Z]/.test(b) : b.motion) {
          return doHandleBinding(cm, b);
        }
      });
    } else {
      return dispatchKey(cm, name, e, function (b) {
        return doHandleBinding(cm, b);
      });
    }
  } // Handle a key from the keypress event


  function handleCharBinding(cm, e, ch) {
    return dispatchKey(cm, "'" + ch + "'", e, function (b) {
      return doHandleBinding(cm, b, true);
    });
  }

  var lastStoppedKey = null;

  function onKeyDown(e) {
    var cm = this;
    cm.curOp.focus = activeElt();

    if (signalDOMEvent(cm, e)) {
      return;
    } // IE does strange things with escape.


    if (ie && ie_version < 11 && e.keyCode == 27) {
      e.returnValue = false;
    }

    var code = e.keyCode;
    cm.display.shift = code == 16 || e.shiftKey;
    var handled = handleKeyBinding(cm, e);

    if (presto) {
      lastStoppedKey = handled ? code : null; // Opera has no cut event... we try to at least catch the key combo

      if (!handled && code == 88 && !hasCopyEvent && (mac ? e.metaKey : e.ctrlKey)) {
        cm.replaceSelection("", null, "cut");
      }
    }

    if (gecko && !mac && !handled && code == 46 && e.shiftKey && !e.ctrlKey && document.execCommand) {
      document.execCommand("cut");
    } // Turn mouse into crosshair when Alt is held on Mac.


    if (code == 18 && !/\bCodeMirror-crosshair\b/.test(cm.display.lineDiv.className)) {
      showCrossHair(cm);
    }
  }

  function showCrossHair(cm) {
    var lineDiv = cm.display.lineDiv;
    addClass(lineDiv, "CodeMirror-crosshair");

    function up(e) {
      if (e.keyCode == 18 || !e.altKey) {
        rmClass(lineDiv, "CodeMirror-crosshair");
        off(document, "keyup", up);
        off(document, "mouseover", up);
      }
    }

    on(document, "keyup", up);
    on(document, "mouseover", up);
  }

  function onKeyUp(e) {
    if (e.keyCode == 16) {
      this.doc.sel.shift = false;
    }

    signalDOMEvent(this, e);
  }

  function onKeyPress(e) {
    var cm = this;

    if (eventInWidget(cm.display, e) || signalDOMEvent(cm, e) || e.ctrlKey && !e.altKey || mac && e.metaKey) {
      return;
    }

    var keyCode = e.keyCode,
        charCode = e.charCode;

    if (presto && keyCode == lastStoppedKey) {
      lastStoppedKey = null;
      e_preventDefault(e);
      return;
    }

    if (presto && (!e.which || e.which < 10) && handleKeyBinding(cm, e)) {
      return;
    }

    var ch = String.fromCharCode(charCode == null ? keyCode : charCode); // Some browsers fire keypress events for backspace

    if (ch == "\x08") {
      return;
    }

    if (handleCharBinding(cm, e, ch)) {
      return;
    }

    cm.display.input.onKeyPress(e);
  }

  var DOUBLECLICK_DELAY = 400;

  var PastClick = function PastClick(time, pos, button) {
    this.time = time;
    this.pos = pos;
    this.button = button;
  };

  PastClick.prototype.compare = function (time, pos, button) {
    return this.time + DOUBLECLICK_DELAY > time && cmp(pos, this.pos) == 0 && button == this.button;
  };

  var lastClick, lastDoubleClick;

  function clickRepeat(pos, button) {
    var now = +new Date();

    if (lastDoubleClick && lastDoubleClick.compare(now, pos, button)) {
      lastClick = lastDoubleClick = null;
      return "triple";
    } else if (lastClick && lastClick.compare(now, pos, button)) {
      lastDoubleClick = new PastClick(now, pos, button);
      lastClick = null;
      return "double";
    } else {
      lastClick = new PastClick(now, pos, button);
      lastDoubleClick = null;
      return "single";
    }
  } // A mouse down can be a single click, double click, triple click,
  // start of selection drag, start of text drag, new cursor
  // (ctrl-click), rectangle drag (alt-drag), or xwin
  // middle-click-paste. Or it might be a click on something we should
  // not interfere with, such as a scrollbar or widget.


  function onMouseDown(e) {
    var cm = this,
        display = cm.display;

    if (signalDOMEvent(cm, e) || display.activeTouch && display.input.supportsTouch()) {
      return;
    }

    display.input.ensurePolled();
    display.shift = e.shiftKey;

    if (eventInWidget(display, e)) {
      if (!webkit) {
        // Briefly turn off draggability, to allow widgets to do
        // normal dragging things.
        display.scroller.draggable = false;
        setTimeout(function () {
          return display.scroller.draggable = true;
        }, 100);
      }

      return;
    }

    if (clickInGutter(cm, e)) {
      return;
    }

    var pos = posFromMouse(cm, e),
        button = e_button(e),
        repeat = pos ? clickRepeat(pos, button) : "single";
    window.focus(); // #3261: make sure, that we're not starting a second selection

    if (button == 1 && cm.state.selectingText) {
      cm.state.selectingText(e);
    }

    if (pos && handleMappedButton(cm, button, pos, repeat, e)) {
      return;
    }

    if (button == 1) {
      if (pos) {
        leftButtonDown(cm, pos, repeat, e);
      } else if (e_target(e) == display.scroller) {
        e_preventDefault(e);
      }
    } else if (button == 2) {
      if (pos) {
        extendSelection(cm.doc, pos);
      }

      setTimeout(function () {
        return display.input.focus();
      }, 20);
    } else if (button == 3) {
      if (captureRightClick) {
        cm.display.input.onContextMenu(e);
      } else {
        delayBlurEvent(cm);
      }
    }
  }

  function handleMappedButton(cm, button, pos, repeat, event) {
    var name = "Click";

    if (repeat == "double") {
      name = "Double" + name;
    } else if (repeat == "triple") {
      name = "Triple" + name;
    }

    name = (button == 1 ? "Left" : button == 2 ? "Middle" : "Right") + name;
    return dispatchKey(cm, addModifierNames(name, event), event, function (bound) {
      if (typeof bound == "string") {
        bound = commands[bound];
      }

      if (!bound) {
        return false;
      }

      var done = false;

      try {
        if (cm.isReadOnly()) {
          cm.state.suppressEdits = true;
        }

        done = bound(cm, pos) != Pass;
      } finally {
        cm.state.suppressEdits = false;
      }

      return done;
    });
  }

  function configureMouse(cm, repeat, event) {
    var option = cm.getOption("configureMouse");
    var value = option ? option(cm, repeat, event) : {};

    if (value.unit == null) {
      var rect = chromeOS ? event.shiftKey && event.metaKey : event.altKey;
      value.unit = rect ? "rectangle" : repeat == "single" ? "char" : repeat == "double" ? "word" : "line";
    }

    if (value.extend == null || cm.doc.extend) {
      value.extend = cm.doc.extend || event.shiftKey;
    }

    if (value.addNew == null) {
      value.addNew = mac ? event.metaKey : event.ctrlKey;
    }

    if (value.moveOnDrag == null) {
      value.moveOnDrag = !(mac ? event.altKey : event.ctrlKey);
    }

    return value;
  }

  function leftButtonDown(cm, pos, repeat, event) {
    if (ie) {
      setTimeout(bind(ensureFocus, cm), 0);
    } else {
      cm.curOp.focus = activeElt();
    }

    var behavior = configureMouse(cm, repeat, event);
    var sel = cm.doc.sel,
        contained;

    if (cm.options.dragDrop && dragAndDrop && !cm.isReadOnly() && repeat == "single" && (contained = sel.contains(pos)) > -1 && (cmp((contained = sel.ranges[contained]).from(), pos) < 0 || pos.xRel > 0) && (cmp(contained.to(), pos) > 0 || pos.xRel < 0)) {
      leftButtonStartDrag(cm, event, pos, behavior);
    } else {
      leftButtonSelect(cm, event, pos, behavior);
    }
  } // Start a text drag. When it ends, see if any dragging actually
  // happen, and treat as a click if it didn't.


  function leftButtonStartDrag(cm, event, pos, behavior) {
    var display = cm.display,
        moved = false;
    var dragEnd = operation(cm, function (e) {
      if (webkit) {
        display.scroller.draggable = false;
      }

      cm.state.draggingText = false;
      off(display.wrapper.ownerDocument, "mouseup", dragEnd);
      off(display.wrapper.ownerDocument, "mousemove", mouseMove);
      off(display.scroller, "dragstart", dragStart);
      off(display.scroller, "drop", dragEnd);

      if (!moved) {
        e_preventDefault(e);

        if (!behavior.addNew) {
          extendSelection(cm.doc, pos, null, null, behavior.extend);
        } // Work around unexplainable focus problem in IE9 (#2127) and Chrome (#3081)


        if (webkit || ie && ie_version == 9) {
          setTimeout(function () {
            display.wrapper.ownerDocument.body.focus();
            display.input.focus();
          }, 20);
        } else {
          display.input.focus();
        }
      }
    });

    var mouseMove = function mouseMove(e2) {
      moved = moved || Math.abs(event.clientX - e2.clientX) + Math.abs(event.clientY - e2.clientY) >= 10;
    };

    var dragStart = function dragStart() {
      return moved = true;
    }; // Let the drag handler handle this.


    if (webkit) {
      display.scroller.draggable = true;
    }

    cm.state.draggingText = dragEnd;
    dragEnd.copy = !behavior.moveOnDrag; // IE's approach to draggable

    if (display.scroller.dragDrop) {
      display.scroller.dragDrop();
    }

    on(display.wrapper.ownerDocument, "mouseup", dragEnd);
    on(display.wrapper.ownerDocument, "mousemove", mouseMove);
    on(display.scroller, "dragstart", dragStart);
    on(display.scroller, "drop", dragEnd);
    delayBlurEvent(cm);
    setTimeout(function () {
      return display.input.focus();
    }, 20);
  }

  function rangeForUnit(cm, pos, unit) {
    if (unit == "char") {
      return new Range(pos, pos);
    }

    if (unit == "word") {
      return cm.findWordAt(pos);
    }

    if (unit == "line") {
      return new Range(Pos(pos.line, 0), _clipPos(cm.doc, Pos(pos.line + 1, 0)));
    }

    var result = unit(cm, pos);
    return new Range(result.from, result.to);
  } // Normal selection, as opposed to text dragging.


  function leftButtonSelect(cm, event, start, behavior) {
    var display = cm.display,
        doc = cm.doc;
    e_preventDefault(event);
    var ourRange,
        ourIndex,
        startSel = doc.sel,
        ranges = startSel.ranges;

    if (behavior.addNew && !behavior.extend) {
      ourIndex = doc.sel.contains(start);

      if (ourIndex > -1) {
        ourRange = ranges[ourIndex];
      } else {
        ourRange = new Range(start, start);
      }
    } else {
      ourRange = doc.sel.primary();
      ourIndex = doc.sel.primIndex;
    }

    if (behavior.unit == "rectangle") {
      if (!behavior.addNew) {
        ourRange = new Range(start, start);
      }

      start = posFromMouse(cm, event, true, true);
      ourIndex = -1;
    } else {
      var range$$1 = rangeForUnit(cm, start, behavior.unit);

      if (behavior.extend) {
        ourRange = extendRange(ourRange, range$$1.anchor, range$$1.head, behavior.extend);
      } else {
        ourRange = range$$1;
      }
    }

    if (!behavior.addNew) {
      ourIndex = 0;
      setSelection(doc, new Selection([ourRange], 0), sel_mouse);
      startSel = doc.sel;
    } else if (ourIndex == -1) {
      ourIndex = ranges.length;
      setSelection(doc, normalizeSelection(cm, ranges.concat([ourRange]), ourIndex), {
        scroll: false,
        origin: "*mouse"
      });
    } else if (ranges.length > 1 && ranges[ourIndex].empty() && behavior.unit == "char" && !behavior.extend) {
      setSelection(doc, normalizeSelection(cm, ranges.slice(0, ourIndex).concat(ranges.slice(ourIndex + 1)), 0), {
        scroll: false,
        origin: "*mouse"
      });
      startSel = doc.sel;
    } else {
      replaceOneSelection(doc, ourIndex, ourRange, sel_mouse);
    }

    var lastPos = start;

    function extendTo(pos) {
      if (cmp(lastPos, pos) == 0) {
        return;
      }

      lastPos = pos;

      if (behavior.unit == "rectangle") {
        var ranges = [],
            tabSize = cm.options.tabSize;
        var startCol = countColumn(getLine(doc, start.line).text, start.ch, tabSize);
        var posCol = countColumn(getLine(doc, pos.line).text, pos.ch, tabSize);
        var left = Math.min(startCol, posCol),
            right = Math.max(startCol, posCol);

        for (var line = Math.min(start.line, pos.line), end = Math.min(cm.lastLine(), Math.max(start.line, pos.line)); line <= end; line++) {
          var text = getLine(doc, line).text,
              leftPos = findColumn(text, left, tabSize);

          if (left == right) {
            ranges.push(new Range(Pos(line, leftPos), Pos(line, leftPos)));
          } else if (text.length > leftPos) {
            ranges.push(new Range(Pos(line, leftPos), Pos(line, findColumn(text, right, tabSize))));
          }
        }

        if (!ranges.length) {
          ranges.push(new Range(start, start));
        }

        setSelection(doc, normalizeSelection(cm, startSel.ranges.slice(0, ourIndex).concat(ranges), ourIndex), {
          origin: "*mouse",
          scroll: false
        });
        cm.scrollIntoView(pos);
      } else {
        var oldRange = ourRange;
        var range$$1 = rangeForUnit(cm, pos, behavior.unit);
        var anchor = oldRange.anchor,
            head;

        if (cmp(range$$1.anchor, anchor) > 0) {
          head = range$$1.head;
          anchor = minPos(oldRange.from(), range$$1.anchor);
        } else {
          head = range$$1.anchor;
          anchor = maxPos(oldRange.to(), range$$1.head);
        }

        var ranges$1 = startSel.ranges.slice(0);
        ranges$1[ourIndex] = bidiSimplify(cm, new Range(_clipPos(doc, anchor), head));
        setSelection(doc, normalizeSelection(cm, ranges$1, ourIndex), sel_mouse);
      }
    }

    var editorSize = display.wrapper.getBoundingClientRect(); // Used to ensure timeout re-tries don't fire when another extend
    // happened in the meantime (clearTimeout isn't reliable -- at
    // least on Chrome, the timeouts still happen even when cleared,
    // if the clear happens after their scheduled firing time).

    var counter = 0;

    function extend(e) {
      var curCount = ++counter;
      var cur = posFromMouse(cm, e, true, behavior.unit == "rectangle");

      if (!cur) {
        return;
      }

      if (cmp(cur, lastPos) != 0) {
        cm.curOp.focus = activeElt();
        extendTo(cur);
        var visible = visibleLines(display, doc);

        if (cur.line >= visible.to || cur.line < visible.from) {
          setTimeout(operation(cm, function () {
            if (counter == curCount) {
              extend(e);
            }
          }), 150);
        }
      } else {
        var outside = e.clientY < editorSize.top ? -20 : e.clientY > editorSize.bottom ? 20 : 0;

        if (outside) {
          setTimeout(operation(cm, function () {
            if (counter != curCount) {
              return;
            }

            display.scroller.scrollTop += outside;
            extend(e);
          }), 50);
        }
      }
    }

    function done(e) {
      cm.state.selectingText = false;
      counter = Infinity; // If e is null or undefined we interpret this as someone trying
      // to explicitly cancel the selection rather than the user
      // letting go of the mouse button.

      if (e) {
        e_preventDefault(e);
        display.input.focus();
      }

      off(display.wrapper.ownerDocument, "mousemove", move);
      off(display.wrapper.ownerDocument, "mouseup", up);
      doc.history.lastSelOrigin = null;
    }

    var move = operation(cm, function (e) {
      if (e.buttons === 0 || !e_button(e)) {
        done(e);
      } else {
        extend(e);
      }
    });
    var up = operation(cm, done);
    cm.state.selectingText = up;
    on(display.wrapper.ownerDocument, "mousemove", move);
    on(display.wrapper.ownerDocument, "mouseup", up);
  } // Used when mouse-selecting to adjust the anchor to the proper side
  // of a bidi jump depending on the visual position of the head.


  function bidiSimplify(cm, range$$1) {
    var anchor = range$$1.anchor;
    var head = range$$1.head;
    var anchorLine = getLine(cm.doc, anchor.line);

    if (cmp(anchor, head) == 0 && anchor.sticky == head.sticky) {
      return range$$1;
    }

    var order = getOrder(anchorLine);

    if (!order) {
      return range$$1;
    }

    var index = getBidiPartAt(order, anchor.ch, anchor.sticky),
        part = order[index];

    if (part.from != anchor.ch && part.to != anchor.ch) {
      return range$$1;
    }

    var boundary = index + (part.from == anchor.ch == (part.level != 1) ? 0 : 1);

    if (boundary == 0 || boundary == order.length) {
      return range$$1;
    } // Compute the relative visual position of the head compared to the
    // anchor (<0 is to the left, >0 to the right)


    var leftSide;

    if (head.line != anchor.line) {
      leftSide = (head.line - anchor.line) * (cm.doc.direction == "ltr" ? 1 : -1) > 0;
    } else {
      var headIndex = getBidiPartAt(order, head.ch, head.sticky);
      var dir = headIndex - index || (head.ch - anchor.ch) * (part.level == 1 ? -1 : 1);

      if (headIndex == boundary - 1 || headIndex == boundary) {
        leftSide = dir < 0;
      } else {
        leftSide = dir > 0;
      }
    }

    var usePart = order[boundary + (leftSide ? -1 : 0)];
    var from = leftSide == (usePart.level == 1);
    var ch = from ? usePart.from : usePart.to,
        sticky = from ? "after" : "before";
    return anchor.ch == ch && anchor.sticky == sticky ? range$$1 : new Range(new Pos(anchor.line, ch, sticky), head);
  } // Determines whether an event happened in the gutter, and fires the
  // handlers for the corresponding event.


  function gutterEvent(cm, e, type, prevent) {
    var mX, mY;

    if (e.touches) {
      mX = e.touches[0].clientX;
      mY = e.touches[0].clientY;
    } else {
      try {
        mX = e.clientX;
        mY = e.clientY;
      } catch (e) {
        return false;
      }
    }

    if (mX >= Math.floor(cm.display.gutters.getBoundingClientRect().right)) {
      return false;
    }

    if (prevent) {
      e_preventDefault(e);
    }

    var display = cm.display;
    var lineBox = display.lineDiv.getBoundingClientRect();

    if (mY > lineBox.bottom || !hasHandler(cm, type)) {
      return e_defaultPrevented(e);
    }

    mY -= lineBox.top - display.viewOffset;

    for (var i = 0; i < cm.display.gutterSpecs.length; ++i) {
      var g = display.gutters.childNodes[i];

      if (g && g.getBoundingClientRect().right >= mX) {
        var line = _lineAtHeight(cm.doc, mY);

        var gutter = cm.display.gutterSpecs[i];
        signal(cm, type, cm, line, gutter.className, e);
        return e_defaultPrevented(e);
      }
    }
  }

  function clickInGutter(cm, e) {
    return gutterEvent(cm, e, "gutterClick", true);
  } // CONTEXT MENU HANDLING
  // To make the context menu work, we need to briefly unhide the
  // textarea (making it as unobtrusive as possible) to let the
  // right-click take effect on it.


  function onContextMenu(cm, e) {
    if (eventInWidget(cm.display, e) || contextMenuInGutter(cm, e)) {
      return;
    }

    if (signalDOMEvent(cm, e, "contextmenu")) {
      return;
    }

    if (!captureRightClick) {
      cm.display.input.onContextMenu(e);
    }
  }

  function contextMenuInGutter(cm, e) {
    if (!hasHandler(cm, "gutterContextMenu")) {
      return false;
    }

    return gutterEvent(cm, e, "gutterContextMenu", false);
  }

  function themeChanged(cm) {
    cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-s-\S+/g, "") + cm.options.theme.replace(/(^|\s)\s*/g, " cm-s-");
    clearCaches(cm);
  }

  var Init = {
    toString: function toString() {
      return "CodeMirror.Init";
    }
  };
  var defaults = {};
  var optionHandlers = {};

  function defineOptions(CodeMirror) {
    var optionHandlers = CodeMirror.optionHandlers;

    function option(name, deflt, handle, notOnInit) {
      CodeMirror.defaults[name] = deflt;

      if (handle) {
        optionHandlers[name] = notOnInit ? function (cm, val, old) {
          if (old != Init) {
            handle(cm, val, old);
          }
        } : handle;
      }
    }

    CodeMirror.defineOption = option; // Passed to option handlers when there is no old value.

    CodeMirror.Init = Init; // These two are, on init, called from the constructor because they
    // have to be initialized before the editor can start at all.

    option("value", "", function (cm, val) {
      return cm.setValue(val);
    }, true);
    option("mode", null, function (cm, val) {
      cm.doc.modeOption = val;
      loadMode(cm);
    }, true);
    option("indentUnit", 2, loadMode, true);
    option("indentWithTabs", false);
    option("smartIndent", true);
    option("tabSize", 4, function (cm) {
      resetModeState(cm);
      clearCaches(cm);
      regChange(cm);
    }, true);
    option("lineSeparator", null, function (cm, val) {
      cm.doc.lineSep = val;

      if (!val) {
        return;
      }

      var newBreaks = [],
          lineNo = cm.doc.first;
      cm.doc.iter(function (line) {
        for (var pos = 0;;) {
          var found = line.text.indexOf(val, pos);

          if (found == -1) {
            break;
          }

          pos = found + val.length;
          newBreaks.push(Pos(lineNo, found));
        }

        lineNo++;
      });

      for (var i = newBreaks.length - 1; i >= 0; i--) {
        _replaceRange(cm.doc, val, newBreaks[i], Pos(newBreaks[i].line, newBreaks[i].ch + val.length));
      }
    });
    option("specialChars", /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g, function (cm, val, old) {
      cm.state.specialChars = new RegExp(val.source + (val.test("\t") ? "" : "|\t"), "g");

      if (old != Init) {
        cm.refresh();
      }
    });
    option("specialCharPlaceholder", defaultSpecialCharPlaceholder, function (cm) {
      return cm.refresh();
    }, true);
    option("electricChars", true);
    option("inputStyle", mobile ? "contenteditable" : "textarea", function () {
      throw new Error("inputStyle can not (yet) be changed in a running editor"); // FIXME
    }, true);
    option("spellcheck", false, function (cm, val) {
      return cm.getInputField().spellcheck = val;
    }, true);
    option("autocorrect", false, function (cm, val) {
      return cm.getInputField().autocorrect = val;
    }, true);
    option("autocapitalize", false, function (cm, val) {
      return cm.getInputField().autocapitalize = val;
    }, true);
    option("rtlMoveVisually", !windows);
    option("wholeLineUpdateBefore", true);
    option("theme", "default", function (cm) {
      themeChanged(cm);
      updateGutters(cm);
    }, true);
    option("keyMap", "default", function (cm, val, old) {
      var next = getKeyMap(val);
      var prev = old != Init && getKeyMap(old);

      if (prev && prev.detach) {
        prev.detach(cm, next);
      }

      if (next.attach) {
        next.attach(cm, prev || null);
      }
    });
    option("extraKeys", null);
    option("configureMouse", null);
    option("lineWrapping", false, wrappingChanged, true);
    option("gutters", [], function (cm, val) {
      cm.display.gutterSpecs = getGutters(val, cm.options.lineNumbers);
      updateGutters(cm);
    }, true);
    option("fixedGutter", true, function (cm, val) {
      cm.display.gutters.style.left = val ? compensateForHScroll(cm.display) + "px" : "0";
      cm.refresh();
    }, true);
    option("coverGutterNextToScrollbar", false, function (cm) {
      return updateScrollbars(cm);
    }, true);
    option("scrollbarStyle", "native", function (cm) {
      initScrollbars(cm);
      updateScrollbars(cm);
      cm.display.scrollbars.setScrollTop(cm.doc.scrollTop);
      cm.display.scrollbars.setScrollLeft(cm.doc.scrollLeft);
    }, true);
    option("lineNumbers", false, function (cm, val) {
      cm.display.gutterSpecs = getGutters(cm.options.gutters, val);
      updateGutters(cm);
    }, true);
    option("firstLineNumber", 1, updateGutters, true);
    option("lineNumberFormatter", function (integer) {
      return integer;
    }, updateGutters, true);
    option("showCursorWhenSelecting", false, updateSelection, true);
    option("resetSelectionOnContextMenu", true);
    option("lineWiseCopyCut", true);
    option("pasteLinesPerSelection", true);
    option("selectionsMayTouch", false);
    option("readOnly", false, function (cm, val) {
      if (val == "nocursor") {
        onBlur(cm);
        cm.display.input.blur();
      }

      cm.display.input.readOnlyChanged(val);
    });
    option("disableInput", false, function (cm, val) {
      if (!val) {
        cm.display.input.reset();
      }
    }, true);
    option("dragDrop", true, dragDropChanged);
    option("allowDropFileTypes", null);
    option("cursorBlinkRate", 530);
    option("cursorScrollMargin", 0);
    option("cursorHeight", 1, updateSelection, true);
    option("singleCursorHeightPerLine", true, updateSelection, true);
    option("workTime", 100);
    option("workDelay", 100);
    option("flattenSpans", true, resetModeState, true);
    option("addModeClass", false, resetModeState, true);
    option("pollInterval", 100);
    option("undoDepth", 200, function (cm, val) {
      return cm.doc.history.undoDepth = val;
    });
    option("historyEventDelay", 1250);
    option("viewportMargin", 10, function (cm) {
      return cm.refresh();
    }, true);
    option("maxHighlightLength", 10000, resetModeState, true);
    option("moveInputWithCursor", true, function (cm, val) {
      if (!val) {
        cm.display.input.resetPosition();
      }
    });
    option("tabindex", null, function (cm, val) {
      return cm.display.input.getField().tabIndex = val || "";
    });
    option("autofocus", null);
    option("direction", "ltr", function (cm, val) {
      return cm.doc.setDirection(val);
    }, true);
    option("phrases", null);
  }

  function dragDropChanged(cm, value, old) {
    var wasOn = old && old != Init;

    if (!value != !wasOn) {
      var funcs = cm.display.dragFunctions;
      var toggle = value ? on : off;
      toggle(cm.display.scroller, "dragstart", funcs.start);
      toggle(cm.display.scroller, "dragenter", funcs.enter);
      toggle(cm.display.scroller, "dragover", funcs.over);
      toggle(cm.display.scroller, "dragleave", funcs.leave);
      toggle(cm.display.scroller, "drop", funcs.drop);
    }
  }

  function wrappingChanged(cm) {
    if (cm.options.lineWrapping) {
      addClass(cm.display.wrapper, "CodeMirror-wrap");
      cm.display.sizer.style.minWidth = "";
      cm.display.sizerWidth = null;
    } else {
      rmClass(cm.display.wrapper, "CodeMirror-wrap");
      findMaxLine(cm);
    }

    estimateLineHeights(cm);
    regChange(cm);
    clearCaches(cm);
    setTimeout(function () {
      return updateScrollbars(cm);
    }, 100);
  } // A CodeMirror instance represents an editor. This is the object
  // that user code is usually dealing with.


  function CodeMirror(place, options) {
    var this$1 = this;

    if (!(this instanceof CodeMirror)) {
      return new CodeMirror(place, options);
    }

    this.options = options = options ? copyObj(options) : {}; // Determine effective options based on given values and defaults.

    copyObj(defaults, options, false);
    var doc = options.value;

    if (typeof doc == "string") {
      doc = new Doc(doc, options.mode, null, options.lineSeparator, options.direction);
    } else if (options.mode) {
      doc.modeOption = options.mode;
    }

    this.doc = doc;
    var input = new CodeMirror.inputStyles[options.inputStyle](this);
    var display = this.display = new Display(place, doc, input, options);
    display.wrapper.CodeMirror = this;
    themeChanged(this);

    if (options.lineWrapping) {
      this.display.wrapper.className += " CodeMirror-wrap";
    }

    initScrollbars(this);
    this.state = {
      keyMaps: [],
      // stores maps added by addKeyMap
      overlays: [],
      // highlighting overlays, as added by addOverlay
      modeGen: 0,
      // bumped when mode/overlay changes, used to invalidate highlighting info
      overwrite: false,
      delayingBlurEvent: false,
      focused: false,
      suppressEdits: false,
      // used to disable editing during key handlers when in readOnly mode
      pasteIncoming: -1,
      cutIncoming: -1,
      // help recognize paste/cut edits in input.poll
      selectingText: false,
      draggingText: false,
      highlight: new Delayed(),
      // stores highlight worker timeout
      keySeq: null,
      // Unfinished key sequence
      specialChars: null
    };

    if (options.autofocus && !mobile) {
      display.input.focus();
    } // Override magic textarea content restore that IE sometimes does
    // on our hidden textarea on reload


    if (ie && ie_version < 11) {
      setTimeout(function () {
        return this$1.display.input.reset(true);
      }, 20);
    }

    registerEventHandlers(this);
    ensureGlobalHandlers();

    _startOperation(this);

    this.curOp.forceUpdate = true;
    attachDoc(this, doc);

    if (options.autofocus && !mobile || this.hasFocus()) {
      setTimeout(bind(onFocus, this), 20);
    } else {
      onBlur(this);
    }

    for (var opt in optionHandlers) {
      if (optionHandlers.hasOwnProperty(opt)) {
        optionHandlers[opt](this$1, options[opt], Init);
      }
    }

    maybeUpdateLineNumberWidth(this);

    if (options.finishInit) {
      options.finishInit(this);
    }

    for (var i = 0; i < initHooks.length; ++i) {
      initHooks[i](this$1);
    }

    _endOperation(this); // Suppress optimizelegibility in Webkit, since it breaks text
    // measuring on line wrapping boundaries.


    if (webkit && options.lineWrapping && getComputedStyle(display.lineDiv).textRendering == "optimizelegibility") {
      display.lineDiv.style.textRendering = "auto";
    }
  } // The default configuration options.


  CodeMirror.defaults = defaults; // Functions to run when options are changed.

  CodeMirror.optionHandlers = optionHandlers; // Attach the necessary event handlers when initializing the editor

  function registerEventHandlers(cm) {
    var d = cm.display;
    on(d.scroller, "mousedown", operation(cm, onMouseDown)); // Older IE's will not fire a second mousedown for a double click

    if (ie && ie_version < 11) {
      on(d.scroller, "dblclick", operation(cm, function (e) {
        if (signalDOMEvent(cm, e)) {
          return;
        }

        var pos = posFromMouse(cm, e);

        if (!pos || clickInGutter(cm, e) || eventInWidget(cm.display, e)) {
          return;
        }

        e_preventDefault(e);
        var word = cm.findWordAt(pos);
        extendSelection(cm.doc, word.anchor, word.head);
      }));
    } else {
      on(d.scroller, "dblclick", function (e) {
        return signalDOMEvent(cm, e) || e_preventDefault(e);
      });
    } // Some browsers fire contextmenu *after* opening the menu, at
    // which point we can't mess with it anymore. Context menu is
    // handled in onMouseDown for these browsers.


    on(d.scroller, "contextmenu", function (e) {
      return onContextMenu(cm, e);
    }); // Used to suppress mouse event handling when a touch happens

    var touchFinished,
        prevTouch = {
      end: 0
    };

    function finishTouch() {
      if (d.activeTouch) {
        touchFinished = setTimeout(function () {
          return d.activeTouch = null;
        }, 1000);
        prevTouch = d.activeTouch;
        prevTouch.end = +new Date();
      }
    }

    function isMouseLikeTouchEvent(e) {
      if (e.touches.length != 1) {
        return false;
      }

      var touch = e.touches[0];
      return touch.radiusX <= 1 && touch.radiusY <= 1;
    }

    function farAway(touch, other) {
      if (other.left == null) {
        return true;
      }

      var dx = other.left - touch.left,
          dy = other.top - touch.top;
      return dx * dx + dy * dy > 20 * 20;
    }

    on(d.scroller, "touchstart", function (e) {
      if (!signalDOMEvent(cm, e) && !isMouseLikeTouchEvent(e) && !clickInGutter(cm, e)) {
        d.input.ensurePolled();
        clearTimeout(touchFinished);
        var now = +new Date();
        d.activeTouch = {
          start: now,
          moved: false,
          prev: now - prevTouch.end <= 300 ? prevTouch : null
        };

        if (e.touches.length == 1) {
          d.activeTouch.left = e.touches[0].pageX;
          d.activeTouch.top = e.touches[0].pageY;
        }
      }
    });
    on(d.scroller, "touchmove", function () {
      if (d.activeTouch) {
        d.activeTouch.moved = true;
      }
    });
    on(d.scroller, "touchend", function (e) {
      var touch = d.activeTouch;

      if (touch && !eventInWidget(d, e) && touch.left != null && !touch.moved && new Date() - touch.start < 300) {
        var pos = cm.coordsChar(d.activeTouch, "page"),
            range;

        if (!touch.prev || farAway(touch, touch.prev)) // Single tap
          {
            range = new Range(pos, pos);
          } else if (!touch.prev.prev || farAway(touch, touch.prev.prev)) // Double tap
          {
            range = cm.findWordAt(pos);
          } else // Triple tap
          {
            range = new Range(Pos(pos.line, 0), _clipPos(cm.doc, Pos(pos.line + 1, 0)));
          }

        cm.setSelection(range.anchor, range.head);
        cm.focus();
        e_preventDefault(e);
      }

      finishTouch();
    });
    on(d.scroller, "touchcancel", finishTouch); // Sync scrolling between fake scrollbars and real scrollable
    // area, ensure viewport is updated when scrolling.

    on(d.scroller, "scroll", function () {
      if (d.scroller.clientHeight) {
        updateScrollTop(cm, d.scroller.scrollTop);
        setScrollLeft(cm, d.scroller.scrollLeft, true);
        signal(cm, "scroll", cm);
      }
    }); // Listen to wheel events in order to try and update the viewport on time.

    on(d.scroller, "mousewheel", function (e) {
      return onScrollWheel(cm, e);
    });
    on(d.scroller, "DOMMouseScroll", function (e) {
      return onScrollWheel(cm, e);
    }); // Prevent wrapper from ever scrolling

    on(d.wrapper, "scroll", function () {
      return d.wrapper.scrollTop = d.wrapper.scrollLeft = 0;
    });
    d.dragFunctions = {
      enter: function enter(e) {
        if (!signalDOMEvent(cm, e)) {
          e_stop(e);
        }
      },
      over: function over(e) {
        if (!signalDOMEvent(cm, e)) {
          onDragOver(cm, e);
          e_stop(e);
        }
      },
      start: function start(e) {
        return onDragStart(cm, e);
      },
      drop: operation(cm, onDrop),
      leave: function leave(e) {
        if (!signalDOMEvent(cm, e)) {
          clearDragCursor(cm);
        }
      }
    };
    var inp = d.input.getField();
    on(inp, "keyup", function (e) {
      return onKeyUp.call(cm, e);
    });
    on(inp, "keydown", operation(cm, onKeyDown));
    on(inp, "keypress", operation(cm, onKeyPress));
    on(inp, "focus", function (e) {
      return onFocus(cm, e);
    });
    on(inp, "blur", function (e) {
      return onBlur(cm, e);
    });
  }

  var initHooks = [];

  CodeMirror.defineInitHook = function (f) {
    return initHooks.push(f);
  }; // Indent the given line. The how parameter can be "smart",
  // "add"/null, "subtract", or "prev". When aggressive is false
  // (typically set to true for forced single-line indents), empty
  // lines are not indented, and places where the mode returns Pass
  // are left alone.


  function indentLine(cm, n, how, aggressive) {
    var doc = cm.doc,
        state;

    if (how == null) {
      how = "add";
    }

    if (how == "smart") {
      // Fall back to "prev" when the mode doesn't have an indentation
      // method.
      if (!doc.mode.indent) {
        how = "prev";
      } else {
        state = getContextBefore(cm, n).state;
      }
    }

    var tabSize = cm.options.tabSize;
    var line = getLine(doc, n),
        curSpace = countColumn(line.text, null, tabSize);

    if (line.stateAfter) {
      line.stateAfter = null;
    }

    var curSpaceString = line.text.match(/^\s*/)[0],
        indentation;

    if (!aggressive && !/\S/.test(line.text)) {
      indentation = 0;
      how = "not";
    } else if (how == "smart") {
      indentation = doc.mode.indent(state, line.text.slice(curSpaceString.length), line.text);

      if (indentation == Pass || indentation > 150) {
        if (!aggressive) {
          return;
        }

        how = "prev";
      }
    }

    if (how == "prev") {
      if (n > doc.first) {
        indentation = countColumn(getLine(doc, n - 1).text, null, tabSize);
      } else {
        indentation = 0;
      }
    } else if (how == "add") {
      indentation = curSpace + cm.options.indentUnit;
    } else if (how == "subtract") {
      indentation = curSpace - cm.options.indentUnit;
    } else if (typeof how == "number") {
      indentation = curSpace + how;
    }

    indentation = Math.max(0, indentation);
    var indentString = "",
        pos = 0;

    if (cm.options.indentWithTabs) {
      for (var i = Math.floor(indentation / tabSize); i; --i) {
        pos += tabSize;
        indentString += "\t";
      }
    }

    if (pos < indentation) {
      indentString += spaceStr(indentation - pos);
    }

    if (indentString != curSpaceString) {
      _replaceRange(doc, indentString, Pos(n, 0), Pos(n, curSpaceString.length), "+input");

      line.stateAfter = null;
      return true;
    } else {
      // Ensure that, if the cursor was in the whitespace at the start
      // of the line, it is moved to the end of that space.
      for (var i$1 = 0; i$1 < doc.sel.ranges.length; i$1++) {
        var range = doc.sel.ranges[i$1];

        if (range.head.line == n && range.head.ch < curSpaceString.length) {
          var pos$1 = Pos(n, curSpaceString.length);
          replaceOneSelection(doc, i$1, new Range(pos$1, pos$1));
          break;
        }
      }
    }
  } // This will be set to a {lineWise: bool, text: [string]} object, so
  // that, when pasting, we know what kind of selections the copied
  // text was made out of.


  var lastCopied = null;

  function setLastCopied(newLastCopied) {
    lastCopied = newLastCopied;
  }

  function applyTextInput(cm, inserted, deleted, sel, origin) {
    var doc = cm.doc;
    cm.display.shift = false;

    if (!sel) {
      sel = doc.sel;
    }

    var recent = +new Date() - 200;
    var paste = origin == "paste" || cm.state.pasteIncoming > recent;
    var textLines = splitLinesAuto(inserted),
        multiPaste = null; // When pasting N lines into N selections, insert one line per selection

    if (paste && sel.ranges.length > 1) {
      if (lastCopied && lastCopied.text.join("\n") == inserted) {
        if (sel.ranges.length % lastCopied.text.length == 0) {
          multiPaste = [];

          for (var i = 0; i < lastCopied.text.length; i++) {
            multiPaste.push(doc.splitLines(lastCopied.text[i]));
          }
        }
      } else if (textLines.length == sel.ranges.length && cm.options.pasteLinesPerSelection) {
        multiPaste = map(textLines, function (l) {
          return [l];
        });
      }
    }

    var updateInput = cm.curOp.updateInput; // Normal behavior is to insert the new text into every selection

    for (var i$1 = sel.ranges.length - 1; i$1 >= 0; i$1--) {
      var range$$1 = sel.ranges[i$1];
      var from = range$$1.from(),
          to = range$$1.to();

      if (range$$1.empty()) {
        if (deleted && deleted > 0) // Handle deletion
          {
            from = Pos(from.line, from.ch - deleted);
          } else if (cm.state.overwrite && !paste) // Handle overwrite
          {
            to = Pos(to.line, Math.min(getLine(doc, to.line).text.length, to.ch + lst(textLines).length));
          } else if (paste && lastCopied && lastCopied.lineWise && lastCopied.text.join("\n") == inserted) {
          from = to = Pos(from.line, 0);
        }
      }

      var changeEvent = {
        from: from,
        to: to,
        text: multiPaste ? multiPaste[i$1 % multiPaste.length] : textLines,
        origin: origin || (paste ? "paste" : cm.state.cutIncoming > recent ? "cut" : "+input")
      };
      makeChange(cm.doc, changeEvent);
      signalLater(cm, "inputRead", cm, changeEvent);
    }

    if (inserted && !paste) {
      triggerElectric(cm, inserted);
    }

    ensureCursorVisible(cm);

    if (cm.curOp.updateInput < 2) {
      cm.curOp.updateInput = updateInput;
    }

    cm.curOp.typing = true;
    cm.state.pasteIncoming = cm.state.cutIncoming = -1;
  }

  function handlePaste(e, cm) {
    var pasted = e.clipboardData && e.clipboardData.getData("Text");

    if (pasted) {
      e.preventDefault();

      if (!cm.isReadOnly() && !cm.options.disableInput) {
        runInOp(cm, function () {
          return applyTextInput(cm, pasted, 0, null, "paste");
        });
      }

      return true;
    }
  }

  function triggerElectric(cm, inserted) {
    // When an 'electric' character is inserted, immediately trigger a reindent
    if (!cm.options.electricChars || !cm.options.smartIndent) {
      return;
    }

    var sel = cm.doc.sel;

    for (var i = sel.ranges.length - 1; i >= 0; i--) {
      var range$$1 = sel.ranges[i];

      if (range$$1.head.ch > 100 || i && sel.ranges[i - 1].head.line == range$$1.head.line) {
        continue;
      }

      var mode = cm.getModeAt(range$$1.head);
      var indented = false;

      if (mode.electricChars) {
        for (var j = 0; j < mode.electricChars.length; j++) {
          if (inserted.indexOf(mode.electricChars.charAt(j)) > -1) {
            indented = indentLine(cm, range$$1.head.line, "smart");
            break;
          }
        }
      } else if (mode.electricInput) {
        if (mode.electricInput.test(getLine(cm.doc, range$$1.head.line).text.slice(0, range$$1.head.ch))) {
          indented = indentLine(cm, range$$1.head.line, "smart");
        }
      }

      if (indented) {
        signalLater(cm, "electricInput", cm, range$$1.head.line);
      }
    }
  }

  function copyableRanges(cm) {
    var text = [],
        ranges = [];

    for (var i = 0; i < cm.doc.sel.ranges.length; i++) {
      var line = cm.doc.sel.ranges[i].head.line;
      var lineRange = {
        anchor: Pos(line, 0),
        head: Pos(line + 1, 0)
      };
      ranges.push(lineRange);
      text.push(cm.getRange(lineRange.anchor, lineRange.head));
    }

    return {
      text: text,
      ranges: ranges
    };
  }

  function disableBrowserMagic(field, spellcheck, autocorrect, autocapitalize) {
    field.setAttribute("autocorrect", autocorrect ? "" : "off");
    field.setAttribute("autocapitalize", autocapitalize ? "" : "off");
    field.setAttribute("spellcheck", !!spellcheck);
  }

  function hiddenTextarea() {
    var te = elt("textarea", null, null, "position: absolute; bottom: -1em; padding: 0; width: 1px; height: 1em; outline: none");
    var div = elt("div", [te], null, "overflow: hidden; position: relative; width: 3px; height: 0px;"); // The textarea is kept positioned near the cursor to prevent the
    // fact that it'll be scrolled into view on input from scrolling
    // our fake cursor out of view. On webkit, when wrap=off, paste is
    // very slow. So make the area wide instead.

    if (webkit) {
      te.style.width = "1000px";
    } else {
      te.setAttribute("wrap", "off");
    } // If border: 0; -- iOS fails to open keyboard (issue #1287)


    if (ios) {
      te.style.border = "1px solid black";
    }

    disableBrowserMagic(te);
    return div;
  } // The publicly visible API. Note that methodOp(f) means
  // 'wrap f in an operation, performed on its `this` parameter'.
  // This is not the complete set of editor methods. Most of the
  // methods defined on the Doc type are also injected into
  // CodeMirror.prototype, for backwards compatibility and
  // convenience.


  function addEditorMethods(CodeMirror) {
    var optionHandlers = CodeMirror.optionHandlers;
    var helpers = CodeMirror.helpers = {};
    CodeMirror.prototype = {
      constructor: CodeMirror,
      focus: function focus() {
        window.focus();
        this.display.input.focus();
      },
      setOption: function setOption(option, value) {
        var options = this.options,
            old = options[option];

        if (options[option] == value && option != "mode") {
          return;
        }

        options[option] = value;

        if (optionHandlers.hasOwnProperty(option)) {
          operation(this, optionHandlers[option])(this, value, old);
        }

        signal(this, "optionChange", this, option);
      },
      getOption: function getOption(option) {
        return this.options[option];
      },
      getDoc: function getDoc() {
        return this.doc;
      },
      addKeyMap: function addKeyMap(map$$1, bottom) {
        this.state.keyMaps[bottom ? "push" : "unshift"](getKeyMap(map$$1));
      },
      removeKeyMap: function removeKeyMap(map$$1) {
        var maps = this.state.keyMaps;

        for (var i = 0; i < maps.length; ++i) {
          if (maps[i] == map$$1 || maps[i].name == map$$1) {
            maps.splice(i, 1);
            return true;
          }
        }
      },
      addOverlay: methodOp(function (spec, options) {
        var mode = spec.token ? spec : CodeMirror.getMode(this.options, spec);

        if (mode.startState) {
          throw new Error("Overlays may not be stateful.");
        }

        insertSorted(this.state.overlays, {
          mode: mode,
          modeSpec: spec,
          opaque: options && options.opaque,
          priority: options && options.priority || 0
        }, function (overlay) {
          return overlay.priority;
        });
        this.state.modeGen++;
        regChange(this);
      }),
      removeOverlay: methodOp(function (spec) {
        var this$1 = this;
        var overlays = this.state.overlays;

        for (var i = 0; i < overlays.length; ++i) {
          var cur = overlays[i].modeSpec;

          if (cur == spec || typeof spec == "string" && cur.name == spec) {
            overlays.splice(i, 1);
            this$1.state.modeGen++;
            regChange(this$1);
            return;
          }
        }
      }),
      indentLine: methodOp(function (n, dir, aggressive) {
        if (typeof dir != "string" && typeof dir != "number") {
          if (dir == null) {
            dir = this.options.smartIndent ? "smart" : "prev";
          } else {
            dir = dir ? "add" : "subtract";
          }
        }

        if (isLine(this.doc, n)) {
          indentLine(this, n, dir, aggressive);
        }
      }),
      indentSelection: methodOp(function (how) {
        var this$1 = this;
        var ranges = this.doc.sel.ranges,
            end = -1;

        for (var i = 0; i < ranges.length; i++) {
          var range$$1 = ranges[i];

          if (!range$$1.empty()) {
            var from = range$$1.from(),
                to = range$$1.to();
            var start = Math.max(end, from.line);
            end = Math.min(this$1.lastLine(), to.line - (to.ch ? 0 : 1)) + 1;

            for (var j = start; j < end; ++j) {
              indentLine(this$1, j, how);
            }

            var newRanges = this$1.doc.sel.ranges;

            if (from.ch == 0 && ranges.length == newRanges.length && newRanges[i].from().ch > 0) {
              replaceOneSelection(this$1.doc, i, new Range(from, newRanges[i].to()), sel_dontScroll);
            }
          } else if (range$$1.head.line > end) {
            indentLine(this$1, range$$1.head.line, how, true);
            end = range$$1.head.line;

            if (i == this$1.doc.sel.primIndex) {
              ensureCursorVisible(this$1);
            }
          }
        }
      }),
      // Fetch the parser token for a given character. Useful for hacks
      // that want to inspect the mode state (say, for completion).
      getTokenAt: function getTokenAt(pos, precise) {
        return takeToken(this, pos, precise);
      },
      getLineTokens: function getLineTokens(line, precise) {
        return takeToken(this, Pos(line), precise, true);
      },
      getTokenTypeAt: function getTokenTypeAt(pos) {
        pos = _clipPos(this.doc, pos);
        var styles = getLineStyles(this, getLine(this.doc, pos.line));
        var before = 0,
            after = (styles.length - 1) / 2,
            ch = pos.ch;
        var type;

        if (ch == 0) {
          type = styles[2];
        } else {
          for (;;) {
            var mid = before + after >> 1;

            if ((mid ? styles[mid * 2 - 1] : 0) >= ch) {
              after = mid;
            } else if (styles[mid * 2 + 1] < ch) {
              before = mid + 1;
            } else {
              type = styles[mid * 2 + 2];
              break;
            }
          }
        }

        var cut = type ? type.indexOf("overlay ") : -1;
        return cut < 0 ? type : cut == 0 ? null : type.slice(0, cut - 1);
      },
      getModeAt: function getModeAt(pos) {
        var mode = this.doc.mode;

        if (!mode.innerMode) {
          return mode;
        }

        return CodeMirror.innerMode(mode, this.getTokenAt(pos).state).mode;
      },
      getHelper: function getHelper(pos, type) {
        return this.getHelpers(pos, type)[0];
      },
      getHelpers: function getHelpers(pos, type) {
        var this$1 = this;
        var found = [];

        if (!helpers.hasOwnProperty(type)) {
          return found;
        }

        var help = helpers[type],
            mode = this.getModeAt(pos);

        if (typeof mode[type] == "string") {
          if (help[mode[type]]) {
            found.push(help[mode[type]]);
          }
        } else if (mode[type]) {
          for (var i = 0; i < mode[type].length; i++) {
            var val = help[mode[type][i]];

            if (val) {
              found.push(val);
            }
          }
        } else if (mode.helperType && help[mode.helperType]) {
          found.push(help[mode.helperType]);
        } else if (help[mode.name]) {
          found.push(help[mode.name]);
        }

        for (var i$1 = 0; i$1 < help._global.length; i$1++) {
          var cur = help._global[i$1];

          if (cur.pred(mode, this$1) && indexOf(found, cur.val) == -1) {
            found.push(cur.val);
          }
        }

        return found;
      },
      getStateAfter: function getStateAfter(line, precise) {
        var doc = this.doc;
        line = clipLine(doc, line == null ? doc.first + doc.size - 1 : line);
        return getContextBefore(this, line + 1, precise).state;
      },
      cursorCoords: function cursorCoords(start, mode) {
        var pos,
            range$$1 = this.doc.sel.primary();

        if (start == null) {
          pos = range$$1.head;
        } else if (_typeof(start) == "object") {
          pos = _clipPos(this.doc, start);
        } else {
          pos = start ? range$$1.from() : range$$1.to();
        }

        return _cursorCoords(this, pos, mode || "page");
      },
      charCoords: function charCoords(pos, mode) {
        return _charCoords(this, _clipPos(this.doc, pos), mode || "page");
      },
      coordsChar: function coordsChar(coords, mode) {
        coords = fromCoordSystem(this, coords, mode || "page");
        return _coordsChar(this, coords.left, coords.top);
      },
      lineAtHeight: function lineAtHeight(height, mode) {
        height = fromCoordSystem(this, {
          top: height,
          left: 0
        }, mode || "page").top;
        return _lineAtHeight(this.doc, height + this.display.viewOffset);
      },
      heightAtLine: function heightAtLine(line, mode, includeWidgets) {
        var end = false,
            lineObj;

        if (typeof line == "number") {
          var last = this.doc.first + this.doc.size - 1;

          if (line < this.doc.first) {
            line = this.doc.first;
          } else if (line > last) {
            line = last;
            end = true;
          }

          lineObj = getLine(this.doc, line);
        } else {
          lineObj = line;
        }

        return intoCoordSystem(this, lineObj, {
          top: 0,
          left: 0
        }, mode || "page", includeWidgets || end).top + (end ? this.doc.height - _heightAtLine(lineObj) : 0);
      },
      defaultTextHeight: function defaultTextHeight() {
        return textHeight(this.display);
      },
      defaultCharWidth: function defaultCharWidth() {
        return charWidth(this.display);
      },
      getViewport: function getViewport() {
        return {
          from: this.display.viewFrom,
          to: this.display.viewTo
        };
      },
      addWidget: function addWidget(pos, node, scroll, vert, horiz) {
        var display = this.display;
        pos = _cursorCoords(this, _clipPos(this.doc, pos));
        var top = pos.bottom,
            left = pos.left;
        node.style.position = "absolute";
        node.setAttribute("cm-ignore-events", "true");
        this.display.input.setUneditable(node);
        display.sizer.appendChild(node);

        if (vert == "over") {
          top = pos.top;
        } else if (vert == "above" || vert == "near") {
          var vspace = Math.max(display.wrapper.clientHeight, this.doc.height),
              hspace = Math.max(display.sizer.clientWidth, display.lineSpace.clientWidth); // Default to positioning above (if specified and possible); otherwise default to positioning below

          if ((vert == 'above' || pos.bottom + node.offsetHeight > vspace) && pos.top > node.offsetHeight) {
            top = pos.top - node.offsetHeight;
          } else if (pos.bottom + node.offsetHeight <= vspace) {
            top = pos.bottom;
          }

          if (left + node.offsetWidth > hspace) {
            left = hspace - node.offsetWidth;
          }
        }

        node.style.top = top + "px";
        node.style.left = node.style.right = "";

        if (horiz == "right") {
          left = display.sizer.clientWidth - node.offsetWidth;
          node.style.right = "0px";
        } else {
          if (horiz == "left") {
            left = 0;
          } else if (horiz == "middle") {
            left = (display.sizer.clientWidth - node.offsetWidth) / 2;
          }

          node.style.left = left + "px";
        }

        if (scroll) {
          scrollIntoView(this, {
            left: left,
            top: top,
            right: left + node.offsetWidth,
            bottom: top + node.offsetHeight
          });
        }
      },
      triggerOnKeyDown: methodOp(onKeyDown),
      triggerOnKeyPress: methodOp(onKeyPress),
      triggerOnKeyUp: onKeyUp,
      triggerOnMouseDown: methodOp(onMouseDown),
      execCommand: function execCommand(cmd) {
        if (commands.hasOwnProperty(cmd)) {
          return commands[cmd].call(null, this);
        }
      },
      triggerElectric: methodOp(function (text) {
        triggerElectric(this, text);
      }),
      findPosH: function findPosH(from, amount, unit, visually) {
        var this$1 = this;
        var dir = 1;

        if (amount < 0) {
          dir = -1;
          amount = -amount;
        }

        var cur = _clipPos(this.doc, from);

        for (var i = 0; i < amount; ++i) {
          cur = _findPosH(this$1.doc, cur, dir, unit, visually);

          if (cur.hitSide) {
            break;
          }
        }

        return cur;
      },
      moveH: methodOp(function (dir, unit) {
        var this$1 = this;
        this.extendSelectionsBy(function (range$$1) {
          if (this$1.display.shift || this$1.doc.extend || range$$1.empty()) {
            return _findPosH(this$1.doc, range$$1.head, dir, unit, this$1.options.rtlMoveVisually);
          } else {
            return dir < 0 ? range$$1.from() : range$$1.to();
          }
        }, sel_move);
      }),
      deleteH: methodOp(function (dir, unit) {
        var sel = this.doc.sel,
            doc = this.doc;

        if (sel.somethingSelected()) {
          doc.replaceSelection("", null, "+delete");
        } else {
          deleteNearSelection(this, function (range$$1) {
            var other = _findPosH(doc, range$$1.head, dir, unit, false);

            return dir < 0 ? {
              from: other,
              to: range$$1.head
            } : {
              from: range$$1.head,
              to: other
            };
          });
        }
      }),
      findPosV: function findPosV(from, amount, unit, goalColumn) {
        var this$1 = this;
        var dir = 1,
            x = goalColumn;

        if (amount < 0) {
          dir = -1;
          amount = -amount;
        }

        var cur = _clipPos(this.doc, from);

        for (var i = 0; i < amount; ++i) {
          var coords = _cursorCoords(this$1, cur, "div");

          if (x == null) {
            x = coords.left;
          } else {
            coords.left = x;
          }

          cur = _findPosV(this$1, coords, dir, unit);

          if (cur.hitSide) {
            break;
          }
        }

        return cur;
      },
      moveV: methodOp(function (dir, unit) {
        var this$1 = this;
        var doc = this.doc,
            goals = [];
        var collapse = !this.display.shift && !doc.extend && doc.sel.somethingSelected();
        doc.extendSelectionsBy(function (range$$1) {
          if (collapse) {
            return dir < 0 ? range$$1.from() : range$$1.to();
          }

          var headPos = _cursorCoords(this$1, range$$1.head, "div");

          if (range$$1.goalColumn != null) {
            headPos.left = range$$1.goalColumn;
          }

          goals.push(headPos.left);

          var pos = _findPosV(this$1, headPos, dir, unit);

          if (unit == "page" && range$$1 == doc.sel.primary()) {
            addToScrollTop(this$1, _charCoords(this$1, pos, "div").top - headPos.top);
          }

          return pos;
        }, sel_move);

        if (goals.length) {
          for (var i = 0; i < doc.sel.ranges.length; i++) {
            doc.sel.ranges[i].goalColumn = goals[i];
          }
        }
      }),
      // Find the word at the given position (as returned by coordsChar).
      findWordAt: function findWordAt(pos) {
        var doc = this.doc,
            line = getLine(doc, pos.line).text;
        var start = pos.ch,
            end = pos.ch;

        if (line) {
          var helper = this.getHelper(pos, "wordChars");

          if ((pos.sticky == "before" || end == line.length) && start) {
            --start;
          } else {
            ++end;
          }

          var startChar = line.charAt(start);
          var check = isWordChar(startChar, helper) ? function (ch) {
            return isWordChar(ch, helper);
          } : /\s/.test(startChar) ? function (ch) {
            return /\s/.test(ch);
          } : function (ch) {
            return !/\s/.test(ch) && !isWordChar(ch);
          };

          while (start > 0 && check(line.charAt(start - 1))) {
            --start;
          }

          while (end < line.length && check(line.charAt(end))) {
            ++end;
          }
        }

        return new Range(Pos(pos.line, start), Pos(pos.line, end));
      },
      toggleOverwrite: function toggleOverwrite(value) {
        if (value != null && value == this.state.overwrite) {
          return;
        }

        if (this.state.overwrite = !this.state.overwrite) {
          addClass(this.display.cursorDiv, "CodeMirror-overwrite");
        } else {
          rmClass(this.display.cursorDiv, "CodeMirror-overwrite");
        }

        signal(this, "overwriteToggle", this, this.state.overwrite);
      },
      hasFocus: function hasFocus() {
        return this.display.input.getField() == activeElt();
      },
      isReadOnly: function isReadOnly() {
        return !!(this.options.readOnly || this.doc.cantEdit);
      },
      scrollTo: methodOp(function (x, y) {
        scrollToCoords(this, x, y);
      }),
      getScrollInfo: function getScrollInfo() {
        var scroller = this.display.scroller;
        return {
          left: scroller.scrollLeft,
          top: scroller.scrollTop,
          height: scroller.scrollHeight - scrollGap(this) - this.display.barHeight,
          width: scroller.scrollWidth - scrollGap(this) - this.display.barWidth,
          clientHeight: displayHeight(this),
          clientWidth: displayWidth(this)
        };
      },
      scrollIntoView: methodOp(function (range$$1, margin) {
        if (range$$1 == null) {
          range$$1 = {
            from: this.doc.sel.primary().head,
            to: null
          };

          if (margin == null) {
            margin = this.options.cursorScrollMargin;
          }
        } else if (typeof range$$1 == "number") {
          range$$1 = {
            from: Pos(range$$1, 0),
            to: null
          };
        } else if (range$$1.from == null) {
          range$$1 = {
            from: range$$1,
            to: null
          };
        }

        if (!range$$1.to) {
          range$$1.to = range$$1.from;
        }

        range$$1.margin = margin || 0;

        if (range$$1.from.line != null) {
          scrollToRange(this, range$$1);
        } else {
          scrollToCoordsRange(this, range$$1.from, range$$1.to, range$$1.margin);
        }
      }),
      setSize: methodOp(function (width, height) {
        var this$1 = this;

        var interpret = function interpret(val) {
          return typeof val == "number" || /^\d+$/.test(String(val)) ? val + "px" : val;
        };

        if (width != null) {
          this.display.wrapper.style.width = interpret(width);
        }

        if (height != null) {
          this.display.wrapper.style.height = interpret(height);
        }

        if (this.options.lineWrapping) {
          clearLineMeasurementCache(this);
        }

        var lineNo$$1 = this.display.viewFrom;
        this.doc.iter(lineNo$$1, this.display.viewTo, function (line) {
          if (line.widgets) {
            for (var i = 0; i < line.widgets.length; i++) {
              if (line.widgets[i].noHScroll) {
                regLineChange(this$1, lineNo$$1, "widget");
                break;
              }
            }
          }

          ++lineNo$$1;
        });
        this.curOp.forceUpdate = true;
        signal(this, "refresh", this);
      }),
      operation: function operation(f) {
        return runInOp(this, f);
      },
      startOperation: function startOperation() {
        return _startOperation(this);
      },
      endOperation: function endOperation() {
        return _endOperation(this);
      },
      refresh: methodOp(function () {
        var oldHeight = this.display.cachedTextHeight;
        regChange(this);
        this.curOp.forceUpdate = true;
        clearCaches(this);
        scrollToCoords(this, this.doc.scrollLeft, this.doc.scrollTop);
        updateGutterSpace(this.display);

        if (oldHeight == null || Math.abs(oldHeight - textHeight(this.display)) > .5) {
          estimateLineHeights(this);
        }

        signal(this, "refresh", this);
      }),
      swapDoc: methodOp(function (doc) {
        var old = this.doc;
        old.cm = null; // Cancel the current text selection if any (#5821)

        if (this.state.selectingText) {
          this.state.selectingText();
        }

        attachDoc(this, doc);
        clearCaches(this);
        this.display.input.reset();
        scrollToCoords(this, doc.scrollLeft, doc.scrollTop);
        this.curOp.forceScroll = true;
        signalLater(this, "swapDoc", this, old);
        return old;
      }),
      phrase: function phrase(phraseText) {
        var phrases = this.options.phrases;
        return phrases && Object.prototype.hasOwnProperty.call(phrases, phraseText) ? phrases[phraseText] : phraseText;
      },
      getInputField: function getInputField() {
        return this.display.input.getField();
      },
      getWrapperElement: function getWrapperElement() {
        return this.display.wrapper;
      },
      getScrollerElement: function getScrollerElement() {
        return this.display.scroller;
      },
      getGutterElement: function getGutterElement() {
        return this.display.gutters;
      }
    };
    eventMixin(CodeMirror);

    CodeMirror.registerHelper = function (type, name, value) {
      if (!helpers.hasOwnProperty(type)) {
        helpers[type] = CodeMirror[type] = {
          _global: []
        };
      }

      helpers[type][name] = value;
    };

    CodeMirror.registerGlobalHelper = function (type, name, predicate, value) {
      CodeMirror.registerHelper(type, name, value);

      helpers[type]._global.push({
        pred: predicate,
        val: value
      });
    };
  } // Used for horizontal relative motion. Dir is -1 or 1 (left or
  // right), unit can be "char", "column" (like char, but doesn't
  // cross line boundaries), "word" (across next word), or "group" (to
  // the start of next group of word or non-word-non-whitespace
  // chars). The visually param controls whether, in right-to-left
  // text, direction 1 means to move towards the next index in the
  // string, or towards the character to the right of the current
  // position. The resulting position will have a hitSide=true
  // property if it reached the end of the document.


  function _findPosH(doc, pos, dir, unit, visually) {
    var oldPos = pos;
    var origDir = dir;
    var lineObj = getLine(doc, pos.line);

    function findNextLine() {
      var l = pos.line + dir;

      if (l < doc.first || l >= doc.first + doc.size) {
        return false;
      }

      pos = new Pos(l, pos.ch, pos.sticky);
      return lineObj = getLine(doc, l);
    }

    function moveOnce(boundToLine) {
      var next;

      if (visually) {
        next = moveVisually(doc.cm, lineObj, pos, dir);
      } else {
        next = moveLogically(lineObj, pos, dir);
      }

      if (next == null) {
        if (!boundToLine && findNextLine()) {
          pos = endOfLine(visually, doc.cm, lineObj, pos.line, dir);
        } else {
          return false;
        }
      } else {
        pos = next;
      }

      return true;
    }

    if (unit == "char") {
      moveOnce();
    } else if (unit == "column") {
      moveOnce(true);
    } else if (unit == "word" || unit == "group") {
      var sawType = null,
          group = unit == "group";
      var helper = doc.cm && doc.cm.getHelper(pos, "wordChars");

      for (var first = true;; first = false) {
        if (dir < 0 && !moveOnce(!first)) {
          break;
        }

        var cur = lineObj.text.charAt(pos.ch) || "\n";
        var type = isWordChar(cur, helper) ? "w" : group && cur == "\n" ? "n" : !group || /\s/.test(cur) ? null : "p";

        if (group && !first && !type) {
          type = "s";
        }

        if (sawType && sawType != type) {
          if (dir < 0) {
            dir = 1;
            moveOnce();
            pos.sticky = "after";
          }

          break;
        }

        if (type) {
          sawType = type;
        }

        if (dir > 0 && !moveOnce(!first)) {
          break;
        }
      }
    }

    var result = skipAtomic(doc, pos, oldPos, origDir, true);

    if (equalCursorPos(oldPos, result)) {
      result.hitSide = true;
    }

    return result;
  } // For relative vertical movement. Dir may be -1 or 1. Unit can be
  // "page" or "line". The resulting position will have a hitSide=true
  // property if it reached the end of the document.


  function _findPosV(cm, pos, dir, unit) {
    var doc = cm.doc,
        x = pos.left,
        y;

    if (unit == "page") {
      var pageSize = Math.min(cm.display.wrapper.clientHeight, window.innerHeight || document.documentElement.clientHeight);
      var moveAmount = Math.max(pageSize - .5 * textHeight(cm.display), 3);
      y = (dir > 0 ? pos.bottom : pos.top) + dir * moveAmount;
    } else if (unit == "line") {
      y = dir > 0 ? pos.bottom + 3 : pos.top - 3;
    }

    var target;

    for (;;) {
      target = _coordsChar(cm, x, y);

      if (!target.outside) {
        break;
      }

      if (dir < 0 ? y <= 0 : y >= doc.height) {
        target.hitSide = true;
        break;
      }

      y += dir * 5;
    }

    return target;
  } // CONTENTEDITABLE INPUT STYLE


  var ContentEditableInput = function ContentEditableInput(cm) {
    this.cm = cm;
    this.lastAnchorNode = this.lastAnchorOffset = this.lastFocusNode = this.lastFocusOffset = null;
    this.polling = new Delayed();
    this.composing = null;
    this.gracePeriod = false;
    this.readDOMTimeout = null;
  };

  ContentEditableInput.prototype.init = function (display) {
    var this$1 = this;
    var input = this,
        cm = input.cm;
    var div = input.div = display.lineDiv;
    disableBrowserMagic(div, cm.options.spellcheck, cm.options.autocorrect, cm.options.autocapitalize);
    on(div, "paste", function (e) {
      if (signalDOMEvent(cm, e) || handlePaste(e, cm)) {
        return;
      } // IE doesn't fire input events, so we schedule a read for the pasted content in this way


      if (ie_version <= 11) {
        setTimeout(operation(cm, function () {
          return this$1.updateFromDOM();
        }), 20);
      }
    });
    on(div, "compositionstart", function (e) {
      this$1.composing = {
        data: e.data,
        done: false
      };
    });
    on(div, "compositionupdate", function (e) {
      if (!this$1.composing) {
        this$1.composing = {
          data: e.data,
          done: false
        };
      }
    });
    on(div, "compositionend", function (e) {
      if (this$1.composing) {
        if (e.data != this$1.composing.data) {
          this$1.readFromDOMSoon();
        }

        this$1.composing.done = true;
      }
    });
    on(div, "touchstart", function () {
      return input.forceCompositionEnd();
    });
    on(div, "input", function () {
      if (!this$1.composing) {
        this$1.readFromDOMSoon();
      }
    });

    function onCopyCut(e) {
      if (signalDOMEvent(cm, e)) {
        return;
      }

      if (cm.somethingSelected()) {
        setLastCopied({
          lineWise: false,
          text: cm.getSelections()
        });

        if (e.type == "cut") {
          cm.replaceSelection("", null, "cut");
        }
      } else if (!cm.options.lineWiseCopyCut) {
        return;
      } else {
        var ranges = copyableRanges(cm);
        setLastCopied({
          lineWise: true,
          text: ranges.text
        });

        if (e.type == "cut") {
          cm.operation(function () {
            cm.setSelections(ranges.ranges, 0, sel_dontScroll);
            cm.replaceSelection("", null, "cut");
          });
        }
      }

      if (e.clipboardData) {
        e.clipboardData.clearData();
        var content = lastCopied.text.join("\n"); // iOS exposes the clipboard API, but seems to discard content inserted into it

        e.clipboardData.setData("Text", content);

        if (e.clipboardData.getData("Text") == content) {
          e.preventDefault();
          return;
        }
      } // Old-fashioned briefly-focus-a-textarea hack


      var kludge = hiddenTextarea(),
          te = kludge.firstChild;
      cm.display.lineSpace.insertBefore(kludge, cm.display.lineSpace.firstChild);
      te.value = lastCopied.text.join("\n");
      var hadFocus = document.activeElement;
      selectInput(te);
      setTimeout(function () {
        cm.display.lineSpace.removeChild(kludge);
        hadFocus.focus();

        if (hadFocus == div) {
          input.showPrimarySelection();
        }
      }, 50);
    }

    on(div, "copy", onCopyCut);
    on(div, "cut", onCopyCut);
  };

  ContentEditableInput.prototype.prepareSelection = function () {
    var result = prepareSelection(this.cm, false);
    result.focus = this.cm.state.focused;
    return result;
  };

  ContentEditableInput.prototype.showSelection = function (info, takeFocus) {
    if (!info || !this.cm.display.view.length) {
      return;
    }

    if (info.focus || takeFocus) {
      this.showPrimarySelection();
    }

    this.showMultipleSelections(info);
  };

  ContentEditableInput.prototype.getSelection = function () {
    return this.cm.display.wrapper.ownerDocument.getSelection();
  };

  ContentEditableInput.prototype.showPrimarySelection = function () {
    var sel = this.getSelection(),
        cm = this.cm,
        prim = cm.doc.sel.primary();
    var from = prim.from(),
        to = prim.to();

    if (cm.display.viewTo == cm.display.viewFrom || from.line >= cm.display.viewTo || to.line < cm.display.viewFrom) {
      sel.removeAllRanges();
      return;
    }

    var curAnchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
    var curFocus = domToPos(cm, sel.focusNode, sel.focusOffset);

    if (curAnchor && !curAnchor.bad && curFocus && !curFocus.bad && cmp(minPos(curAnchor, curFocus), from) == 0 && cmp(maxPos(curAnchor, curFocus), to) == 0) {
      return;
    }

    var view = cm.display.view;
    var start = from.line >= cm.display.viewFrom && posToDOM(cm, from) || {
      node: view[0].measure.map[2],
      offset: 0
    };
    var end = to.line < cm.display.viewTo && posToDOM(cm, to);

    if (!end) {
      var measure = view[view.length - 1].measure;
      var map$$1 = measure.maps ? measure.maps[measure.maps.length - 1] : measure.map;
      end = {
        node: map$$1[map$$1.length - 1],
        offset: map$$1[map$$1.length - 2] - map$$1[map$$1.length - 3]
      };
    }

    if (!start || !end) {
      sel.removeAllRanges();
      return;
    }

    var old = sel.rangeCount && sel.getRangeAt(0),
        rng;

    try {
      rng = range(start.node, start.offset, end.offset, end.node);
    } catch (e) {} // Our model of the DOM might be outdated, in which case the range we try to set can be impossible


    if (rng) {
      if (!gecko && cm.state.focused) {
        sel.collapse(start.node, start.offset);

        if (!rng.collapsed) {
          sel.removeAllRanges();
          sel.addRange(rng);
        }
      } else {
        sel.removeAllRanges();
        sel.addRange(rng);
      }

      if (old && sel.anchorNode == null) {
        sel.addRange(old);
      } else if (gecko) {
        this.startGracePeriod();
      }
    }

    this.rememberSelection();
  };

  ContentEditableInput.prototype.startGracePeriod = function () {
    var this$1 = this;
    clearTimeout(this.gracePeriod);
    this.gracePeriod = setTimeout(function () {
      this$1.gracePeriod = false;

      if (this$1.selectionChanged()) {
        this$1.cm.operation(function () {
          return this$1.cm.curOp.selectionChanged = true;
        });
      }
    }, 20);
  };

  ContentEditableInput.prototype.showMultipleSelections = function (info) {
    removeChildrenAndAdd(this.cm.display.cursorDiv, info.cursors);
    removeChildrenAndAdd(this.cm.display.selectionDiv, info.selection);
  };

  ContentEditableInput.prototype.rememberSelection = function () {
    var sel = this.getSelection();
    this.lastAnchorNode = sel.anchorNode;
    this.lastAnchorOffset = sel.anchorOffset;
    this.lastFocusNode = sel.focusNode;
    this.lastFocusOffset = sel.focusOffset;
  };

  ContentEditableInput.prototype.selectionInEditor = function () {
    var sel = this.getSelection();

    if (!sel.rangeCount) {
      return false;
    }

    var node = sel.getRangeAt(0).commonAncestorContainer;
    return contains(this.div, node);
  };

  ContentEditableInput.prototype.focus = function () {
    if (this.cm.options.readOnly != "nocursor") {
      if (!this.selectionInEditor()) {
        this.showSelection(this.prepareSelection(), true);
      }

      this.div.focus();
    }
  };

  ContentEditableInput.prototype.blur = function () {
    this.div.blur();
  };

  ContentEditableInput.prototype.getField = function () {
    return this.div;
  };

  ContentEditableInput.prototype.supportsTouch = function () {
    return true;
  };

  ContentEditableInput.prototype.receivedFocus = function () {
    var input = this;

    if (this.selectionInEditor()) {
      this.pollSelection();
    } else {
      runInOp(this.cm, function () {
        return input.cm.curOp.selectionChanged = true;
      });
    }

    function poll() {
      if (input.cm.state.focused) {
        input.pollSelection();
        input.polling.set(input.cm.options.pollInterval, poll);
      }
    }

    this.polling.set(this.cm.options.pollInterval, poll);
  };

  ContentEditableInput.prototype.selectionChanged = function () {
    var sel = this.getSelection();
    return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset || sel.focusNode != this.lastFocusNode || sel.focusOffset != this.lastFocusOffset;
  };

  ContentEditableInput.prototype.pollSelection = function () {
    if (this.readDOMTimeout != null || this.gracePeriod || !this.selectionChanged()) {
      return;
    }

    var sel = this.getSelection(),
        cm = this.cm; // On Android Chrome (version 56, at least), backspacing into an
    // uneditable block element will put the cursor in that element,
    // and then, because it's not editable, hide the virtual keyboard.
    // Because Android doesn't allow us to actually detect backspace
    // presses in a sane way, this code checks for when that happens
    // and simulates a backspace press in this case.

    if (android && chrome && this.cm.display.gutterSpecs.length && isInGutter(sel.anchorNode)) {
      this.cm.triggerOnKeyDown({
        type: "keydown",
        keyCode: 8,
        preventDefault: Math.abs
      });
      this.blur();
      this.focus();
      return;
    }

    if (this.composing) {
      return;
    }

    this.rememberSelection();
    var anchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
    var head = domToPos(cm, sel.focusNode, sel.focusOffset);

    if (anchor && head) {
      runInOp(cm, function () {
        setSelection(cm.doc, simpleSelection(anchor, head), sel_dontScroll);

        if (anchor.bad || head.bad) {
          cm.curOp.selectionChanged = true;
        }
      });
    }
  };

  ContentEditableInput.prototype.pollContent = function () {
    if (this.readDOMTimeout != null) {
      clearTimeout(this.readDOMTimeout);
      this.readDOMTimeout = null;
    }

    var cm = this.cm,
        display = cm.display,
        sel = cm.doc.sel.primary();
    var from = sel.from(),
        to = sel.to();

    if (from.ch == 0 && from.line > cm.firstLine()) {
      from = Pos(from.line - 1, getLine(cm.doc, from.line - 1).length);
    }

    if (to.ch == getLine(cm.doc, to.line).text.length && to.line < cm.lastLine()) {
      to = Pos(to.line + 1, 0);
    }

    if (from.line < display.viewFrom || to.line > display.viewTo - 1) {
      return false;
    }

    var fromIndex, fromLine, fromNode;

    if (from.line == display.viewFrom || (fromIndex = findViewIndex(cm, from.line)) == 0) {
      fromLine = lineNo(display.view[0].line);
      fromNode = display.view[0].node;
    } else {
      fromLine = lineNo(display.view[fromIndex].line);
      fromNode = display.view[fromIndex - 1].node.nextSibling;
    }

    var toIndex = findViewIndex(cm, to.line);
    var toLine, toNode;

    if (toIndex == display.view.length - 1) {
      toLine = display.viewTo - 1;
      toNode = display.lineDiv.lastChild;
    } else {
      toLine = lineNo(display.view[toIndex + 1].line) - 1;
      toNode = display.view[toIndex + 1].node.previousSibling;
    }

    if (!fromNode) {
      return false;
    }

    var newText = cm.doc.splitLines(domTextBetween(cm, fromNode, toNode, fromLine, toLine));
    var oldText = getBetween(cm.doc, Pos(fromLine, 0), Pos(toLine, getLine(cm.doc, toLine).text.length));

    while (newText.length > 1 && oldText.length > 1) {
      if (lst(newText) == lst(oldText)) {
        newText.pop();
        oldText.pop();
        toLine--;
      } else if (newText[0] == oldText[0]) {
        newText.shift();
        oldText.shift();
        fromLine++;
      } else {
        break;
      }
    }

    var cutFront = 0,
        cutEnd = 0;
    var newTop = newText[0],
        oldTop = oldText[0],
        maxCutFront = Math.min(newTop.length, oldTop.length);

    while (cutFront < maxCutFront && newTop.charCodeAt(cutFront) == oldTop.charCodeAt(cutFront)) {
      ++cutFront;
    }

    var newBot = lst(newText),
        oldBot = lst(oldText);
    var maxCutEnd = Math.min(newBot.length - (newText.length == 1 ? cutFront : 0), oldBot.length - (oldText.length == 1 ? cutFront : 0));

    while (cutEnd < maxCutEnd && newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1)) {
      ++cutEnd;
    } // Try to move start of change to start of selection if ambiguous


    if (newText.length == 1 && oldText.length == 1 && fromLine == from.line) {
      while (cutFront && cutFront > from.ch && newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1)) {
        cutFront--;
        cutEnd++;
      }
    }

    newText[newText.length - 1] = newBot.slice(0, newBot.length - cutEnd).replace(/^\u200b+/, "");
    newText[0] = newText[0].slice(cutFront).replace(/\u200b+$/, "");
    var chFrom = Pos(fromLine, cutFront);
    var chTo = Pos(toLine, oldText.length ? lst(oldText).length - cutEnd : 0);

    if (newText.length > 1 || newText[0] || cmp(chFrom, chTo)) {
      _replaceRange(cm.doc, newText, chFrom, chTo, "+input");

      return true;
    }
  };

  ContentEditableInput.prototype.ensurePolled = function () {
    this.forceCompositionEnd();
  };

  ContentEditableInput.prototype.reset = function () {
    this.forceCompositionEnd();
  };

  ContentEditableInput.prototype.forceCompositionEnd = function () {
    if (!this.composing) {
      return;
    }

    clearTimeout(this.readDOMTimeout);
    this.composing = null;
    this.updateFromDOM();
    this.div.blur();
    this.div.focus();
  };

  ContentEditableInput.prototype.readFromDOMSoon = function () {
    var this$1 = this;

    if (this.readDOMTimeout != null) {
      return;
    }

    this.readDOMTimeout = setTimeout(function () {
      this$1.readDOMTimeout = null;

      if (this$1.composing) {
        if (this$1.composing.done) {
          this$1.composing = null;
        } else {
          return;
        }
      }

      this$1.updateFromDOM();
    }, 80);
  };

  ContentEditableInput.prototype.updateFromDOM = function () {
    var this$1 = this;

    if (this.cm.isReadOnly() || !this.pollContent()) {
      runInOp(this.cm, function () {
        return regChange(this$1.cm);
      });
    }
  };

  ContentEditableInput.prototype.setUneditable = function (node) {
    node.contentEditable = "false";
  };

  ContentEditableInput.prototype.onKeyPress = function (e) {
    if (e.charCode == 0 || this.composing) {
      return;
    }

    e.preventDefault();

    if (!this.cm.isReadOnly()) {
      operation(this.cm, applyTextInput)(this.cm, String.fromCharCode(e.charCode == null ? e.keyCode : e.charCode), 0);
    }
  };

  ContentEditableInput.prototype.readOnlyChanged = function (val) {
    this.div.contentEditable = String(val != "nocursor");
  };

  ContentEditableInput.prototype.onContextMenu = function () {};

  ContentEditableInput.prototype.resetPosition = function () {};

  ContentEditableInput.prototype.needsContentAttribute = true;

  function posToDOM(cm, pos) {
    var view = findViewForLine(cm, pos.line);

    if (!view || view.hidden) {
      return null;
    }

    var line = getLine(cm.doc, pos.line);
    var info = mapFromLineView(view, line, pos.line);
    var order = getOrder(line, cm.doc.direction),
        side = "left";

    if (order) {
      var partPos = getBidiPartAt(order, pos.ch);
      side = partPos % 2 ? "right" : "left";
    }

    var result = nodeAndOffsetInLineMap(info.map, pos.ch, side);
    result.offset = result.collapse == "right" ? result.end : result.start;
    return result;
  }

  function isInGutter(node) {
    for (var scan = node; scan; scan = scan.parentNode) {
      if (/CodeMirror-gutter-wrapper/.test(scan.className)) {
        return true;
      }
    }

    return false;
  }

  function badPos(pos, bad) {
    if (bad) {
      pos.bad = true;
    }

    return pos;
  }

  function domTextBetween(cm, from, to, fromLine, toLine) {
    var text = "",
        closing = false,
        lineSep = cm.doc.lineSeparator(),
        extraLinebreak = false;

    function recognizeMarker(id) {
      return function (marker) {
        return marker.id == id;
      };
    }

    function close() {
      if (closing) {
        text += lineSep;

        if (extraLinebreak) {
          text += lineSep;
        }

        closing = extraLinebreak = false;
      }
    }

    function addText(str) {
      if (str) {
        close();
        text += str;
      }
    }

    function walk(node) {
      if (node.nodeType == 1) {
        var cmText = node.getAttribute("cm-text");

        if (cmText) {
          addText(cmText);
          return;
        }

        var markerID = node.getAttribute("cm-marker"),
            range$$1;

        if (markerID) {
          var found = cm.findMarks(Pos(fromLine, 0), Pos(toLine + 1, 0), recognizeMarker(+markerID));

          if (found.length && (range$$1 = found[0].find(0))) {
            addText(getBetween(cm.doc, range$$1.from, range$$1.to).join(lineSep));
          }

          return;
        }

        if (node.getAttribute("contenteditable") == "false") {
          return;
        }

        var isBlock = /^(pre|div|p|li|table|br)$/i.test(node.nodeName);

        if (!/^br$/i.test(node.nodeName) && node.textContent.length == 0) {
          return;
        }

        if (isBlock) {
          close();
        }

        for (var i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }

        if (/^(pre|p)$/i.test(node.nodeName)) {
          extraLinebreak = true;
        }

        if (isBlock) {
          closing = true;
        }
      } else if (node.nodeType == 3) {
        addText(node.nodeValue.replace(/\u200b/g, "").replace(/\u00a0/g, " "));
      }
    }

    for (;;) {
      walk(from);

      if (from == to) {
        break;
      }

      from = from.nextSibling;
      extraLinebreak = false;
    }

    return text;
  }

  function domToPos(cm, node, offset) {
    var lineNode;

    if (node == cm.display.lineDiv) {
      lineNode = cm.display.lineDiv.childNodes[offset];

      if (!lineNode) {
        return badPos(cm.clipPos(Pos(cm.display.viewTo - 1)), true);
      }

      node = null;
      offset = 0;
    } else {
      for (lineNode = node;; lineNode = lineNode.parentNode) {
        if (!lineNode || lineNode == cm.display.lineDiv) {
          return null;
        }

        if (lineNode.parentNode && lineNode.parentNode == cm.display.lineDiv) {
          break;
        }
      }
    }

    for (var i = 0; i < cm.display.view.length; i++) {
      var lineView = cm.display.view[i];

      if (lineView.node == lineNode) {
        return locateNodeInLineView(lineView, node, offset);
      }
    }
  }

  function locateNodeInLineView(lineView, node, offset) {
    var wrapper = lineView.text.firstChild,
        bad = false;

    if (!node || !contains(wrapper, node)) {
      return badPos(Pos(lineNo(lineView.line), 0), true);
    }

    if (node == wrapper) {
      bad = true;
      node = wrapper.childNodes[offset];
      offset = 0;

      if (!node) {
        var line = lineView.rest ? lst(lineView.rest) : lineView.line;
        return badPos(Pos(lineNo(line), line.text.length), bad);
      }
    }

    var textNode = node.nodeType == 3 ? node : null,
        topNode = node;

    if (!textNode && node.childNodes.length == 1 && node.firstChild.nodeType == 3) {
      textNode = node.firstChild;

      if (offset) {
        offset = textNode.nodeValue.length;
      }
    }

    while (topNode.parentNode != wrapper) {
      topNode = topNode.parentNode;
    }

    var measure = lineView.measure,
        maps = measure.maps;

    function find(textNode, topNode, offset) {
      for (var i = -1; i < (maps ? maps.length : 0); i++) {
        var map$$1 = i < 0 ? measure.map : maps[i];

        for (var j = 0; j < map$$1.length; j += 3) {
          var curNode = map$$1[j + 2];

          if (curNode == textNode || curNode == topNode) {
            var line = lineNo(i < 0 ? lineView.line : lineView.rest[i]);
            var ch = map$$1[j] + offset;

            if (offset < 0 || curNode != textNode) {
              ch = map$$1[j + (offset ? 1 : 0)];
            }

            return Pos(line, ch);
          }
        }
      }
    }

    var found = find(textNode, topNode, offset);

    if (found) {
      return badPos(found, bad);
    } // FIXME this is all really shaky. might handle the few cases it needs to handle, but likely to cause problems


    for (var after = topNode.nextSibling, dist = textNode ? textNode.nodeValue.length - offset : 0; after; after = after.nextSibling) {
      found = find(after, after.firstChild, 0);

      if (found) {
        return badPos(Pos(found.line, found.ch - dist), bad);
      } else {
        dist += after.textContent.length;
      }
    }

    for (var before = topNode.previousSibling, dist$1 = offset; before; before = before.previousSibling) {
      found = find(before, before.firstChild, -1);

      if (found) {
        return badPos(Pos(found.line, found.ch + dist$1), bad);
      } else {
        dist$1 += before.textContent.length;
      }
    }
  } // TEXTAREA INPUT STYLE


  var TextareaInput = function TextareaInput(cm) {
    this.cm = cm; // See input.poll and input.reset

    this.prevInput = ""; // Flag that indicates whether we expect input to appear real soon
    // now (after some event like 'keypress' or 'input') and are
    // polling intensively.

    this.pollingFast = false; // Self-resetting timeout for the poller

    this.polling = new Delayed(); // Used to work around IE issue with selection being forgotten when focus moves away from textarea

    this.hasSelection = false;
    this.composing = null;
  };

  TextareaInput.prototype.init = function (display) {
    var this$1 = this;
    var input = this,
        cm = this.cm;
    this.createField(display);
    var te = this.textarea;
    display.wrapper.insertBefore(this.wrapper, display.wrapper.firstChild); // Needed to hide big blue blinking cursor on Mobile Safari (doesn't seem to work in iOS 8 anymore)

    if (ios) {
      te.style.width = "0px";
    }

    on(te, "input", function () {
      if (ie && ie_version >= 9 && this$1.hasSelection) {
        this$1.hasSelection = null;
      }

      input.poll();
    });
    on(te, "paste", function (e) {
      if (signalDOMEvent(cm, e) || handlePaste(e, cm)) {
        return;
      }

      cm.state.pasteIncoming = +new Date();
      input.fastPoll();
    });

    function prepareCopyCut(e) {
      if (signalDOMEvent(cm, e)) {
        return;
      }

      if (cm.somethingSelected()) {
        setLastCopied({
          lineWise: false,
          text: cm.getSelections()
        });
      } else if (!cm.options.lineWiseCopyCut) {
        return;
      } else {
        var ranges = copyableRanges(cm);
        setLastCopied({
          lineWise: true,
          text: ranges.text
        });

        if (e.type == "cut") {
          cm.setSelections(ranges.ranges, null, sel_dontScroll);
        } else {
          input.prevInput = "";
          te.value = ranges.text.join("\n");
          selectInput(te);
        }
      }

      if (e.type == "cut") {
        cm.state.cutIncoming = +new Date();
      }
    }

    on(te, "cut", prepareCopyCut);
    on(te, "copy", prepareCopyCut);
    on(display.scroller, "paste", function (e) {
      if (eventInWidget(display, e) || signalDOMEvent(cm, e)) {
        return;
      }

      if (!te.dispatchEvent) {
        cm.state.pasteIncoming = +new Date();
        input.focus();
        return;
      } // Pass the `paste` event to the textarea so it's handled by its event listener.


      var event = new Event("paste");
      event.clipboardData = e.clipboardData;
      te.dispatchEvent(event);
    }); // Prevent normal selection in the editor (we handle our own)

    on(display.lineSpace, "selectstart", function (e) {
      if (!eventInWidget(display, e)) {
        e_preventDefault(e);
      }
    });
    on(te, "compositionstart", function () {
      var start = cm.getCursor("from");

      if (input.composing) {
        input.composing.range.clear();
      }

      input.composing = {
        start: start,
        range: cm.markText(start, cm.getCursor("to"), {
          className: "CodeMirror-composing"
        })
      };
    });
    on(te, "compositionend", function () {
      if (input.composing) {
        input.poll();
        input.composing.range.clear();
        input.composing = null;
      }
    });
  };

  TextareaInput.prototype.createField = function (_display) {
    // Wraps and hides input textarea
    this.wrapper = hiddenTextarea(); // The semihidden textarea that is focused when the editor is
    // focused, and receives input.

    this.textarea = this.wrapper.firstChild;
  };

  TextareaInput.prototype.prepareSelection = function () {
    // Redraw the selection and/or cursor
    var cm = this.cm,
        display = cm.display,
        doc = cm.doc;
    var result = prepareSelection(cm); // Move the hidden textarea near the cursor to prevent scrolling artifacts

    if (cm.options.moveInputWithCursor) {
      var headPos = _cursorCoords(cm, doc.sel.primary().head, "div");

      var wrapOff = display.wrapper.getBoundingClientRect(),
          lineOff = display.lineDiv.getBoundingClientRect();
      result.teTop = Math.max(0, Math.min(display.wrapper.clientHeight - 10, headPos.top + lineOff.top - wrapOff.top));
      result.teLeft = Math.max(0, Math.min(display.wrapper.clientWidth - 10, headPos.left + lineOff.left - wrapOff.left));
    }

    return result;
  };

  TextareaInput.prototype.showSelection = function (drawn) {
    var cm = this.cm,
        display = cm.display;
    removeChildrenAndAdd(display.cursorDiv, drawn.cursors);
    removeChildrenAndAdd(display.selectionDiv, drawn.selection);

    if (drawn.teTop != null) {
      this.wrapper.style.top = drawn.teTop + "px";
      this.wrapper.style.left = drawn.teLeft + "px";
    }
  }; // Reset the input to correspond to the selection (or to be empty,
  // when not typing and nothing is selected)


  TextareaInput.prototype.reset = function (typing) {
    if (this.contextMenuPending || this.composing) {
      return;
    }

    var cm = this.cm;

    if (cm.somethingSelected()) {
      this.prevInput = "";
      var content = cm.getSelection();
      this.textarea.value = content;

      if (cm.state.focused) {
        selectInput(this.textarea);
      }

      if (ie && ie_version >= 9) {
        this.hasSelection = content;
      }
    } else if (!typing) {
      this.prevInput = this.textarea.value = "";

      if (ie && ie_version >= 9) {
        this.hasSelection = null;
      }
    }
  };

  TextareaInput.prototype.getField = function () {
    return this.textarea;
  };

  TextareaInput.prototype.supportsTouch = function () {
    return false;
  };

  TextareaInput.prototype.focus = function () {
    if (this.cm.options.readOnly != "nocursor" && (!mobile || activeElt() != this.textarea)) {
      try {
        this.textarea.focus();
      } catch (e) {} // IE8 will throw if the textarea is display: none or not in DOM

    }
  };

  TextareaInput.prototype.blur = function () {
    this.textarea.blur();
  };

  TextareaInput.prototype.resetPosition = function () {
    this.wrapper.style.top = this.wrapper.style.left = 0;
  };

  TextareaInput.prototype.receivedFocus = function () {
    this.slowPoll();
  }; // Poll for input changes, using the normal rate of polling. This
  // runs as long as the editor is focused.


  TextareaInput.prototype.slowPoll = function () {
    var this$1 = this;

    if (this.pollingFast) {
      return;
    }

    this.polling.set(this.cm.options.pollInterval, function () {
      this$1.poll();

      if (this$1.cm.state.focused) {
        this$1.slowPoll();
      }
    });
  }; // When an event has just come in that is likely to add or change
  // something in the input textarea, we poll faster, to ensure that
  // the change appears on the screen quickly.


  TextareaInput.prototype.fastPoll = function () {
    var missed = false,
        input = this;
    input.pollingFast = true;

    function p() {
      var changed = input.poll();

      if (!changed && !missed) {
        missed = true;
        input.polling.set(60, p);
      } else {
        input.pollingFast = false;
        input.slowPoll();
      }
    }

    input.polling.set(20, p);
  }; // Read input from the textarea, and update the document to match.
  // When something is selected, it is present in the textarea, and
  // selected (unless it is huge, in which case a placeholder is
  // used). When nothing is selected, the cursor sits after previously
  // seen text (can be empty), which is stored in prevInput (we must
  // not reset the textarea when typing, because that breaks IME).


  TextareaInput.prototype.poll = function () {
    var this$1 = this;
    var cm = this.cm,
        input = this.textarea,
        prevInput = this.prevInput; // Since this is called a *lot*, try to bail out as cheaply as
    // possible when it is clear that nothing happened. hasSelection
    // will be the case when there is a lot of text in the textarea,
    // in which case reading its value would be expensive.

    if (this.contextMenuPending || !cm.state.focused || hasSelection(input) && !prevInput && !this.composing || cm.isReadOnly() || cm.options.disableInput || cm.state.keySeq) {
      return false;
    }

    var text = input.value; // If nothing changed, bail.

    if (text == prevInput && !cm.somethingSelected()) {
      return false;
    } // Work around nonsensical selection resetting in IE9/10, and
    // inexplicable appearance of private area unicode characters on
    // some key combos in Mac (#2689).


    if (ie && ie_version >= 9 && this.hasSelection === text || mac && /[\uf700-\uf7ff]/.test(text)) {
      cm.display.input.reset();
      return false;
    }

    if (cm.doc.sel == cm.display.selForContextMenu) {
      var first = text.charCodeAt(0);

      if (first == 0x200b && !prevInput) {
        prevInput = "\u200B";
      }

      if (first == 0x21da) {
        this.reset();
        return this.cm.execCommand("undo");
      }
    } // Find the part of the input that is actually new


    var same = 0,
        l = Math.min(prevInput.length, text.length);

    while (same < l && prevInput.charCodeAt(same) == text.charCodeAt(same)) {
      ++same;
    }

    runInOp(cm, function () {
      applyTextInput(cm, text.slice(same), prevInput.length - same, null, this$1.composing ? "*compose" : null); // Don't leave long text in the textarea, since it makes further polling slow

      if (text.length > 1000 || text.indexOf("\n") > -1) {
        input.value = this$1.prevInput = "";
      } else {
        this$1.prevInput = text;
      }

      if (this$1.composing) {
        this$1.composing.range.clear();
        this$1.composing.range = cm.markText(this$1.composing.start, cm.getCursor("to"), {
          className: "CodeMirror-composing"
        });
      }
    });
    return true;
  };

  TextareaInput.prototype.ensurePolled = function () {
    if (this.pollingFast && this.poll()) {
      this.pollingFast = false;
    }
  };

  TextareaInput.prototype.onKeyPress = function () {
    if (ie && ie_version >= 9) {
      this.hasSelection = null;
    }

    this.fastPoll();
  };

  TextareaInput.prototype.onContextMenu = function (e) {
    var input = this,
        cm = input.cm,
        display = cm.display,
        te = input.textarea;

    if (input.contextMenuPending) {
      input.contextMenuPending();
    }

    var pos = posFromMouse(cm, e),
        scrollPos = display.scroller.scrollTop;

    if (!pos || presto) {
      return;
    } // Opera is difficult.
    // Reset the current text selection only if the click is done outside of the selection
    // and 'resetSelectionOnContextMenu' option is true.


    var reset = cm.options.resetSelectionOnContextMenu;

    if (reset && cm.doc.sel.contains(pos) == -1) {
      operation(cm, setSelection)(cm.doc, simpleSelection(pos), sel_dontScroll);
    }

    var oldCSS = te.style.cssText,
        oldWrapperCSS = input.wrapper.style.cssText;
    var wrapperBox = input.wrapper.offsetParent.getBoundingClientRect();
    input.wrapper.style.cssText = "position: static";
    te.style.cssText = "position: absolute; width: 30px; height: 30px;\n      top: " + (e.clientY - wrapperBox.top - 5) + "px; left: " + (e.clientX - wrapperBox.left - 5) + "px;\n      z-index: 1000; background: " + (ie ? "rgba(255, 255, 255, .05)" : "transparent") + ";\n      outline: none; border-width: 0; outline: none; overflow: hidden; opacity: .05; filter: alpha(opacity=5);";
    var oldScrollY;

    if (webkit) {
      oldScrollY = window.scrollY;
    } // Work around Chrome issue (#2712)


    display.input.focus();

    if (webkit) {
      window.scrollTo(null, oldScrollY);
    }

    display.input.reset(); // Adds "Select all" to context menu in FF

    if (!cm.somethingSelected()) {
      te.value = input.prevInput = " ";
    }

    input.contextMenuPending = rehide;
    display.selForContextMenu = cm.doc.sel;
    clearTimeout(display.detectingSelectAll); // Select-all will be greyed out if there's nothing to select, so
    // this adds a zero-width space so that we can later check whether
    // it got selected.

    function prepareSelectAllHack() {
      if (te.selectionStart != null) {
        var selected = cm.somethingSelected();
        var extval = "\u200B" + (selected ? te.value : "");
        te.value = "\u21DA"; // Used to catch context-menu undo

        te.value = extval;
        input.prevInput = selected ? "" : "\u200B";
        te.selectionStart = 1;
        te.selectionEnd = extval.length; // Re-set this, in case some other handler touched the
        // selection in the meantime.

        display.selForContextMenu = cm.doc.sel;
      }
    }

    function rehide() {
      if (input.contextMenuPending != rehide) {
        return;
      }

      input.contextMenuPending = false;
      input.wrapper.style.cssText = oldWrapperCSS;
      te.style.cssText = oldCSS;

      if (ie && ie_version < 9) {
        display.scrollbars.setScrollTop(display.scroller.scrollTop = scrollPos);
      } // Try to detect the user choosing select-all


      if (te.selectionStart != null) {
        if (!ie || ie && ie_version < 9) {
          prepareSelectAllHack();
        }

        var i = 0,
            poll = function poll() {
          if (display.selForContextMenu == cm.doc.sel && te.selectionStart == 0 && te.selectionEnd > 0 && input.prevInput == "\u200B") {
            operation(cm, selectAll)(cm);
          } else if (i++ < 10) {
            display.detectingSelectAll = setTimeout(poll, 500);
          } else {
            display.selForContextMenu = null;
            display.input.reset();
          }
        };

        display.detectingSelectAll = setTimeout(poll, 200);
      }
    }

    if (ie && ie_version >= 9) {
      prepareSelectAllHack();
    }

    if (captureRightClick) {
      e_stop(e);

      var mouseup = function mouseup() {
        off(window, "mouseup", mouseup);
        setTimeout(rehide, 20);
      };

      on(window, "mouseup", mouseup);
    } else {
      setTimeout(rehide, 50);
    }
  };

  TextareaInput.prototype.readOnlyChanged = function (val) {
    if (!val) {
      this.reset();
    }

    this.textarea.disabled = val == "nocursor";
  };

  TextareaInput.prototype.setUneditable = function () {};

  TextareaInput.prototype.needsContentAttribute = false;

  function fromTextArea(textarea, options) {
    options = options ? copyObj(options) : {};
    options.value = textarea.value;

    if (!options.tabindex && textarea.tabIndex) {
      options.tabindex = textarea.tabIndex;
    }

    if (!options.placeholder && textarea.placeholder) {
      options.placeholder = textarea.placeholder;
    } // Set autofocus to true if this textarea is focused, or if it has
    // autofocus and no other element is focused.


    if (options.autofocus == null) {
      var hasFocus = activeElt();
      options.autofocus = hasFocus == textarea || textarea.getAttribute("autofocus") != null && hasFocus == document.body;
    }

    function save() {
      textarea.value = cm.getValue();
    }

    var realSubmit;

    if (textarea.form) {
      on(textarea.form, "submit", save); // Deplorable hack to make the submit method do the right thing.

      if (!options.leaveSubmitMethodAlone) {
        var form = textarea.form;
        realSubmit = form.submit;

        try {
          var wrappedSubmit = form.submit = function () {
            save();
            form.submit = realSubmit;
            form.submit();
            form.submit = wrappedSubmit;
          };
        } catch (e) {}
      }
    }

    options.finishInit = function (cm) {
      cm.save = save;

      cm.getTextArea = function () {
        return textarea;
      };

      cm.toTextArea = function () {
        cm.toTextArea = isNaN; // Prevent this from being ran twice

        save();
        textarea.parentNode.removeChild(cm.getWrapperElement());
        textarea.style.display = "";

        if (textarea.form) {
          off(textarea.form, "submit", save);

          if (!options.leaveSubmitMethodAlone && typeof textarea.form.submit == "function") {
            textarea.form.submit = realSubmit;
          }
        }
      };
    };

    textarea.style.display = "none";
    var cm = CodeMirror(function (node) {
      return textarea.parentNode.insertBefore(node, textarea.nextSibling);
    }, options);
    return cm;
  }

  function addLegacyProps(CodeMirror) {
    CodeMirror.off = off;
    CodeMirror.on = on;
    CodeMirror.wheelEventPixels = wheelEventPixels;
    CodeMirror.Doc = Doc;
    CodeMirror.splitLines = splitLinesAuto;
    CodeMirror.countColumn = countColumn;
    CodeMirror.findColumn = findColumn;
    CodeMirror.isWordChar = isWordCharBasic;
    CodeMirror.Pass = Pass;
    CodeMirror.signal = signal;
    CodeMirror.Line = Line;
    CodeMirror.changeEnd = changeEnd;
    CodeMirror.scrollbarModel = scrollbarModel;
    CodeMirror.Pos = Pos;
    CodeMirror.cmpPos = cmp;
    CodeMirror.modes = modes;
    CodeMirror.mimeModes = mimeModes;
    CodeMirror.resolveMode = resolveMode;
    CodeMirror.getMode = getMode;
    CodeMirror.modeExtensions = modeExtensions;
    CodeMirror.extendMode = extendMode;
    CodeMirror.copyState = copyState;
    CodeMirror.startState = startState;
    CodeMirror.innerMode = innerMode;
    CodeMirror.commands = commands;
    CodeMirror.keyMap = keyMap;
    CodeMirror.keyName = keyName;
    CodeMirror.isModifierKey = isModifierKey;
    CodeMirror.lookupKey = lookupKey;
    CodeMirror.normalizeKeyMap = normalizeKeyMap;
    CodeMirror.StringStream = StringStream;
    CodeMirror.SharedTextMarker = SharedTextMarker;
    CodeMirror.TextMarker = TextMarker;
    CodeMirror.LineWidget = LineWidget;
    CodeMirror.e_preventDefault = e_preventDefault;
    CodeMirror.e_stopPropagation = e_stopPropagation;
    CodeMirror.e_stop = e_stop;
    CodeMirror.addClass = addClass;
    CodeMirror.contains = contains;
    CodeMirror.rmClass = rmClass;
    CodeMirror.keyNames = keyNames;
  } // EDITOR CONSTRUCTOR


  defineOptions(CodeMirror);
  addEditorMethods(CodeMirror); // Set up methods on CodeMirror's prototype to redirect to the editor's document.

  var dontDelegate = "iter insert remove copy getEditor constructor".split(" ");

  for (var prop in Doc.prototype) {
    if (Doc.prototype.hasOwnProperty(prop) && indexOf(dontDelegate, prop) < 0) {
      CodeMirror.prototype[prop] = function (method) {
        return function () {
          return method.apply(this.doc, arguments);
        };
      }(Doc.prototype[prop]);
    }
  }

  eventMixin(Doc);
  CodeMirror.inputStyles = {
    "textarea": TextareaInput,
    "contenteditable": ContentEditableInput
  }; // Extra arguments are stored as the mode's dependencies, which is
  // used by (legacy) mechanisms like loadmode.js to automatically
  // load a mode. (Preferred mechanism is the require/define calls.)

  CodeMirror.defineMode = function (name
  /*, mode, …*/
  ) {
    if (!CodeMirror.defaults.mode && name != "null") {
      CodeMirror.defaults.mode = name;
    }

    defineMode.apply(this, arguments);
  };

  CodeMirror.defineMIME = defineMIME; // Minimal default mode.

  CodeMirror.defineMode("null", function () {
    return {
      token: function token(stream) {
        return stream.skipToEnd();
      }
    };
  });
  CodeMirror.defineMIME("text/plain", "null"); // EXTENSIONS

  CodeMirror.defineExtension = function (name, func) {
    CodeMirror.prototype[name] = func;
  };

  CodeMirror.defineDocExtension = function (name, func) {
    Doc.prototype[name] = func;
  };

  CodeMirror.fromTextArea = fromTextArea;
  addLegacyProps(CodeMirror);
  CodeMirror.version = "5.50.2";
  return CodeMirror;
});

},{}],2:[function(_dereq_,module,exports){
"use strict";

var CodeMirror = _dereq_('./assets/codemirror');

var keyPress = _dereq_('./src'); // require('./assets/somehowscript')(CodeMirror)


var editor = CodeMirror.fromTextArea(document.getElementById('text'), {
  viewportMargin: Infinity,
  mode: 'fancy',
  height: 'auto',
  width: 'auto',
  lineNumbers: false,
  theme: 'material',
  autofocus: true
});
var patterns = document.querySelector('#patterns').innerHTML;
console.log(patterns);
patterns = JSON.parse(patterns);
keyPress(editor, patterns); //run highlighting on init

CodeMirror.signal(editor, 'change', editor);

},{"./assets/codemirror":1,"./src":4}],3:[function(_dereq_,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.nlp = factory());
}(this, (function () { 'use strict';

  function _typeof(obj) {
    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    if (superClass) _setPrototypeOf(subClass, superClass);
  }

  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
      return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf(o);
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

    return _setPrototypeOf(o, p);
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  function _possibleConstructorReturn(self, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    }

    return _assertThisInitialized(self);
  }

  //this is a not-well-thought-out way to reduce our dependence on `object===object` stuff
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split(''); //generates a unique id for this term

  function makeId(str) {
    str = str || '_';
    var text = str + '-';

    for (var i = 0; i < 7; i++) {
      text += chars[Math.floor(Math.random() * chars.length)];
    }

    return text;
  }

  var _id = makeId;

  //a hugely-ignorant, and widely subjective transliteration of latin, cryllic, greek unicode characters to english ascii.
  //approximate visual (not semantic or phonetic) relationship between unicode and ascii characters
  //http://en.wikipedia.org/wiki/List_of_Unicode_characters
  //https://docs.google.com/spreadsheet/ccc?key=0Ah46z755j7cVdFRDM1A2YVpwa1ZYWlpJM2pQZ003M0E
  var compact = {
    '!': '¡',
    '?': '¿Ɂ',
    '"': '“”"❝❞',
    "'": '‘‛❛❜',
    '-': '—–',
    a: 'ªÀÁÂÃÄÅàáâãäåĀāĂăĄąǍǎǞǟǠǡǺǻȀȁȂȃȦȧȺΆΑΔΛάαλАадѦѧӐӑӒӓƛɅæ',
    b: 'ßþƀƁƂƃƄƅɃΒβϐϦБВЪЬвъьѢѣҌҍ',
    c: '¢©ÇçĆćĈĉĊċČčƆƇƈȻȼͻͼͽϲϹϽϾСсєҀҁҪҫ',
    d: 'ÐĎďĐđƉƊȡƋƌǷ',
    e: 'ÈÉÊËèéêëĒēĔĕĖėĘęĚěƎƏƐǝȄȅȆȇȨȩɆɇΈΕΞΣέεξϱϵ϶ЀЁЕЭеѐёҼҽҾҿӖӗӘәӚӛӬӭ',
    f: 'ƑƒϜϝӺӻҒғſ',
    g: 'ĜĝĞğĠġĢģƓǤǥǦǧǴǵ',
    h: 'ĤĥĦħƕǶȞȟΉΗЂЊЋНнђћҢңҤҥҺһӉӊ',
    I: 'ÌÍÎÏ',
    i: 'ìíîïĨĩĪīĬĭĮįİıƖƗȈȉȊȋΊΐΪίιϊІЇії',
    j: 'ĴĵǰȷɈɉϳЈј',
    k: 'ĶķĸƘƙǨǩΚκЌЖКжкќҚқҜҝҞҟҠҡ',
    l: 'ĹĺĻļĽľĿŀŁłƚƪǀǏǐȴȽΙӀӏ',
    m: 'ΜϺϻМмӍӎ',
    n: 'ÑñŃńŅņŇňŉŊŋƝƞǸǹȠȵΝΠήηϞЍИЙЛПийлпѝҊҋӅӆӢӣӤӥπ',
    o: 'ÒÓÔÕÖØðòóôõöøŌōŎŏŐőƟƠơǑǒǪǫǬǭǾǿȌȍȎȏȪȫȬȭȮȯȰȱΌΘΟθοσόϕϘϙϬϭϴОФоѲѳӦӧӨөӪӫ',
    p: 'ƤƿΡρϷϸϼРрҎҏÞ',
    q: 'Ɋɋ',
    r: 'ŔŕŖŗŘřƦȐȑȒȓɌɍЃГЯгяѓҐґ',
    s: 'ŚśŜŝŞşŠšƧƨȘșȿЅѕ',
    t: 'ŢţŤťŦŧƫƬƭƮȚțȶȾΓΤτϮТт',
    u: 'µÙÚÛÜùúûüŨũŪūŬŭŮůŰűŲųƯưƱƲǓǔǕǖǗǘǙǚǛǜȔȕȖȗɄΰμυϋύ',
    v: 'νѴѵѶѷ',
    w: 'ŴŵƜωώϖϢϣШЩшщѡѿ',
    x: '×ΧχϗϰХхҲҳӼӽӾӿ',
    y: 'ÝýÿŶŷŸƳƴȲȳɎɏΎΥΫγψϒϓϔЎУучўѰѱҮүҰұӮӯӰӱӲӳ',
    z: 'ŹźŻżŽžƩƵƶȤȥɀΖζ'
  }; //decompress data into two hashes

  var unicode = {};
  Object.keys(compact).forEach(function (k) {
    compact[k].split('').forEach(function (s) {
      unicode[s] = k;
    });
  });

  var killUnicode = function killUnicode(str) {
    var chars = str.split('');
    chars.forEach(function (s, i) {
      if (unicode[s]) {
        chars[i] = unicode[s];
      }
    });
    return chars.join('');
  };

  var unicode_1 = killUnicode; // console.log(killUnicode('bjŏȒk—Ɏó'));

  var periodAcronym = /([A-Z]\.)+[A-Z]?,?$/;
  var oneLetterAcronym = /^[A-Z]\.,?$/;
  var noPeriodAcronym = /[A-Z]{2,}('s|,)?$/;
  var lowerCaseAcronym = /([a-z]\.){2,}[a-z]\.?$/;

  var isAcronym = function isAcronym(str) {
    //like N.D.A
    if (periodAcronym.test(str) === true) {
      return true;
    } //like c.e.o


    if (lowerCaseAcronym.test(str) === true) {
      return true;
    } //like 'F.'


    if (oneLetterAcronym.test(str) === true) {
      return true;
    } //like NDA


    if (noPeriodAcronym.test(str) === true) {
      return true;
    }

    return false;
  };

  var isAcronym_1 = isAcronym;

  var hasSlash = /[a-z\u00C0-\u00FF] ?\/ ?[a-z\u00C0-\u00FF]/;
  /** some basic operations on a string to reduce noise */

  var clean = function clean(str) {
    str = str || '';
    str = str.toLowerCase();
    str = str.trim();
    var original = str; //(very) rough ASCII transliteration -  bjŏrk -> bjork

    str = unicode_1(str); //rough handling of slashes - 'see/saw'

    if (hasSlash.test(str) === true) {
      str = str.replace(/\/.*/, '');
    } //#tags, @mentions


    str = str.replace(/^[#@]/, ''); //punctuation

    str = str.replace(/[,;.!?]+$/, ''); // coerce single curly quotes

    str = str.replace(/[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]+/g, "'"); // coerce double curly quotes

    str = str.replace(/[\u0022\u00AB\u00BB\u201C\u201D\u201E\u201F\u2033\u2034\u2036\u2037\u2E42\u301D\u301E\u301F\uFF02]+/g, '"'); //coerce Unicode ellipses

    str = str.replace(/\u2026/g, '...'); //en-dash

    str = str.replace(/\u2013/g, '-'); //lookin'->looking (make it easier for conjugation)

    str = str.replace(/([aeiou][ktrp])in$/, '$1ing'); //turn re-enactment to reenactment

    if (/^(re|un)-?[^aeiou]./.test(str) === true) {
      str = str.replace('-', '');
    } //strip leading & trailing grammatical punctuation


    if (/^[:;]/.test(str) === false) {
      str = str.replace(/\.{3,}$/g, '');
      str = str.replace(/[",\.!:;\?\)]+$/g, '');
      str = str.replace(/^['"\(]+/g, '');
    } //do this again..


    str = str.trim(); //oh shucks,

    if (str === '') {
      str = original;
    } //compact acronyms


    if (isAcronym_1(str)) {
      str = str.replace(/\./g, '');
    } //nice-numbers


    str = str.replace(/([0-9]),([0-9])/g, '$1$2');
    return str;
  };

  var clean_1 = clean; // console.log(normalize('Dr. V Cooper'));

  /** reduced is one step further than clean */
  var reduced = function reduced(str) {
    // remove apostrophes
    str = str.replace(/['’]s$/, '');
    str = str.replace(/s['’]$/, 's');
    return str;
  };

  var reduce = reduced;

  //all punctuation marks, from https://en.wikipedia.org/wiki/Punctuation
  //we have slightly different rules for start/end - like #hashtags.

  var startings = /^[ \n\t\.’'\[\](){}⟨⟩:,،、‒–—―…!.‹›«»‐\-?‘’;\/⁄·\&*\•^†‡°¡¿※№÷×ºª%‰+−=‱¶′″‴§~|‖¦©℗®℠™¤₳฿\u0022|\uFF02|\u0027|\u201C|\u2018|\u201F|\u201B|\u201E|\u2E42|\u201A|\u00AB|\u2039|\u2035|\u2036|\u2037|\u301D|\u0060|\u301F]+/;
  var endings = /[ \n\t\.’'\[\](){}⟨⟩:,،、‒–—―…!.‹›«»‐\-?‘’;\/⁄·\&*@\•^†‡°¡¿※#№÷×ºª‰+−=‱¶′″‴§~|‖¦©℗®℠™¤₳฿\u0022|\uFF02|\u0027|\u201D|\u2019|\u201D|\u2019|\u201D|\u201D|\u2019|\u00BB|\u203A|\u2032|\u2033|\u2034|\u301E|\u00B4|\u301E]+$/; //money = ₵¢₡₢$₫₯֏₠€ƒ₣₲₴₭₺₾ℳ₥₦₧₱₰£៛₽₹₨₪৳₸₮₩¥

  var hasSlash$1 = /\//;
  var hasApostrophe = /['’]/;
  var hasAcronym = /^[a-z]\.([a-z]\.)+/i;
  var minusNumber = /^[-+\.][0-9]/;
  /** turn given text into a parsed-up object
   * seperate the 'meat' of the word from the whitespace+punctuation
   */

  var parseTerm = function parseTerm(str) {
    var original = str;
    var pre = '';
    var post = '';
    str = str.replace(startings, function (found) {
      pre = found; // support '-40'

      if ((pre === '-' || pre === '+' || pre === '.') && minusNumber.test(str)) {
        pre = '';
        return found;
      }

      return '';
    });
    str = str.replace(endings, function (found) {
      post = found; // keep s-apostrophe - "flanders'" or "chillin'"

      if (hasApostrophe.test(found) && /[sn]['’]$/.test(original) && hasApostrophe.test(pre) === false) {
        post = post.replace(hasApostrophe, '');
        return "'";
      } //keep end-period in acronym


      if (hasAcronym.test(str) === true) {
        post = post.replace(/\./, '');
        return '.';
      }

      return '';
    }); //we went too far..

    if (str === '') {
      // do a very mild parse, and hope for the best.
      original = original.replace(/ *$/, function (after) {
        post = after || '';
        return '';
      });
      str = original;
      pre = '';
      post = post;
    } // create the various forms of our text,


    var clean = clean_1(str);
    var parsed = {
      text: str,
      clean: clean,
      reduced: reduce(clean),
      pre: pre,
      post: post
    }; // support aliases for slashes

    if (hasSlash$1.test(str)) {
      str.split(hasSlash$1).forEach(function (word) {
        parsed.alias = parsed.alias || {};
        parsed.alias[word.trim()] = true;
      });
    }

    return parsed;
  };

  var parse = parseTerm;

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var _01Case = createCommonjsModule(function (module, exports) {
    var titleCase = /^[A-Z][a-z'\u00C0-\u00FF]/;
    var upperCase = /^[A-Z]+s?$/;
    /** convert all text to uppercase */

    exports.toUpperCase = function () {
      this.text = this.text.toUpperCase();
      return this;
    };
    /** convert all text to lowercase */


    exports.toLowerCase = function () {
      this.text = this.text.toLowerCase();
      return this;
    };
    /** only set the first letter to uppercase
     * leave any existing uppercase alone
     */


    exports.toTitleCase = function () {
      this.text = this.text.replace(/^ *[a-z\u00C0-\u00FF]/, function (x) {
        return x.toUpperCase();
      }); //support unicode?

      return this;
    };
    /** if all letters are uppercase */


    exports.isUpperCase = function () {
      return upperCase.test(this.text);
    };
    /** if the first letter is uppercase, and the rest are lowercase */


    exports.isTitleCase = function () {
      return titleCase.test(this.text);
    };

    exports.titleCase = exports.isTitleCase;
  });
  var _01Case_1 = _01Case.toUpperCase;
  var _01Case_2 = _01Case.toLowerCase;
  var _01Case_3 = _01Case.toTitleCase;
  var _01Case_4 = _01Case.isUpperCase;
  var _01Case_5 = _01Case.isTitleCase;
  var _01Case_6 = _01Case.titleCase;

  var _02Punctuation = createCommonjsModule(function (module, exports) {
    // these methods are called with '@hasComma' in the match syntax
    // various unicode quotation-mark formats
    var startQuote = /(\u0022|\uFF02|\u0027|\u201C|\u2018|\u201F|\u201B|\u201E|\u2E42|\u201A|\u00AB|\u2039|\u2035|\u2036|\u2037|\u301D|\u0060|\u301F)/;
    var endQuote = /(\u0022|\uFF02|\u0027|\u201D|\u2019|\u201D|\u2019|\u201D|\u201D|\u2019|\u00BB|\u203A|\u2032|\u2033|\u2034|\u301E|\u00B4|\u301E)/;
    /** search the term's 'post' punctuation  */

    exports.hasPost = function (punct) {
      return this.post.indexOf(punct) !== -1;
    };
    /** search the term's 'pre' punctuation  */


    exports.hasPre = function (punct) {
      return this.pre.indexOf(punct) !== -1;
    };
    /** does it have a quotation symbol?  */


    exports.hasQuote = function () {
      return startQuote.test(this.pre) || endQuote.test(this.post);
    };

    exports.hasQuotation = exports.hasQuote;
    /** does it have a comma?  */

    exports.hasComma = function () {
      return this.hasPost(',');
    };
    /** does it end in a period? */


    exports.hasPeriod = function () {
      return this.hasPost('.') === true && this.hasPost('...') === false;
    };
    /** does it end in an exclamation */


    exports.hasExclamation = function () {
      return this.hasPost('!');
    };
    /** does it end with a question mark? */


    exports.hasQuestionMark = function () {
      return this.hasPost('?') || this.hasPost('¿');
    };
    /** is there a ... at the end? */


    exports.hasEllipses = function () {
      return this.hasPost('..') || this.hasPost('…') || this.hasPre('..') || this.hasPre('…');
    };
    /** is there a semicolon after this word? */


    exports.hasSemicolon = function () {
      return this.hasPost(';');
    };
    /** is there a slash '/' in this word? */


    exports.hasSlash = function () {
      return /\//.test(this.text);
    };
    /** a hyphen connects two words like-this */


    exports.hasHyphen = function () {
      var hyphen = /(-|–|—)/;
      return hyphen.test(this.post) || hyphen.test(this.pre);
    };
    /** a dash separates words - like that */


    exports.hasDash = function () {
      var hyphen = / (-|–|—) /;
      return hyphen.test(this.post) || hyphen.test(this.pre);
    };
    /** is it multiple words combinded */


    exports.hasContraction = function () {
      return Boolean(this.implicit);
    };
    /** try to sensibly put this punctuation mark into the term */


    exports.addPunctuation = function (punct) {
      // dont add doubles
      if (punct === ',' || punct === ';') {
        this.post = this.post.replace(punct, '');
      }

      this.post = punct + this.post;
      return this;
    };
  });
  var _02Punctuation_1 = _02Punctuation.hasPost;
  var _02Punctuation_2 = _02Punctuation.hasPre;
  var _02Punctuation_3 = _02Punctuation.hasQuote;
  var _02Punctuation_4 = _02Punctuation.hasQuotation;
  var _02Punctuation_5 = _02Punctuation.hasComma;
  var _02Punctuation_6 = _02Punctuation.hasPeriod;
  var _02Punctuation_7 = _02Punctuation.hasExclamation;
  var _02Punctuation_8 = _02Punctuation.hasQuestionMark;
  var _02Punctuation_9 = _02Punctuation.hasEllipses;
  var _02Punctuation_10 = _02Punctuation.hasSemicolon;
  var _02Punctuation_11 = _02Punctuation.hasSlash;
  var _02Punctuation_12 = _02Punctuation.hasHyphen;
  var _02Punctuation_13 = _02Punctuation.hasDash;
  var _02Punctuation_14 = _02Punctuation.hasContraction;
  var _02Punctuation_15 = _02Punctuation.addPunctuation;

  //declare it up here
  var wrapMatch = function wrapMatch() {};
  /** ignore optional/greedy logic, straight-up term match*/


  var doesMatch = function doesMatch(t, reg, index, length) {
    // support id matches
    if (reg.id === t.id) {
      return true;
    } // support '.'


    if (reg.anything === true) {
      return true;
    } // support '^' (in parentheses)


    if (reg.start === true && index !== 0) {
      return false;
    } // support '$' (in parentheses)


    if (reg.end === true && index !== length - 1) {
      return false;
    } //support a text match


    if (reg.word !== undefined) {
      //match contractions
      if (t.implicit !== null && t.implicit === reg.word) {
        return true;
      } // term aliases for slashes and things


      if (t.alias !== undefined && t.alias.hasOwnProperty(reg.word)) {
        return true;
      } // support ~ match


      if (reg.soft === true && reg.word === t.root) {
        return true;
      } //match either .clean or .text


      return reg.word === t.clean || reg.word === t.text || reg.word === t.reduced;
    } //support #Tag


    if (reg.tag !== undefined) {
      return t.tags[reg.tag] === true;
    } //support @method


    if (reg.method !== undefined) {
      if (typeof t[reg.method] === 'function' && t[reg.method]() === true) {
        return true;
      }

      return false;
    } //support /reg/


    if (reg.regex !== undefined) {
      return reg.regex.test(t.clean);
    } //support (one|two)


    if (reg.choices !== undefined) {
      // try to support && operator
      if (reg.operator === 'and') {
        // must match them all
        return reg.choices.every(function (r) {
          return wrapMatch(t, r, index, length);
        });
      } // or must match one


      return reg.choices.some(function (r) {
        return wrapMatch(t, r, index, length);
      });
    }

    return false;
  }; // wrap result for !negative match logic


  wrapMatch = function wrapMatch(t, reg, index, length) {
    var result = doesMatch(t, reg, index, length);

    if (reg.negative === true) {
      return !result;
    }

    return result;
  };

  var _doesMatch = wrapMatch;

  var boring = {};
  /** check a match object against this term */

  var doesMatch_1 = function doesMatch_1(reg, index, length) {
    return _doesMatch(this, reg, index, length);
  };
  /** does this term look like an acronym? */


  var isAcronym_1$1 = function isAcronym_1$1() {
    return isAcronym_1(this.text);
  };
  /** is this term implied by a contraction? */


  var isImplicit = function isImplicit() {
    return this.text === '' && Boolean(this.implicit);
  };
  /** does the term have at least one good tag? */


  var isKnown = function isKnown() {
    return Object.keys(this.tags).some(function (t) {
      return boring[t] !== true;
    });
  };
  /** cache the root property of the term */


  var setRoot = function setRoot(world) {
    var transform = world.transforms;
    var str = this.implicit || this.clean;

    if (this.tags.Plural) {
      str = transform.toSingular(str, world);
    }

    if (this.tags.Verb && !this.tags.Negative && !this.tags.Infinitive) {
      var tense = null;

      if (this.tags.PastTense) {
        tense = 'PastTense';
      } else if (this.tags.Gerund) {
        tense = 'Gerund';
      } else if (this.tags.PresentTense) {
        tense = 'PresentTense';
      } else if (this.tags.Participle) {
        tense = 'Participle';
      } else if (this.tags.Actor) {
        tense = 'Actor';
      }

      str = transform.toInfinitive(str, world, tense);
    }

    this.root = str;
  };

  var _03Misc = {
    doesMatch: doesMatch_1,
    isAcronym: isAcronym_1$1,
    isImplicit: isImplicit,
    isKnown: isKnown,
    setRoot: setRoot
  };

  var hasSpace = /[\s-]/;
  var isUpperCase = /^[A-Z-]+$/; // const titleCase = str => {
  //   return str.charAt(0).toUpperCase() + str.substr(1)
  // }

  /** return various text formats of this term */

  var textOut = function textOut(options, showPre, showPost) {
    options = options || {};
    var word = this.text;
    var before = this.pre;
    var after = this.post; // -word-

    if (options.reduced === true) {
      word = this.reduced || '';
    }

    if (options.root === true) {
      word = this.root || '';
    }

    if (options.implicit === true && this.implicit) {
      word = this.implicit || '';
    }

    if (options.normal === true) {
      word = this.clean || this.text || '';
    }

    if (options.root === true) {
      word = this.root || this.reduced || '';
    }

    if (options.unicode === true) {
      word = unicode_1(word);
    } // cleanup case


    if (options.titlecase === true) {
      if (this.tags.ProperNoun && !this.titleCase()) ; else if (this.tags.Acronym) {
        word = word.toUpperCase(); //uppercase acronyms
      } else if (isUpperCase.test(word) && !this.tags.Acronym) {
        // lowercase everything else
        word = word.toLowerCase();
      }
    }

    if (options.lowercase === true) {
      word = word.toLowerCase();
    } // remove the '.'s from 'F.B.I.' (safely)


    if (options.acronyms === true && this.tags.Acronym) {
      word = word.replace(/\./g, '');
    } // -before/after-


    if (options.whitespace === true || options.root === true) {
      before = '';
      after = ' ';

      if ((hasSpace.test(this.post) === false || options.last) && !this.implicit) {
        after = '';
      }
    }

    if (options.punctuation === true && !options.root) {
      //normalized end punctuation
      if (this.hasPost('.') === true) {
        after = '.' + after;
      } else if (this.hasPost('?') === true) {
        after = '?' + after;
      } else if (this.hasPost('!') === true) {
        after = '!' + after;
      } else if (this.hasPost(',') === true) {
        after = ',' + after;
      } else if (this.hasEllipses() === true) {
        after = '...' + after;
      }
    }

    if (showPre !== true) {
      before = '';
    }

    if (showPost !== true) {
      // let keep = after.match(/\)/) || ''
      after = ''; //keep //after.replace(/[ .?!,]+/, '')
    } // remove the '.' from 'Mrs.' (safely)


    if (options.abbreviations === true && this.tags.Abbreviation) {
      after = after.replace(/^\./, '');
    }

    return before + word + after;
  };

  var _04Text = {
    textOut: textOut
  };

  var boringTags = {
    Auxiliary: 1,
    Possessive: 1
  };
  /** a subjective ranking of tags kinda tfidf-based */

  var rankTags = function rankTags(term, world) {
    var tags = Object.keys(term.tags);
    var tagSet = world.tags;
    tags = tags.sort(function (a, b) {
      //bury the tags we dont want
      if (boringTags[b] || !tagSet[b]) {
        return -1;
      } // unknown tags are interesting


      if (!tagSet[b]) {
        return 1;
      }

      if (!tagSet[a]) {
        return 0;
      } // then sort by #of parent tags (most-specific tags first)


      if (tagSet[a].lineage.length > tagSet[b].lineage.length) {
        return 1;
      }

      if (tagSet[a].isA.length > tagSet[b].isA.length) {
        return -1;
      }

      return 0;
    });
    return tags;
  };

  var _bestTag = rankTags;

  var jsonDefault = {
    text: true,
    tags: true,
    implicit: true,
    clean: false,
    id: false,
    index: false,
    offset: false,
    whitespace: false,
    bestTag: false
  };
  /** return various metadata for this term */

  var json = function json(options, world) {
    options = options || {};
    options = Object.assign({}, jsonDefault, options);
    var result = {}; // default on

    if (options.text) {
      result.text = this.text;
    }

    if (options.normal) {
      result.normal = this.normal;
    }

    if (options.tags) {
      result.tags = Object.keys(this.tags);
    } // default off


    if (options.clean) {
      result.clean = this.clean;
    }

    if (options.id || options.offset) {
      result.id = this.id;
    }

    if (options.implicit && this.implicit !== null) {
      result.implicit = this.implicit;
    }

    if (options.whitespace) {
      result.pre = this.pre;
      result.post = this.post;
    }

    if (options.bestTag) {
      result.bestTag = _bestTag(this, world)[0];
    }

    return result;
  };

  var _05Json = {
    json: json
  };

  var methods = Object.assign({}, _01Case, _02Punctuation, _03Misc, _04Text, _05Json);

  function isClientSide() {
    return typeof window !== 'undefined' && window.document;
  }
  /** add spaces at the end */


  var padEnd = function padEnd(str, width) {
    str = str.toString();

    while (str.length < width) {
      str += ' ';
    }

    return str;
  };
  /** output for verbose-mode */


  var logTag = function logTag(t, tag, reason) {
    if (isClientSide()) {
      console.log('%c' + padEnd(t.clean, 3) + '  + ' + tag + ' ', 'color: #6accb2;');
      return;
    } //server-side


    var log = '\x1b[33m' + padEnd(t.clean, 15) + '\x1b[0m + \x1b[32m' + tag + '\x1b[0m ';

    if (reason) {
      log = padEnd(log, 35) + ' ' + reason + '';
    }

    console.log(log);
  };
  /** output for verbose mode  */


  var logUntag = function logUntag(t, tag, reason) {
    if (isClientSide()) {
      console.log('%c' + padEnd(t.clean, 3) + '  - ' + tag + ' ', 'color: #AB5850;');
      return;
    } //server-side


    var log = '\x1b[33m' + padEnd(t.clean, 3) + ' \x1b[31m - #' + tag + '\x1b[0m ';

    if (reason) {
      log = padEnd(log, 35) + ' ' + reason;
    }

    console.log(log);
  };

  var isArray = function isArray(arr) {
    return Object.prototype.toString.call(arr) === '[object Array]';
  };

  var titleCase = function titleCase(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
  };

  var fns = {
    logTag: logTag,
    logUntag: logUntag,
    isArray: isArray,
    titleCase: titleCase
  };

  /** add a tag, and its descendents, to a term */

  var addTag = function addTag(t, tag, reason, world) {
    var tagset = world.tags; //support '.' or '-' notation for skipping the tag

    if (tag === '' || tag === '.' || tag === '-') {
      return;
    }

    if (tag[0] === '#') {
      tag = tag.replace(/^#/, '');
    }

    tag = fns.titleCase(tag); //if we already got this one

    if (t.tags[tag] === true) {
      return;
    } // log it?


    var isVerbose = world.isVerbose();

    if (isVerbose === true) {
      fns.logTag(t, tag, reason);
    } //add tag


    t.tags[tag] = true; //whee!
    //check tagset for any additional things to do...

    if (tagset.hasOwnProperty(tag) === true) {
      //add parent Tags
      tagset[tag].isA.forEach(function (down) {
        t.tags[down] = true;

        if (isVerbose === true) {
          fns.logTag(t, '→ ' + down);
        }
      }); //remove any contrary tags

      t.unTag(tagset[tag].notA, '←', world);
    }
  };
  /** support an array of tags */


  var addTags = function addTags(term, tags, reason, world) {
    if (typeof tags !== 'string') {
      for (var i = 0; i < tags.length; i++) {
        addTag(term, tags[i], reason, world);
      } // tags.forEach(tag => addTag(term, tag, reason, world))

    } else {
      addTag(term, tags, reason, world);
    }
  };

  var add = addTags;

  /** remove this tag, and its descentents from the term */

  var unTag = function unTag(t, tag, reason, world) {
    var isVerbose = world.isVerbose(); //support '*' for removing all tags

    if (tag === '*') {
      t.tags = {};
      return t;
    } // remove the tag


    if (t.tags[tag] === true) {
      delete t.tags[tag]; //log in verbose-mode

      if (isVerbose === true) {
        fns.logUntag(t, tag, reason);
      }
    } //delete downstream tags too


    var tagset = world.tags;

    if (tagset[tag]) {
      var lineage = tagset[tag].lineage;

      for (var i = 0; i < lineage.length; i++) {
        if (t.tags[lineage[i]] === true) {
          delete t.tags[lineage[i]];

          if (isVerbose === true) {
            fns.logUntag(t, ' - ' + lineage[i]);
          }
        }
      }
    }

    return t;
  }; //handle an array of tags


  var untagAll = function untagAll(term, tags, reason, world) {
    if (typeof tags !== 'string' && tags) {
      for (var i = 0; i < tags.length; i++) {
        unTag(term, tags[i], reason, world);
      }

      return;
    }

    unTag(term, tags, reason, world);
  };

  var unTag_1 = untagAll;

  var canBe = function canBe(term, tag, world) {
    var tagset = world.tags; // cleanup tag

    if (tag[0] === '#') {
      tag = tag.replace(/^#/, '');
    } //fail-fast


    if (tagset[tag] === undefined) {
      return true;
    } //loop through tag's contradictory tags


    var enemies = tagset[tag].notA || [];

    for (var i = 0; i < enemies.length; i++) {
      if (term.tags[enemies[i]] === true) {
        return false;
      }
    }

    if (tagset[tag].isA !== undefined) {
      return canBe(term, tagset[tag].isA, world); //recursive
    }

    return true;
  };

  var canBe_1 = canBe;

  /** add a tag or tags, and their descendents to this term
   * @param  {string | string[]} tags - a tag or tags
   * @param {string?} [reason] a clue for debugging
   */

  var tag_1 = function tag_1(tags, reason, world) {
    add(this, tags, reason, world);
    return this;
  };
  /** only tag this term if it's consistent with it's current tags */


  var tagSafe = function tagSafe(tags, reason, world) {
    if (canBe_1(this, tags, world)) {
      add(this, tags, reason, world);
    }

    return this;
  };
  /** remove a tag or tags, and their descendents from this term
   * @param {string | string[]} tags  - a tag or tags
   * @param {string?} [reason] a clue for debugging
   */


  var unTag_1$1 = function unTag_1$1(tags, reason, world) {
    unTag_1(this, tags, reason, world);
    return this;
  };
  /** is this tag consistent with the word's current tags?
   * @param {string | string[]} tags - a tag or tags
   * @returns {boolean}
   */


  var canBe_1$1 = function canBe_1$1(tags, world) {
    return canBe_1(this, tags, world);
  };

  var tag = {
    tag: tag_1,
    tagSafe: tagSafe,
    unTag: unTag_1$1,
    canBe: canBe_1$1
  };

  var Term =
  /*#__PURE__*/
  function () {
    function Term() {
      var text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

      _classCallCheck(this, Term);

      text = String(text);
      var obj = parse(text); // the various forms of our text

      this.text = obj.text || '';
      this.clean = obj.clean;
      this.reduced = obj.reduced;
      this.root =  null;
      this.implicit =  null;
      this.pre = obj.pre || '';
      this.post = obj.post || '';
      this.tags = {};
      this.prev = null;
      this.next = null;
      this.id = _id(obj.clean);
      this.isA = 'Term'; // easier than .constructor...
      // support alternative matches

      if (obj.alias) {
        this.alias = obj.alias;
      }
    }
    /** set the text of the Term to something else*/


    _createClass(Term, [{
      key: "set",
      value: function set(str) {
        var obj = parse(str);
        this.text = obj.text;
        this.clean = obj.clean;
        return this;
      }
    }]);

    return Term;
  }();
  /** create a deep-copy of this term */


  Term.prototype.clone = function () {
    var term = new Term(this.text);
    term.pre = this.pre;
    term.post = this.post;
    term.tags = Object.assign({}, this.tags); //use the old id, so it can be matched with .match(doc)
    // term.id = this.id

    return term;
  };

  Object.assign(Term.prototype, methods);
  Object.assign(Term.prototype, tag);
  var Term_1 = Term;

  /** return a flat array of Term objects */
  var terms = function terms(n) {
    if (this.length === 0) {
      return [];
    } // use cache, if it exists


    if (this.cache.terms) {
      if (n !== undefined) {
        return this.cache.terms[n];
      }

      return this.cache.terms;
    }

    var terms = [this.pool.get(this.start)];

    for (var i = 0; i < this.length - 1; i += 1) {
      var id = terms[terms.length - 1].next;

      if (id === null) {
        // throw new Error('linked-list broken')
        console.error("Compromise error: Linked list broken in phrase '" + this.start + "'");
        break;
      }

      var term = this.pool.get(id);
      terms.push(term); //return this one?

      if (n !== undefined && n === i) {
        return terms[n];
      }
    } // this.cache.terms = terms


    if (n !== undefined) {
      return terms[n];
    }

    return terms;
  };
  /** return a shallow or deep copy of this phrase  */


  var clone = function clone(isShallow) {
    var _this = this;

    if (isShallow) {
      return this.buildFrom(this.start, this.length);
    } //how do we clone part of the pool?


    var terms = this.terms();
    var newTerms = terms.map(function (t) {
      return t.clone();
    }); //connect these new ids up

    newTerms.forEach(function (t, i) {
      //add it to the pool..
      _this.pool.add(t);

      if (newTerms[i + 1]) {
        t.next = newTerms[i + 1].id;
      }

      if (newTerms[i - 1]) {
        t.prev = newTerms[i - 1].id;
      }
    });
    return this.buildFrom(newTerms[0].id, newTerms.length);
  };
  /** return last term object */


  var lastTerm = function lastTerm() {
    var terms = this.terms();
    return terms[terms.length - 1];
  };
  /** quick lookup for a term id */


  var hasId = function hasId(wantId) {
    if (this.length === 0 || !wantId) {
      return false;
    }

    if (this.start === wantId) {
      return true;
    } // use cache, if available


    if (this.cache.terms) {
      var _terms = this.cache.terms;

      for (var i = 0; i < _terms.length; i++) {
        if (_terms[i].id === wantId) {
          return true;
        }
      }

      return false;
    } // otherwise, go through each term


    var lastId = this.start;

    for (var _i = 0; _i < this.length - 1; _i += 1) {
      var term = this.pool.get(lastId);

      if (term === undefined) {
        console.error("Compromise error: Linked list broken. Missing term '".concat(lastId, "' in phrase '").concat(this.start, "'\n")); // throw new Error('linked List error')

        return false;
      }

      if (term.next === wantId) {
        return true;
      }

      lastId = term.next;
    }

    return false;
  };
  /** how many seperate, non-empty words is it? */


  var wordCount = function wordCount() {
    return this.terms().filter(function (t) {
      return t.text !== '';
    }).length;
  };

  var _01Utils = {
    terms: terms,
    clone: clone,
    lastTerm: lastTerm,
    hasId: hasId,
    wordCount: wordCount
  };

  var trimEnd = function trimEnd(str) {
    return str.replace(/ +$/, '');
  };
  /** produce output in the given format */


  var text = function text() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var isFirst = arguments.length > 1 ? arguments[1] : undefined;
    var isLast = arguments.length > 2 ? arguments[2] : undefined;

    if (typeof options === 'string') {
      if (options === 'normal') {
        options = {
          whitespace: true,
          unicode: true,
          lowercase: true,
          punctuation: true,
          acronyms: true,
          abbreviations: true,
          implicit: true,
          normal: true
        };
      } else if (options === 'clean') {
        options = {
          titlecase: false,
          lowercase: true,
          punctuation: true,
          whitespace: true,
          unicode: true,
          implicit: true
        };
      } else if (options === 'reduced') {
        options = {
          titlecase: false,
          lowercase: true,
          punctuation: false,
          //FIXME: reversed?
          whitespace: true,
          unicode: true,
          implicit: true,
          reduced: true
        };
      } else if (options === 'root') {
        options = {
          titlecase: false,
          lowercase: true,
          punctuation: true,
          whitespace: true,
          unicode: true,
          implicit: true,
          root: true
        };
      } else {
        options = {};
      }
    }

    var terms = this.terms(); //this this phrase a complete sentence?

    var isFull = false;

    if (terms[0] && terms[0].prev === null && terms[terms.length - 1].next === null) {
      isFull = true;
    }

    var text = terms.reduce(function (str, t, i) {
      options.last = isLast && i === terms.length - 1;
      var showPre = true;
      var showPost = true;

      if (isFull === false) {
        // dont show beginning whitespace
        if (i === 0 && isFirst) {
          showPre = false;
        } // dont show end-whitespace


        if (i === terms.length - 1 && isLast) {
          showPost = false;
        }
      }

      var txt = t.textOut(options, showPre, showPost); // if (options.titlecase && i === 0) {
      // txt = titleCase(txt)
      // }

      return str + txt;
    }, ''); //full-phrases show punctuation, but not whitespace

    if (isFull === true && isLast) {
      text = trimEnd(text);
    }

    if (options.trim === true) {
      text = text.trim();
    }

    return text;
  };

  var _02Text = {
    text: text
  };

  /** remove start and end whitespace */
  var trim = function trim() {
    var terms = this.terms();

    if (terms.length > 0) {
      //trim starting
      terms[0].pre = terms[0].pre.replace(/^\s+/, ''); //trim ending

      var lastTerm = terms[terms.length - 1];
      lastTerm.post = lastTerm.post.replace(/\s+$/, '');
    }

    return this;
  };

  var _03Change = {
    trim: trim
  };

  var endOfSentence = /[.?!]\s*$/; // replacing a 'word.' with a 'word!'

  var combinePost = function combinePost(before, after) {
    //only transfer the whitespace
    if (endOfSentence.test(after)) {
      var whitespace = before.match(/\s*$/);
      return after + whitespace;
    }

    return before;
  }; //add whitespace to the start of the second bit


  var addWhitespace = function addWhitespace(beforeTerms, newTerms) {
    // add any existing pre-whitespace to beginning
    newTerms[0].pre = beforeTerms[0].pre;
    var lastTerm = beforeTerms[beforeTerms.length - 1]; //add any existing punctuation to end of our new terms

    var newTerm = newTerms[newTerms.length - 1];
    newTerm.post = combinePost(lastTerm.post, newTerm.post); // remove existing punctuation

    lastTerm.post = ''; //before ←[space]  - after

    if (lastTerm.post === '') {
      lastTerm.post += ' ';
    }
  }; //insert this segment into the linked-list


  var stitchIn = function stitchIn(beforeTerms, newTerms, pool) {
    var lastBefore = beforeTerms[beforeTerms.length - 1];
    var lastNew = newTerms[newTerms.length - 1];
    var afterId = lastBefore.next; //connect ours in (main → newPhrase)

    lastBefore.next = newTerms[0].id; //stich the end in  (newPhrase → after)

    lastNew.next = afterId; //do it backwards, too

    if (afterId) {
      // newPhrase ← after
      var afterTerm = pool.get(afterId);
      afterTerm.prev = lastNew.id;
    } // before ← newPhrase


    var beforeId = beforeTerms[0].id;

    if (beforeId) {
      var newTerm = newTerms[0];
      newTerm.prev = beforeId;
    }
  }; // avoid stretching a phrase twice.


  var unique = function unique(list) {
    return list.filter(function (o, i) {
      return list.indexOf(o) === i;
    });
  }; //append one phrase onto another.


  var appendPhrase = function appendPhrase(before, newPhrase, doc) {
    var beforeTerms = before.cache.terms || before.terms();
    var newTerms = newPhrase.cache.terms || newPhrase.terms(); //spruce-up the whitespace issues

    addWhitespace(beforeTerms, newTerms); //insert this segment into the linked-list

    stitchIn(beforeTerms, newTerms, before.pool); // stretch!
    // make each effected phrase longer

    var toStretch = [before];
    var hasId = before.start;
    var docs = [doc];
    docs = docs.concat(doc.parents()); // find them all!

    docs.forEach(function (parent) {
      // only the phrases that should change
      var shouldChange = parent.list.filter(function (p) {
        return p.hasId(hasId);
      });
      toStretch = toStretch.concat(shouldChange);
    }); // don't double-count a phrase

    toStretch = unique(toStretch);
    toStretch.forEach(function (p) {
      p.length += newPhrase.length;
    });
    return before;
  };

  var append = appendPhrase;

  var hasSpace$1 = / /; //a new space needs to be added, either on the new phrase, or the old one
  // '[new] [◻old]'   -or-   '[old] [◻new] [old]'

  var addWhitespace$1 = function addWhitespace(newTerms) {
    //add a space before our new text?
    // add a space after our text
    var lastTerm = newTerms[newTerms.length - 1];

    if (hasSpace$1.test(lastTerm.post) === false) {
      lastTerm.post += ' ';
    }

    return;
  }; //insert this segment into the linked-list


  var stitchIn$1 = function stitchIn(main, newPhrase, newTerms) {
    // [newPhrase] → [main]
    var lastTerm = newTerms[newTerms.length - 1];
    lastTerm.next = main.start; // [before] → [main]

    var pool = main.pool;
    var start = pool.get(main.start);

    if (start.prev) {
      var before = pool.get(start.prev);
      before.next = newPhrase.start;
    } //do it backwards, too
    // before ← newPhrase


    newTerms[0].prev = main.terms(0).prev; // newPhrase ← main

    main.terms(0).prev = lastTerm.id;
  };

  var unique$1 = function unique(list) {
    return list.filter(function (o, i) {
      return list.indexOf(o) === i;
    });
  }; //append one phrase onto another


  var joinPhrase = function joinPhrase(original, newPhrase, doc) {
    var starterId = original.start;
    var newTerms = newPhrase.terms(); //spruce-up the whitespace issues

    addWhitespace$1(newTerms); //insert this segment into the linked-list

    stitchIn$1(original, newPhrase, newTerms); //increase the length of our phrases

    var toStretch = [original];
    var docs = [doc];
    docs = docs.concat(doc.parents());
    docs.forEach(function (d) {
      // only the phrases that should change
      var shouldChange = d.list.filter(function (p) {
        return p.hasId(starterId) || p.hasId(newPhrase.start);
      });
      toStretch = toStretch.concat(shouldChange);
    }); // don't double-count

    toStretch = unique$1(toStretch); // stretch these phrases

    toStretch.forEach(function (p) {
      p.length += newPhrase.length; // change the start too, if necessary

      if (p.start === starterId) {
        p.start = newPhrase.start;
      }
    });
    return original;
  };

  var prepend = joinPhrase;

  //recursively decrease the length of all the parent phrases
  var shrinkAll = function shrinkAll(doc, id, deleteLength, after) {
    var arr = doc.parents();
    arr.push(doc);
    arr.forEach(function (d) {
      //find our phrase to shrink
      var phrase = d.list.find(function (p) {
        return p.hasId(id);
      });

      if (!phrase) {
        return;
      }

      phrase.length -= deleteLength; // does it start with this soon-removed word?

      if (phrase.start === id) {
        phrase.start = after.id;
      }
    }); // cleanup empty phrase objects

    doc.list = doc.list.filter(function (p) {
      if (!p.start || !p.length) {
        return false;
      }

      return true;
    });
  };
  /** wrap the linked-list around these terms
   * so they don't appear any more
   */


  var deletePhrase = function deletePhrase(phrase, doc) {
    var pool = doc.pool();
    var terms = phrase.cache.terms || phrase.terms(); //grab both sides of the chain,

    var prev = pool.get(terms[0].prev) || {};
    var after = pool.get(terms[terms.length - 1].next) || {};

    if (terms[0].implicit && prev.implicit) {
      prev.set(prev.implicit);
      prev.post += ' ';
    } // //first, change phrase lengths


    shrinkAll(doc, phrase.start, phrase.length, after); // connect [prev]->[after]

    if (prev) {
      prev.next = after.id;
    } // connect [prev]<-[after]


    if (after) {
      after.prev = prev.id;
    } // lastly, actually delete the terms from the pool?
    // for (let i = 0; i < terms.length; i++) {
    //   pool.remove(terms[i].id)
    // }

  };

  var _delete = deletePhrase;

  /** put this text at the end */

  var append_1 = function append_1(newPhrase, doc) {
    append(this, newPhrase, doc);
    return this;
  };
  /** add this text to the beginning */


  var prepend_1 = function prepend_1(newPhrase, doc) {
    prepend(this, newPhrase, doc);
    return this;
  };

  var delete_1 = function delete_1(doc) {
    _delete(this, doc);
    return this;
  }; // stich-in newPhrase, stretch 'doc' + parents


  var replace = function replace(newPhrase, doc) {
    //add it do the end
    var firstLength = this.length;
    append(this, newPhrase, doc); //delete original terms

    var tmp = this.buildFrom(this.start, this.length);
    tmp.length = firstLength;
    _delete(tmp, doc);
  };
  /**
   * Turn this phrase object into 3 phrase objects
   */


  var splitOn = function splitOn(p) {
    var terms = this.terms();
    var result = {
      before: null,
      match: null,
      after: null
    };
    var index = terms.findIndex(function (t) {
      return t.id === p.start;
    });

    if (index === -1) {
      return result;
    } //make all three sections into phrase-objects


    var start = terms.slice(0, index);

    if (start.length > 0) {
      result.before = this.buildFrom(start[0].id, start.length);
    }

    var match = terms.slice(index, index + p.length);

    if (match.length > 0) {
      result.match = this.buildFrom(match[0].id, match.length);
    }

    var end = terms.slice(index + p.length, terms.length);

    if (end.length > 0) {
      result.after = this.buildFrom(end[0].id, end.length, this.pool);
    }

    return result;
  };

  var _04Insert = {
    append: append_1,
    prepend: prepend_1,
    "delete": delete_1,
    replace: replace,
    splitOn: splitOn
  };

  /** return json metadata for this phrase */
  var json$1 = function json() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var world = arguments.length > 1 ? arguments[1] : undefined;
    var res = {}; // text data

    if (options.text) {
      res.text = this.text();
    }

    if (options.normal) {
      res.normal = this.text('normal');
    }

    if (options.clean) {
      res.clean = this.text('clean');
    }

    if (options.reduced) {
      res.reduced = this.text('reduced');
    }

    if (options.root) {
      res.root = this.text('root');
    }

    if (options.trim) {
      if (res.text) {
        res.text = res.text.trim();
      }

      if (res.normal) {
        res.normal = res.normal.trim();
      }

      if (res.reduced) {
        res.reduced = res.reduced.trim();
      }
    } // terms data


    if (options.terms) {
      if (options.terms === true) {
        options.terms = {};
      }

      res.terms = this.terms().map(function (t) {
        return t.json(options.terms, world);
      });
    }

    return res;
  };

  var _05Json$1 = {
    json: json$1
  };

  /** match any terms after this phrase */
  var lookAhead = function lookAhead(regs) {
    // if empty match string, return everything after
    if (!regs) {
      regs = '.*';
    }

    var pool = this.pool; // get a list of all terms preceding our start

    var terms = [];

    var getAfter = function getAfter(id) {
      var term = pool.get(id);

      if (!term) {
        return;
      }

      terms.push(term);

      if (term.prev) {
        getAfter(term.next); //recursion
      }
    };

    var all = this.terms();
    var lastTerm = all[all.length - 1];
    getAfter(lastTerm.next);

    if (terms.length === 0) {
      return [];
    } // got the terms, make a phrase from them


    var p = this.buildFrom(terms[0].id, terms.length);
    return p.match(regs);
  };
  /** match any terms before this phrase */


  var lookBehind = function lookBehind(regs) {
    // if empty match string, return everything before
    if (!regs) {
      regs = '.*';
    }

    var pool = this.pool; // get a list of all terms preceding our start

    var terms = [];

    var getBefore = function getBefore(id) {
      var term = pool.get(id);

      if (!term) {
        return;
      }

      terms.push(term);

      if (term.prev) {
        getBefore(term.prev); //recursion
      }
    };

    var term = pool.get(this.start);
    getBefore(term.prev);

    if (terms.length === 0) {
      return [];
    } // got the terms, make a phrase from them


    var p = this.buildFrom(terms[terms.length - 1].id, terms.length);
    return p.match(regs);
  };

  var _06Lookahead = {
    lookAhead: lookAhead,
    lookBehind: lookBehind
  };

  var methods$1 = Object.assign({}, _01Utils, _02Text, _03Change, _04Insert, _05Json$1, _06Lookahead);

  // try to avoid doing the match
  var failFast = function failFast(p, regs) {
    if (regs.length === 0) {
      return true;
    }

    for (var i = 0; i < regs.length; i += 1) {
      var reg = regs[i]; //   //logical quick-ones

      if (reg.optional !== true && reg.negative !== true) {
        //start/end impossibilites
        if (reg.start === true && i > 0) {
          return true;
        } // has almost no effect


        if (p.cache.words !== undefined && reg.word !== undefined && p.cache.words.hasOwnProperty(reg.word) !== true) {
          return true;
        }
      } //this is not possible


      if (reg.anything === true && reg.negative === true) {
        return true;
      }
    }

    return false;
  };

  var _02FailFast = failFast;

  // i formally apologize for how complicated this is.
  //found a match? it's greedy? keep going!
  var getGreedy = function getGreedy(terms, t, reg, until, index, length) {
    var start = t;

    for (; t < terms.length; t += 1) {
      //stop for next-reg match
      if (until && terms[t].doesMatch(until, index + t, length)) {
        return t;
      }

      var count = t - start + 1; // is it max-length now?

      if (reg.max !== undefined && count === reg.max) {
        return t;
      } //stop here


      if (terms[t].doesMatch(reg, index + t, length) === false) {
        // is it too short?
        if (reg.min !== undefined && count < reg.min) {
          return null;
        }

        return t;
      }
    }

    return t;
  }; //'unspecific greedy' is a weird situation.


  var greedyTo = function greedyTo(terms, t, nextReg, index, length) {
    //if there's no next one, just go off the end!
    if (!nextReg) {
      return terms.length;
    } //otherwise, we're looking for the next one


    for (; t < terms.length; t += 1) {
      if (terms[t].doesMatch(nextReg, index + t, length) === true) {
        return t;
      }
    } //guess it doesn't exist, then.


    return null;
  };
  /** tries to match a sequence of terms, starting from here */


  var tryHere = function tryHere(terms, regs, index, length) {
    var captures = [];
    var t = 0; // we must satisfy each rule in 'regs'

    for (var r = 0; r < regs.length; r += 1) {
      var reg = regs[r]; //should we fail here?

      if (!terms[t]) {
        //are all remaining regs optional?
        var hasNeeds = regs.slice(r).some(function (remain) {
          return !remain.optional;
        });

        if (hasNeeds === false) {
          break;
        } // have unmet needs


        return false;
      } //support 'unspecific greedy' .* properly


      if (reg.anything === true && reg.greedy === true) {
        var skipto = greedyTo(terms, t, regs[r + 1], reg, index); // ensure it's long enough

        if (reg.min !== undefined && skipto - t < reg.min) {
          return false;
        } // reduce it back, if it's too long


        if (reg.max !== undefined && skipto - t > reg.max) {
          t = t + reg.max;
          continue;
        } //TODO: support [*] properly


        if (skipto === null) {
          return false; //couldn't find it
        }

        t = skipto;
        continue;
      } //if it looks like a match, continue
      //we have a special case where an end-anchored greedy match may need to
      //start matching before the actual end; we do this by (temporarily!)
      //removing the "end" property from the matching token... since this is
      //very situation-specific, we *only* do this when we really need to.


      if (reg.anything === true || reg.end === true && reg.greedy === true && index + t < length - 1 && terms[t].doesMatch(Object.assign({}, reg, {
        end: false
      }), index + t, length) === true || terms[t].doesMatch(reg, index + t, length) === true) {
        var startAt = t; // okay, it was a match, but if it optional too,
        // we should check the next reg too, to skip it?

        if (reg.optional && regs[r + 1]) {
          // does the next reg match it too?
          if (terms[t].doesMatch(regs[r + 1], index + t, length) === true) {
            // but does the next reg match the next term??
            // only skip if it doesn't
            if (!terms[t + 1] || terms[t + 1].doesMatch(regs[r + 1], index + t, length) === false) {
              r += 1;
            }
          }
        } //advance to the next term!


        t += 1; //check any ending '$' flags

        if (reg.end === true) {
          //if this isn't the last term, refuse the match
          if (t !== terms.length && reg.greedy !== true) {
            return false;
          }
        } //try keep it going!


        if (reg.greedy === true) {
          // for greedy checking, we no longer care about the reg.start
          // value, and leaving it can cause failures for anchored greedy
          // matches.  ditto for end-greedy matches: we need an earlier non-
          // ending match to succceed until we get to the actual end.
          t = getGreedy(terms, t, Object.assign({}, reg, {
            start: false,
            end: false
          }), regs[r + 1], index, length);

          if (t === null) {
            return false; //greedy was too short
          } // if this was also an end-anchor match, check to see we really
          // reached the end


          if (reg.end === true && index + t !== length) {
            return false; //greedy didn't reach the end
          }
        }

        if (reg.capture) {
          captures.push(startAt); //add greedy-end to capture

          if (t > 1 && reg.greedy) {
            captures.push(t - 1);
          }
        }

        continue;
      } //bah, who cares, keep going


      if (reg.optional === true) {
        continue;
      } // should we skip-over an implicit word?


      if (terms[t].isImplicit() && regs[r - 1] && terms[t + 1]) {
        // does the next one match?
        if (terms[t + 1].doesMatch(reg, index + t, length)) {
          t += 2;
          continue;
        }
      } // console.log('   ❌\n\n')


      return false;
    } //we got to the end of the regs, and haven't failed!
    //try to only return our [captured] segment


    if (captures.length > 0) {
      //make sure the array is the full-length we'd return anyways
      var arr = terms.slice(captures[0], captures[captures.length - 1] + 1); //make sure the array is t-length (so we skip ahead full-length)

      for (var tmp = 0; tmp < t; tmp++) {
        arr[tmp] = arr[tmp] || null; //these get cleaned-up after
      }

      return arr;
    } //return our result


    return terms.slice(0, t);
  };

  var _03TryMatch = tryHere;

  var postProcess = function postProcess(terms, regs, matches) {
    if (!matches || matches.length === 0) {
      return matches;
    } // ensure end reg has the end term


    var atEnd = regs.some(function (r) {
      return r.end;
    });

    if (atEnd) {
      var lastTerm = terms[terms.length - 1];
      matches = matches.filter(function (arr) {
        return arr.indexOf(lastTerm) !== -1;
      });
    }

    return matches;
  };

  var _04PostProcess = postProcess;

  /* break-down a match expression into this:
  {
    word:'',
    tag:'',
    regex:'',

    start:false,
    end:false,
    negative:false,
    anything:false,
    greedy:false,
    optional:false,

    capture:false,
    choices:[],
  }
  */
  var hasMinMax = /\{([0-9]+,?[0-9]*)\}/;
  var andSign = /&&/;

  var titleCase$1 = function titleCase(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
  };

  var end = function end(str) {
    return str[str.length - 1];
  };

  var start = function start(str) {
    return str[0];
  };

  var stripStart = function stripStart(str) {
    return str.substr(1);
  };

  var stripEnd = function stripEnd(str) {
    return str.substr(0, str.length - 1);
  };

  var stripBoth = function stripBoth(str) {
    str = stripStart(str);
    str = stripEnd(str);
    return str;
  }; //


  var parseToken = function parseToken(w) {
    var obj = {}; //collect any flags (do it twice)

    for (var i = 0; i < 2; i += 1) {
      //back-flags
      if (end(w) === '+') {
        obj.greedy = true;
        w = stripEnd(w);
      }

      if (w !== '*' && end(w) === '*' && w !== '\\*') {
        obj.greedy = true;
        w = stripEnd(w);
      }

      if (end(w) === '?') {
        obj.optional = true;
        w = stripEnd(w);
      }

      if (end(w) === '$') {
        obj.end = true;
        w = stripEnd(w);
      } //front-flags


      if (start(w) === '^') {
        obj.start = true;
        w = stripStart(w);
      }

      if (start(w) === '!') {
        obj.negative = true;
        w = stripStart(w);
      } //wrapped-flags


      if (start(w) === '(' && end(w) === ')') {
        // support (one && two)
        if (andSign.test(w)) {
          obj.choices = w.split(andSign);
          obj.operator = 'and';
        } else {
          obj.choices = w.split('|');
          obj.operator = 'or';
        } //remove '(' and ')'


        obj.choices[0] = stripStart(obj.choices[0]);
        var last = obj.choices.length - 1;
        obj.choices[last] = stripEnd(obj.choices[last]); // clean up the results

        obj.choices = obj.choices.map(function (s) {
          return s.trim();
        });
        obj.choices = obj.choices.filter(function (s) {
          return s;
        }); //recursion alert!

        obj.choices = obj.choices.map(parseToken);
        w = '';
      } //capture group (this one can span multiple-terms)


      if (start(w) === '[' || end(w) === ']') {
        obj.capture = true;
        w = w.replace(/^\[/, '');
        w = w.replace(/\]$/, '');
      } //regex


      if (start(w) === '/' && end(w) === '/') {
        w = stripBoth(w);
        obj.regex = new RegExp(w); //potential vuln - security/detect-non-literal-regexp

        return obj;
      } //soft-match


      if (start(w) === '~' && end(w) === '~') {
        w = stripBoth(w);
        obj.soft = true;
        obj.word = w;
        return obj;
      }
    } // support #Tag{0,9}


    if (hasMinMax.test(w) === true) {
      w = w.replace(hasMinMax, function (a, b) {
        var arr = b.split(/,/g);

        if (arr.length === 1) {
          // '{3}'	Exactly three times
          obj.min = Number(arr[0]);
          obj.max = Number(arr[0]);
        } else {
          // '{2,4}' Two to four times
          // '{3,}' Three or more times
          obj.min = Number(arr[0]);
          obj.max = Number(arr[1] || 999);
        }

        obj.greedy = true;
        return '';
      });
    } //do the actual token content


    if (start(w) === '#') {
      obj.tag = stripStart(w);
      obj.tag = titleCase$1(obj.tag);
      return obj;
    } //dynamic function on a term object


    if (start(w) === '@') {
      obj.method = stripStart(w);
      return obj;
    }

    if (w === '.') {
      obj.anything = true;
      return obj;
    } //support alone-astrix


    if (w === '*') {
      obj.anything = true;
      obj.greedy = true;
      obj.optional = true;
      return obj;
    }

    if (w) {
      //somehow handle encoded-chars?
      w = w.replace('\\*', '*');
      w = w.replace('\\.', '.');
      obj.word = w.toLowerCase();
    }

    return obj;
  };

  var parseToken_1 = parseToken;

  var isArray$1 = function isArray(arr) {
    return Object.prototype.toString.call(arr) === '[object Array]';
  }; //split-up by (these things)


  var byParentheses = function byParentheses(str) {
    var arr = str.split(/([\^\[\!]*\(.*?\)[?+*]*\]?\$?)/);
    arr = arr.map(function (s) {
      return s.trim();
    });
    return arr;
  };

  var byWords = function byWords(arr) {
    var words = [];
    arr.forEach(function (a) {
      //keep brackets lumped together
      if (/^[[^_/]?\(/.test(a[0])) {
        words.push(a);
        return;
      }

      var list = a.split(' ');
      list = list.filter(function (w) {
        return w;
      });
      words = words.concat(list);
    });
    return words;
  }; //turn an array into a 'choices' list


  var byArray = function byArray(arr) {
    return [{
      choices: arr.map(function (s) {
        return {
          word: s
        };
      })
    }];
  };

  var postProcess$1 = function postProcess(tokens) {
    //ensure there's only one consecutive capture group.
    var count = tokens.filter(function (t) {
      return t.capture === true;
    }).length;

    if (count > 1) {
      var captureArr = tokens.map(function (t) {
        return t.capture;
      });
      var first = captureArr.indexOf(true);
      var last = captureArr.length - 1 - captureArr.reverse().indexOf(true); //'fill in' capture groups between start-end

      for (var i = first; i < last; i++) {
        tokens[i].capture = true;
      }
    }

    return tokens;
  };

  var fromDoc = function fromDoc(doc) {
    if (!doc || !doc.list || !doc.list[0]) {
      return [];
    }

    var ids = [];
    doc.list.forEach(function (p) {
      p.terms().forEach(function (t) {
        ids.push({
          id: t.id
        });
      });
    });
    return [{
      choices: ids,
      greedy: true
    }];
  };
  /** parse a match-syntax string into json */


  var syntax = function syntax(input) {
    // fail-fast
    if (input === null || input === undefined || input === '') {
      return [];
    } //try to support a ton of different formats:


    if (_typeof(input) === 'object') {
      if (isArray$1(input)) {
        if (input.length === 0 || !input[0]) {
          return [];
        } //is it a pre-parsed reg-list?


        if (_typeof(input[0]) === 'object') {
          return input;
        } //support a flat array of normalized words


        if (typeof input[0] === 'string') {
          return byArray(input);
        }
      } //support passing-in a compromise object as a match


      if (input && input.isA === 'Doc') {
        return fromDoc(input);
      }

      return [];
    }

    if (typeof input === 'number') {
      input = String(input); //go for it?
    }

    var tokens = byParentheses(input);
    tokens = byWords(tokens);
    tokens = tokens.map(parseToken_1); //clean up anything weird

    tokens = postProcess$1(tokens); // console.log(JSON.stringify(tokens, null, 2))

    return tokens;
  };

  var syntax_1 = syntax;

  /**  returns a simple array of arrays */

  var matchAll = function matchAll(p, regs) {
    var matchOne = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    //if we forgot to parse it..
    if (typeof regs === 'string') {
      regs = syntax_1(regs);
    } //try to dismiss it, at-once


    if (_02FailFast(p, regs) === true) {
      return [];
    } //any match needs to be this long, at least


    var minLength = regs.filter(function (r) {
      return r.optional !== true;
    }).length;
    var terms = p.cache.terms || p.terms();
    var matches = []; //optimisation for '^' start logic

    if (regs[0].start === true) {
      var match = _03TryMatch(terms, regs, 0, terms.length);

      if (match !== false && match.length > 0) {
        matches.push(match);
      } // remove (intentional) null results


      matches = matches.map(function (arr) {
        return arr.filter(function (t) {
          return t;
        });
      });
      return _04PostProcess(terms, regs, matches);
    } //try starting, from every term


    for (var i = 0; i < terms.length; i += 1) {
      // slice may be too short
      if (i + minLength > terms.length) {
        break;
      } //try it!


      var _match = _03TryMatch(terms.slice(i), regs, i, terms.length);

      if (_match !== false && _match.length > 0) {
        //zoom forward!
        i += _match.length - 1; //[capture-groups] return some null responses

        _match = _match.filter(function (m) {
          return m;
        });
        matches.push(_match); //ok, maybe that's enough?

        if (matchOne === true) {
          return _04PostProcess(terms, regs, matches);
        }
      }
    }

    return _04PostProcess(terms, regs, matches);
  };

  var _01MatchAll = matchAll;

  /** return anything that doesn't match.
   * returns a simple array of arrays
   */

  var notMatch = function notMatch(p, regs) {
    var found = {};
    var arr = _01MatchAll(p, regs);
    arr.forEach(function (ts) {
      ts.forEach(function (t) {
        found[t.id] = true;
      });
    }); //return anything not found

    var terms = p.terms();
    var result = [];
    var current = [];
    terms.forEach(function (t) {
      if (found[t.id] === true) {
        if (current.length > 0) {
          result.push(current);
          current = [];
        }

        return;
      }

      current.push(t);
    });

    if (current.length > 0) {
      result.push(current);
    }

    return result;
  };

  var not = notMatch;

  /** return an array of matching phrases */

  var match_1 = function match_1(str) {
    var _this = this;

    var justOne = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    var matches = _01MatchAll(this, str, justOne); //make them phrase objects

    matches = matches.map(function (list) {
      return _this.buildFrom(list[0].id, list.length);
    });
    return matches;
  };
  /** return boolean if one match is found */


  var has = function has(str) {
    var matches = _01MatchAll(this, str, true);
    return matches.length > 0;
  };
  /** remove all matches from the result */


  var not$1 = function not$1(str) {
    var _this2 = this;

    var matches = not(this, str); //make them phrase objects

    matches = matches.map(function (list) {
      return _this2.buildFrom(list[0].id, list.length);
    });
    return matches;
  };
  /** return a list of phrases that can have this tag */


  var canBe$1 = function canBe(tag, world) {
    var _this3 = this;

    var results = [];
    var terms = this.cache.terms || this.terms();
    var previous = false;

    for (var i = 0; i < terms.length; i += 1) {
      var can = terms[i].canBe(tag, world);

      if (can === true) {
        if (previous === true) {
          //add it to the end
          results[results.length - 1].push(terms[i]);
        } else {
          results.push([terms[i]]); //make a new one
        }

        previous = can;
      }
    } //turn them into Phrase objects


    results = results.filter(function (a) {
      return a.length > 0;
    }).map(function (arr) {
      return _this3.buildFrom(arr[0].id, arr.length);
    });
    return results;
  };

  var match = {
    match: match_1,
    has: has,
    not: not$1,
    canBe: canBe$1
  };

  var Phrase = function Phrase(id, length, pool) {
    _classCallCheck(this, Phrase);

    this.start = id;
    this.length = length;
    this.isA = 'Phrase'; // easier than .constructor...

    Object.defineProperty(this, 'pool', {
      enumerable: false,
      writable: true,
      value: pool
    });
    Object.defineProperty(this, 'cache', {
      enumerable: false,
      writable: true,
      value: {}
    });
  };
  /** create a new Phrase object from an id and length */


  Phrase.prototype.buildFrom = function (id, length) {
    var p = new Phrase(id, length, this.pool);

    if (this.cache) {
      p.cache = this.cache;

      if (length !== this.length) {
        p.cache.terms = null;
      }
    }

    return p;
  }; //apply methods


  Object.assign(Phrase.prototype, match);
  Object.assign(Phrase.prototype, methods$1); //apply aliases

  var aliases = {
    term: 'terms'
  };
  Object.keys(aliases).forEach(function (k) {
    return Phrase.prototype[k] = Phrase.prototype[aliases[k]];
  });
  var Phrase_1 = Phrase;

  /** a key-value store of all terms in our Document */
  var Pool =
  /*#__PURE__*/
  function () {
    function Pool() {
      var words = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, Pool);

      //quiet this property in console.logs
      Object.defineProperty(this, 'words', {
        enumerable: false,
        value: words
      });
    }
    /** throw a new term object in */


    _createClass(Pool, [{
      key: "add",
      value: function add(term) {
        this.words[term.id] = term;
        return this;
      }
      /** find a term by it's id */

    }, {
      key: "get",
      value: function get(id) {
        return this.words[id];
      }
      /** find a term by it's id */

    }, {
      key: "remove",
      value: function remove(id) {
        delete this.words[id];
      }
    }, {
      key: "merge",
      value: function merge(pool) {
        Object.assign(this.words, pool.words);
        return this;
      }
      /** helper method */

    }, {
      key: "stats",
      value: function stats() {
        return {
          words: Object.keys(this.words).length
        };
      }
    }]);

    return Pool;
  }();
  /** make a deep-copy of all terms */


  Pool.prototype.clone = function () {
    var _this = this;

    var keys = Object.keys(this.words);
    var words = keys.reduce(function (h, k) {
      var t = _this.words[k].clone();

      h[t.id] = t;
      return h;
    }, {});
    return new Pool(words);
  };

  var Pool_1 = Pool;

  //(Rule-based sentence boundary segmentation) - chop given text into its proper sentences.
  // Ignore periods/questions/exclamations used in acronyms/abbreviations/numbers, etc.
  // @spencermountain 2017 MIT
  //proper nouns with exclamation marks
  // const blacklist = {
  //   yahoo: true,
  //   joomla: true,
  //   jeopardy: true,
  // }
  //regs-
  var initSplit = /(\S.+?[.!?\u203D\u2E18\u203C\u2047-\u2049])(?=\s+|$)/g;
  var hasSomething = /\S/;
  var isAcronym$1 = /[ .][A-Z]\.? *$/i;
  var hasEllipse = /(?:\u2026|\.{2,}) *$/;
  var newLine = /((?:\r?\n|\r)+)/; // Match different new-line formats

  var hasLetter = /[a-z0-9\u00C0-\u00FF\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]/i;
  var startWhitespace = /^\s+/; // Start with a regex:

  var naiive_split = function naiive_split(text) {
    var all = []; //first, split by newline

    var lines = text.split(newLine);

    for (var i = 0; i < lines.length; i++) {
      //split by period, question-mark, and exclamation-mark
      var arr = lines[i].split(initSplit);

      for (var o = 0; o < arr.length; o++) {
        all.push(arr[o]);
      }
    }

    return all;
  };
  /** does this look like a sentence? */


  var isSentence = function isSentence(str, abbrevs) {
    // check for 'F.B.I.'
    if (isAcronym$1.test(str) === true) {
      return false;
    } //check for '...'


    if (hasEllipse.test(str) === true) {
      return false;
    } // must have a letter


    if (hasLetter.test(str) === false) {
      return false;
    }

    var txt = str.replace(/[.!?\u203D\u2E18\u203C\u2047-\u2049] *$/, '');
    var words = txt.split(' ');
    var lastWord = words[words.length - 1].toLowerCase(); // check for 'Mr.'

    if (abbrevs.hasOwnProperty(lastWord)) {
      return false;
    } // //check for jeopardy!
    // if (blacklist.hasOwnProperty(lastWord)) {
    //   return false
    // }


    return true;
  };

  var splitSentences = function splitSentences(text, world) {
    var abbrevs = world.cache.abbreviations;
    text = text || '';
    text = String(text);
    var sentences = []; // First do a greedy-split..

    var chunks = []; // Ensure it 'smells like' a sentence

    if (!text || typeof text !== 'string' || hasSomething.test(text) === false) {
      return sentences;
    } // Start somewhere:


    var splits = naiive_split(text); // Filter-out the crap ones

    for (var i = 0; i < splits.length; i++) {
      var s = splits[i];

      if (s === undefined || s === '') {
        continue;
      } //this is meaningful whitespace


      if (hasSomething.test(s) === false) {
        //add it to the last one
        if (chunks[chunks.length - 1]) {
          chunks[chunks.length - 1] += s;
          continue;
        } else if (splits[i + 1]) {
          //add it to the next one
          splits[i + 1] = s + splits[i + 1];
          continue;
        }
      } //else, only whitespace, no terms, no sentence


      chunks.push(s);
    } //detection of non-sentence chunks:
    //loop through these chunks, and join the non-sentence chunks back together..


    for (var _i = 0; _i < chunks.length; _i++) {
      var c = chunks[_i]; //should this chunk be combined with the next one?

      if (chunks[_i + 1] && isSentence(c, abbrevs) === false) {
        chunks[_i + 1] = c + (chunks[_i + 1] || '');
      } else if (c && c.length > 0) {
        //&& hasLetter.test(c)
        //this chunk is a proper sentence..
        sentences.push(c);
        chunks[_i] = '';
      }
    } //if we never got a sentence, return the given text


    if (sentences.length === 0) {
      return [text];
    } //move whitespace to the ends of sentences, when possible
    //['hello',' world'] -> ['hello ','world']


    for (var _i2 = 1; _i2 < sentences.length; _i2 += 1) {
      var ws = sentences[_i2].match(startWhitespace);

      if (ws !== null) {
        sentences[_i2 - 1] += ws[0];
        sentences[_i2] = sentences[_i2].replace(startWhitespace, '');
      }
    }

    return sentences;
  };

  var _01Sentences = splitSentences; // console.log(sentence_parser('john f. kennedy'));

  var wordlike = /\S/;
  var isBoundary = /^[!?.]+$/;
  var naiiveSplit = /(\S+)/;
  var isSlash = /\/\W*$/;
  var notWord = {
    '.': true,
    '-': true,
    //dash
    '–': true,
    //en-dash
    '—': true,
    //em-dash
    '--': true,
    '...': true // '/': true, // 'one / two'

  };

  var hasHyphen = function hasHyphen(str) {
    //dont split 're-do'
    if (/^(re|un)-?[^aeiou]./.test(str) === true) {
      return false;
    } //letter-number


    var reg = /^([a-z\u00C0-\u00FF`"'/]+)(-|–|—)([a-z0-9\u00C0-\u00FF].*)/i;

    if (reg.test(str) === true) {
      return true;
    } //support weird number-emdash combo '2010–2011'
    // let reg2 = /^([0-9]+)(–|—)([0-9].*)/i
    // if (reg2.test(str)) {
    //   return true
    // }


    return false;
  }; // 'he / she' should be one word


  var combineSlashes = function combineSlashes(arr) {
    for (var i = 1; i < arr.length - 1; i++) {
      if (isSlash.test(arr[i])) {
        arr[i - 1] += arr[i] + arr[i + 1];
        arr[i] = null;
        arr[i + 1] = null;
      }
    }

    return arr;
  };

  var splitHyphens = function splitHyphens(word) {
    var arr = []; //support multiple-hyphenated-terms

    var hyphens = word.split(/[-–—]/);
    var whichDash = '-';
    var found = word.match(/[-–—]/);

    if (found && found[0]) {
      whichDash = found;
    }

    for (var o = 0; o < hyphens.length; o++) {
      if (o === hyphens.length - 1) {
        arr.push(hyphens[o]);
      } else {
        arr.push(hyphens[o] + whichDash);
      }
    }

    return arr;
  }; //turn a string into an array of terms (naiive for now, lumped later)


  var splitWords = function splitWords(str) {
    var result = [];
    var arr = []; //start with a naiive split

    str = str || '';

    if (typeof str === 'number') {
      str = String(str);
    }

    var words = str.split(naiiveSplit);

    for (var i = 0; i < words.length; i++) {
      //split 'one-two'
      if (hasHyphen(words[i]) === true) {
        arr = arr.concat(splitHyphens(words[i]));
        continue;
      }

      arr.push(words[i]);
    } //greedy merge whitespace+arr to the right


    var carry = '';

    for (var _i = 0; _i < arr.length; _i++) {
      var word = arr[_i]; //if it's more than a whitespace

      if (wordlike.test(word) === true && notWord.hasOwnProperty(word) === false && isBoundary.test(word) === false) {
        //put whitespace on end of previous term, if possible
        if (result.length > 0) {
          result[result.length - 1] += carry;
          result.push(word);
        } else {
          //otherwise, but whitespace before
          result.push(carry + word);
        }

        carry = '';
      } else {
        carry += word;
      }
    } //handle last one


    if (carry) {
      if (result.length === 0) {
        result[0] = '';
      }

      result[result.length - 1] += carry; //put it on the end
    } // combine 'one / two'


    result = combineSlashes(result); // remove empty results

    result = result.filter(function (s) {
      return s;
    });
    return result;
  };

  var _02Words = splitWords;

  var addLinks = function addLinks(terms) {
    terms.forEach(function (term, i) {
      if (i > 0) {
        term.prev = terms[i - 1].id;
      }

      if (terms[i + 1]) {
        term.next = terms[i + 1].id;
      }
    });
  };
  /** turn a string into an array of Phrase objects */


  var fromText = function fromText() {
    var text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var world = arguments.length > 1 ? arguments[1] : undefined;
    var pool = arguments.length > 2 ? arguments[2] : undefined;

    //a bit of validation, first
    if (typeof text !== 'string') {
      if (typeof text === 'number') {
        text = String(text);
      }
    } //tokenize into words


    var sentences = _01Sentences(text, world);
    sentences = sentences.map(function (str) {
      return _02Words(str);
    }); //turn them into proper objects

    pool = pool || new Pool_1();
    var phrases = sentences.map(function (terms) {
      terms = terms.map(function (str) {
        var term = new Term_1(str);
        pool.add(term);
        return term;
      }); //add next/previous ids

      addLinks(terms); //return phrase objects

      return new Phrase_1(terms[0].id, terms.length, pool);
    }); //return them ready for a Document object

    return phrases;
  }; // parse the compressed format '3,2|2,4'


  var parseTags = function parseTags(text, tagList) {
    return text.split('|').map(function (str) {
      var numList = str.split(',');
      numList = numList.map(function (n) {
        return parseInt(n, 10);
      }); // convert a list pf numbers into an array of tag names

      return numList.map(function (num) {
        if (!tagList[num]) {
          console.warn('Compromise import: missing tag at index ' + num);
        }

        return tagList[num];
      });
    });
  };
  /** create a word-pool and Phrase objects from .export() json*/


  var fromJSON = function fromJSON(json, world) {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }

    var pool = new Pool_1(); //create Phrase objects

    var phrases = json.list.map(function (o) {
      // tokenize words from sentence text
      var terms = _02Words(o[0]); // unpack the tag data for each term

      var tagArr = parseTags(o[1], json.tags); //create Term objects

      terms = terms.map(function (str, i) {
        var term = new Term_1(str);
        tagArr[i].forEach(function (tag) {
          return term.tag(tag, '', world);
        });
        pool.add(term);
        return term;
      }); //add prev/next links

      addLinks(terms); // return a proper Phrase object

      return new Phrase_1(terms[0].id, terms.length, pool);
    });
    return phrases;
  };

  var _01Tokenizer = {
    fromText: fromText,
    fromJSON: fromJSON
  };

  var _version = '12.3.0';

  var _data = {
    "Comparative": "true¦better",
    "Superlative": "true¦earlier",
    "PresentTense": "true¦is,sounds",
    "Value": "true¦a few",
    "Noun": "true¦a8b7c5e3f2here,ie,lit,m1no doubt,p0tce,vs;d,l;a,d;t,y;g,sp,tc,x0;!p;a,ca,o0;l,rp;a,c,l;d,l,rc",
    "Copula": "true¦a1is,w0;as,ere;m,re",
    "PastTense": "true¦be3came,d2had,lied,meant,sa2taken,w0;as,e0;nt,re;id;en,gan",
    "Condition": "true¦if,unless",
    "Gerund": "true¦accord0be0develop0go0result0stain0;ing",
    "Negative": "true¦n0;ever,o0;!n,t",
    "QuestionWord": "true¦how3wh0;at,e1ich,o0y;!m,se;n,re; come,'s",
    "Plural": "true¦records",
    "Conjunction": "true¦&,aEbAcuz,how8in caDno7o6p4supposing,t1vers5wh0yet;eth8ile;h0o;eref9o0;!uC;l0rovided that;us;r,therwi6; matt1r;!ev0;er;e0ut;cau1f0;ore;se;lthou1nd,s 0;far as,if;gh",
    "Pronoun": "true¦'em,elle,h4i3me,ourselves,she5th1us,we,you0;!rself;e0ou;m,y;!l,t;e0im;!'s",
    "Singular": "true¦0:0X;1:10;a0Wb0Kc0Bd04e02fXgShOici1jel0kitty,lNmJnIoHpDquestion mark,rBs7t4u2womW;nc0Rs 2;doll0Dst0F; rex,a3h2ic,ragedy,v show;ere,i1;l0x return;ist0Pky,omeone,t2uper bowl,yst0W;ep3ri1u2;de0Pff;faMmoM;al0i1o2;om,se;a4i0Jl05r3u2;dLrpoD;erogaVobl0O;rt,te0I;bjSceGthers;othi1umb0E;a4ee04o2;del,m2nopo0th0C;!my;n,yf0;i0unch;ead start,o2;l0me3u2;se;! run;adf0entlem5irlZlaci04od,rand3u2;l0y; slam,fa2mo2;th01;an;a5ella,ly,ol0r3un2;di1;iTo2;ntiWsN;mi0thV;conomy,gg,ner5veWx2;ampQecu7;ad7e4innSo2ragonf0ude;cumentFg2i0l0or;gy;ath,t2;ec2;tive;!dy;a8eili1h6i4o2redit card;ttage,u2;riJsin;ty,vil w2;ar;andeliGocol2;ate;n2rD;ary;aAel0lesHo6r4u2;n2tterf0;ti1;eakfast,o2;!th8;dy,tt4y2;!fri2;end;le;nki1r2;ri2;er;d4l0noma0u2;nt;ly; homin4verti2;si1;ng;em",
    "Actor": "true¦aJbGcFdCengineIfAgardenIh9instructPjournalLlawyIm8nurse,opeOp5r3s1t0;echnCherapK;ailNcientJoldiGu0;pervKrgeon;e0oofE;ceptionGsearC;hotographClumbColi1r0sychologF;actitionBogrammB;cem6t5;echanic,inist9us4;airdress8ousekeep8;arm7ire0;fight6m2;eputy,iet0;ici0;an;arpent2lerk;ricklay1ut0;ch0;er;ccoun6d2ge7r0ssis6ttenda7;chitect,t0;ist;minist1v0;is1;rat0;or;ta0;nt",
    "Honorific": "true¦a03b00cSdReQfiLgKhon,jr,king,lJmEoDp8queen,r4s0taoiseach,vice7;e1fc,gt,ir,r,u0;ltTpt,rg;c0nDrgeaL;ond liJretary;abbi,e0;ar1pAs,v0;!erend; admirY;astPhd,r0vt;esideEi1of0;!essN;me mini5nce0;!ss;fficOp,rd;a3essrs,i2lle,me,r1s0;!tr;!s;stK;gistrate,j,r6yF;i3lb,t;en,ov;eld mar3rst l0;ady,i0;eutena0;nt;shG;sq,xcellency;et,oct6r,utchess;apt6hance4mdr,o0pl;lonel,m2ngress0unci3;m0wom0;an;dr,mand5;ll0;or;!ain;ldg,rig0;!adi0;er;d0sst,tty,yatullah;j,m0v;!ir0;al",
    "SportsTeam": "true¦0:1A;1:1H;2:1G;a1Eb16c0Td0Kfc dallas,g0Ihouston 0Hindiana0Gjacksonville jagua0k0El0Bm01newToQpJqueens parkIreal salt lake,sAt5utah jazz,vancouver whitecaps,w3yW;ashington 3est ham0Rh10;natio1Oredski2wizar0W;ampa bay 6e5o3;ronto 3ttenham hotspur;blue ja0Mrapto0;nnessee tita2xasC;buccanee0ra0K;a7eattle 5heffield0Kporting kansas0Wt3;. louis 3oke0V;c1Frams;marine0s3;eah15ounG;cramento Rn 3;antonio spu0diego 3francisco gJjose earthquak1;char08paA; ran07;a8h5ittsburgh 4ortland t3;imbe0rail blaze0;pirat1steele0;il3oenix su2;adelphia 3li1;eagl1philNunE;dr1;akland 3klahoma city thunder,rlando magic;athle0Mrai3;de0; 3castle01;england 7orleans 6york 3;city fc,g4je0FknXme0Fred bul0Yy3;anke1;ian0D;pelica2sain0C;patrio0Brevolut3;ion;anchester Be9i3ontreal impact;ami 7lwaukee b6nnesota 3;t4u0Fvi3;kings;imberwolv1wi2;rewe0uc0K;dolphi2heat,marli2;mphis grizz3ts;li1;cXu08;a4eicesterVos angeles 3;clippe0dodDla9; galaxy,ke0;ansas city 3nE;chiefs,roya0E; pace0polis colU;astr06dynamo,rockeTtexa2;olden state warrio0reen bay pac3;ke0;.c.Aallas 7e3i05od5;nver 5troit 3;lio2pisto2ti3;ge0;broncZnuggeM;cowbo4maver3;ic00;ys; uQ;arCelKh8incinnati 6leveland 5ol3;orado r3umbus crew sc;api5ocki1;brow2cavalie0india2;bengaWre3;ds;arlotte horAicago 3;b4cubs,fire,wh3;iteB;ea0ulR;diff3olina panthe0; c3;ity;altimore 9lackburn rove0oston 5rooklyn 3uffalo bilN;ne3;ts;cel4red3; sox;tics;rs;oriol1rave2;rizona Ast8tlanta 3;brav1falco2h4u3;nited;aw9;ns;es;on villa,r3;os;c5di3;amondbac3;ks;ardi3;na3;ls",
    "Uncountable": "true¦a1Ib1Ac11d0Ye0Rf0Lg0Hh0Ci08j07knowled1Hl02mUnews,oTpQrLsAt5vi4w0;a2ea05i1oo0;d,l;ldlife,ne;rmth,t17;neg0Yol06tae;e3h2oothpaste,r0una;affPou0;ble,sers,t;ermod1Eund12;a,nnis;a8cene04eri0Oh7il6kittl0Onow,o5p3t1u0;g0Rnshi0H;ati1De0;am,el;ace16e0;ci0Jed;ap,cc0U;k,v0T;eep,ingl0G;d04fe10l0nd;m0St;a3e1ic0;e,ke0D;c0laxa09search;ogni08rea08;bi09in;aJe1hys10last5o0ressV;lit0Zrk,w0J;a0Vtrol;bstetr0Xil,xygen;a5e3ilk,o2u0;mps,s0;ic;nGo0A;a0chan0S;slZt;chine0il,themat0Q; learn05ry;aught08e2i1ogi0Nu0;ck,g0C;ce,ghtn02ngui0LteratH;a0isG;th04;ewel7usti0G;ce,mp0nformaOtself;a0ortan0E;ti0;en0C;a3isto2o0;ck0mework,n0spitali06;ey;ry;ir,libut,ppi7;en01o1r0um,ymna08;a6ound;l0ssip;d,f;i4lour,o1urnit0;ure;od,rgive0uriNwl;ne0;ss;c6sh;conomZduca5lectr4n2quip3thZvery0;body,o0thE;ne;joy0tertain0;ment;iciNonU;tiF;ar1iabet0raugh1;es;ts;a7elcius,h3ivPl2o0urrency;al,ld w0nfusiAttA;ar;assMoth2;aos,e0;e1w0;ing;se;r4sh;a4eef,i1lood,owls,read,utt0;er;lliar1s0;on;ds;g0ss;ga0;ge;c6dvi5ero3ir2mnes1rt,thl0;et7;ty;craft;b4d0naut4;ynam3;ce;id,ou0;st0;ics",
    "Infinitive": "true¦0:6K;1:6Y;2:57;3:6V;4:6W;5:5Z;6:67;7:6I;8:6Q;9:6U;A:6P;B:6S;C:6D;D:6Z;E:56;F:5P;a6Cb61c52d4Ae3Uf3Hg3Bh34i2Rj2Pk2Nl2Fm25n22o1Xp1Iques3Ir0Qs05tXuSvOwHyG;awn,ield;aJe1Yhist6iIoGre65;nd0rG;k,ry;pe,sh,th0;lk,nHrGsh,tCve;n,raD;d0t;aIiGo9;eGsA;!w;l6Cry;nHpGr3se;gra4Mli3Z;dGi9lo5S;erGo;mi58w1I;aMeLhKoJrHuGwi8;ne,rn;aGe0Mi5Nu8y;de,in,nsf0p,v5F;r2XuC;ank,reat2N;nd,st;lk,rg1Ps9;aZcWeVhTi4Akip,lSmRnee3Jo4YpQtJuGwitC;bmAck,ff0gge8ppHrGspe5;ge,pri1rou4Vvi4;ly,o34;aLeKoJrHuG;dy,mb6;aEeGi4;ngth2Dss,tC;p,re;m,p;in,ke,r0Qy;laFoil,rink6;e1Xi6o3H;am,ip;a2iv0oG;ck,ut;arCem,le5n1r4tt6;aHo2rG;atCew;le,re;il,ve;a05eIisk,oHuG;in,le,sh;am,ll;a01cZdu7fYgXje5lUmTnt,pQquPsKtJvGwa5O;eGiew,o34;al,l,rG;se,t;aEi2u40;eJi8oItG;!o2rG;i5uc1Y;l4rt;mb6nt,r4;e8i2;air,eHlGo3ZreseD;a7y;at;aEemb0i3Vo4;aHeGi4y;a1nt;te,x;a56r0I;act1Wer,le5u1;a11ei4k5IoGyc6;gni2Anci6rd;ch,li29s5G;i1nG;ge,k;aTerSiRlOoMrIuG;b1Zll,mp,rGsh;cha1s4J;ai1eIiDoG;cGdu7greBhibAmi1te8vi2T;eBlaim;di5pa2ss,veD;iDp,rtr3ZsGur;e,t;aHuG;g,n3;n,y;ck,le;fo30mAsi8;ck,iDrt4Fss,u1;bJccur,ff0pera9utweIverGwe;co40lap,ta20u1wG;helm;igh;ser4taE;eHotG;e,i7;ed,gle5;aLeKiIoHuG;ltip3Crd0;nit11ve;nGrr10;d,g6us;asu2lt,n0Nr3;intaEna3rHtG;ch,t0;ch,kGry;et;aLeKiIoGu1B;aGck,ok,ve;d,n;ft,ke,mAnGst2Wve;e,k;a2Dc0Et;b0Nck,uG;gh,nC;iGno2Z;ck,ll,ss;am,oEuG;d3mp;gno2mQnGss3C;cOdica9flu0MhNsKtIvG;eGol4;nt,st;erGrodu7;a5fe2;i8tG;aGru5;ll;abAibA;lu1Er1C;agi22pG;lemeDo20ro4;aKeIi2oHuG;nt,rry;n02pe,st;aGlp;d,t;nd6ppGrm,te;en;aKloBove1MrIuG;arGeBi13;ant33d;aGip,umb6;b,sp;in,th0ze;aQeaPiNlLoIracHuncG;ti3D;tu2;cus,lHrG;ce,eca8m,s2V;d,l1Z;aFoG;at,od,w;gu2lGniFx;e,l;r,tu2;il,vG;or;a13cho,le5mSnPstNvalua9xG;a0AcLerKi8pGte17;a16eHlaEoGreB;rt,se;ct,riG;en7;ci1t;el,han3;abGima9;liF;ab6couXdHfor7ga3han7j03riCsu2t0vG;isi2Qy;!u2;body,er3pG;hasiGow0;ze;a06eUiLoKrHuG;mp;aHeBiG;ft;g,in;d3ubt;ff0p,re5sHvG;iYor7;aKcHliGmiBpl16tinguiF;ke;oGuB;uGv0;ra3;gr1TppG;ear,ro4;cNem,fLliv0ma0Dny,pKsHterG;mi0E;cribe,er4iHtrG;oy;gn,re;a09e08i5osA;eGi09y;at,ct;iIlHrG;ea1;a2i05;de;ma3n7re,te;a0Ae09h06i9l04oJrG;aHeGoBuFy;a9dA;ck,ve;llZmSnHok,py,uGv0;gh,nt;cePdu5fMsKtIvG;eGin7;rt,y;aEin0SrG;a8ibu9ol;iGtitu9;d0st;iHoGroD;rm;gu2rm;rn;biLfoKmaJpG;a2laE;in;re;nd;rt;ne;ap1e5;aGip,o1;im,w;aHeG;at,ck,w;llen3n3r3se;a1nt0;ll,ncIrGt0u1;eGry;!en;el;aPeMloLoJruFuG;lGry;ly;sh;a8mb,o8rrGth0un7;ow;ck;ar,lHnefAtrG;ay;ie4ong;ng,se;band0Jc0Bd06ffo05gr04id,l01mu1nYppTrQsKttGvoid,waA;acIeHra5;ct;m0Fnd;h,k;k,sG;eIiHocia9uG;me;gn,st;mb6rt;le;chHgGri4;ue;!i4;eaJlIroG;aCve;ch;aud,y;l,r;noun7sw0tG;icipa9;ce;lHt0;er;e3ow;ee;rd;aRdIju8mAoR;it;st;!reB;ss;cJhie4knowled3tiva9;te;ge;ve;eIouDu1;se;nt;pt;on",
    "Unit": "true¦0:16;a11b0Zc0Ld0Ke0If0Dg09h06in0Ejoule0k00lYmNnMoLpIqHsqCt7volts,w6y4z3°2µ1;g,s;c,f,n;b,e2;a0Kb,d0Qears old,o1;tt0E;att0b;able4b3e2on1sp;!ne0;a2r0A;!l,sp;spo01; ft,uare 1;c0Fd0Ef3i0Ckilo0Gm1ya0B;e0Jil1;e0li0E;eet0o0A;t,uart0;ascals,e2i1ou0Mt;c0Jnt0;rcent,tZ;hms,uVz;an0GewtQ;/s,b,e7g,i3l,m2p1²,³;h,s;!²;!/h,cro3l1;e1li05;! DsC²;g05s0A;gPter1;! 2s1;! 1;per second;b,iZm,u1x;men0x0;b,elvin0g,ilo2m1nQ;!/h,ph,²;byYgWmeter1;! 2s1;! 1;per hour;e1g,z;ct1rtz0;aXogQ;al2b,igAra1;in0m0;!l1;on0;a4emtPl2t1;²,³; oz,uid ou1;nce0;hrenheit0rad0;b,x1;abyH;eciCg,l,mA;arat0eAg,m9oulomb0u1;bic 1p0;c5d4fo3i2meAya1;rd0;nch0;ot0;eci2;enti1;me4;!²,³;lsius0nti1;g2li1me1;ter0;ram0;bl,y1;te0;c4tt1;os1;eco1;nd0;re0;!s",
    "Organization": "true¦0:46;a3Ab2Qc2Ad21e1Xf1Tg1Lh1Gi1Dj19k17l13m0Sn0Go0Dp07qu06rZsStFuBv8w3y1;amaha,m0Xou1w0X;gov,tu2S;a3e1orld trade organizati41;lls fargo,st1;fie22inghou16;l1rner br3D;-m11gree31l street journ25m11;an halNeriz3Wisa,o1;dafo2Gl1;kswagLvo;bs,kip,n2ps,s1;a tod2Rps;es35i1;lev2Xted natio2Uv; mobi2Kaco bePd bMeAgi frida9h3im horto2Tmz,o1witt2W;shiba,y1;ota,s r Y;e 1in lizzy;b3carpen33daily ma2Xguess w2holli0rolling st1Ms1w2;mashing pumpki2Ouprem0;ho;ea1lack eyed pe3Fyrds;ch bo1tl0;ys;l2s1;co,la m12;efoni07us;a6e4ieme2Gnp,o2pice gir5ta1ubaru;rbucks,to2N;ny,undgard1;en;a2Rx pisto1;ls;few25insbu26msu1X;.e.m.,adiohead,b6e3oyal 1yan2X;b1dutch she4;ank;/max,aders dige1Ed 1vl32;bu1c1Uhot chili peppe2Klobst28;ll;c,s;ant2Vizno2F;an5bs,e3fiz24hilip morrBi2r1;emier27octer & gamb1Rudenti14;nk floyd,zza hut;psi28tro1uge08;br2Qchina,n2Q; 2ason1Xda2G;ld navy,pec,range juli2xf1;am;us;a9b8e5fl,h4i3o1sa,wa;kia,tre dame,vart1;is;ke,ntendo,ss0K;l,s;c,st1Etflix,w1; 1sweek;kids on the block,york08;a,c;nd1Us2t1;ional aca2Fo,we0Q;a,cYd0O;aAcdonald9e5i3lb,o1tv,yspace;b1Nnsanto,ody blu0t1;ley crue,or0O;crosoft,t1;as,subisO;dica3rcedes2talli1;ca;!-benz;id,re;'s,s;c's milk,tt13z1Y;'ore09a3e1g,ittle caesa1Ktd;novo,x1;is,mark; pres5-z-boy,bour party;atv,fc,kk,m1od1K;art;iffy lu0Lo3pmorgan1sa;! cha1;se;hnson & johns1Sy d1R;bm,hop,n1tv;c,g,te1;l,rpol; & m,asbro,ewlett-packaTi3o1sbc,yundai;me dep1n1J;ot;tac1zbollah;hi;eneral 6hq,l5mb,o2reen d0Iu1;cci,ns n ros0;ldman sachs,o1;dye1g0B;ar;axo smith kliZencore;electr0Im1;oto0V;a3bi,da,edex,i1leetwood mac,oGrito-l0A;at,nancial1restoV; tim0;cebook,nnie mae;b06sa,u3xxon1; m1m1;ob0H;!rosceptics;aiml0Ae5isney,o3u1;nkin donuts,po0Wran dur1;an;j,w j1;on0;a,f leppa3ll,p2r spiegZstiny's chi1;ld;eche mode,t;rd;aEbc,hBi9nn,o3r1;aigsli5eedence clearwater reviv1ossra05;al;!ca c5l4m1o0Ast05;ca2p1;aq;st;dplMgate;ola;a,sco1tigroup;! systems;ev2i1;ck fil-a,na daily;r0Hy;dbury,pital o1rl's jr;ne;aGbc,eCfAl6mw,ni,o2p,r1;exiteeWos;ei3mbardiJston 1;glo1pizza;be;ng;ack & deckFo2ue c1;roX;ckbuster video,omingda1;le; g1g1;oodriN;cht3e ge0n & jer2rkshire hathaw1;ay;ryH;el;nana republ3s1xt5y5;f,kin robbi1;ns;ic;bXcSdidRerosmith,ig,lLmFnheuser-busEol,ppleAr7s3t&t,v2y1;er;is,on;hland2s1;n,ociated F; o1;il;by4g2m1;co;os; compu2bee1;'s;te1;rs;ch;c,d,erican3t1;!r1;ak; ex1;pre1;ss; 4catel2t1;air;!-luce1;nt;jazeera,qae1;da;as;/dc,a3er,t1;ivisi1;on;demy of scienc0;es;ba,c",
    "Demonym": "true¦0:16;1:13;a0Wb0Nc0Cd0Ae09f07g04h02iYjVkTlPmLnIomHpDqatari,rBs7t5u4v3wel0Rz2;am0Fimbabwe0;enezuel0ietnam0H;g9krai1;aiwThai,rinida0Iu2;ni0Qrkmen;a4cot0Ke3ingapoOlovak,oma0Tpa05udRw2y0X;edi0Kiss;negal0Br08;mo0uU;o6us0Lw2;and0;a3eru0Hhilipp0Po2;li0Ertugu06;kist3lesti1na2raguay0;ma1;ani;amiZi2orweP;caragu0geri2;an,en;a3ex0Mo2;ngo0Erocc0;cedo1la2;gasy,y08;a4eb9i2;b2thua1;e0Dy0;o,t02;azakh,eny0o2uwaiti;re0;a2orda1;ma0Bp2;anN;celandic,nd4r2sraeli,ta02vo06;a2iT;ni0qi;i0oneV;aiDin2ondur0unN;di;amDe2hanai0reek,uatemal0;or2rm0;gi0;i2ren7;lipino,n4;cuadoVgyp6ngliJsto1thiopi0urope0;a2ominXut4;niH;a9h6o4roa3ub0ze2;ch;ti0;lom2ngol5;bi0;a6i2;le0n2;ese;lifor1m2na3;bo2eroo1;di0;angladeshi,el8o6r3ul2;gaG;aziBi2;ti2;sh;li2s1;vi0;aru2gi0;si0;fAl7merBngol0r5si0us2;sie,tr2;a2i0;li0;gent2me1;ine;ba1ge2;ri0;ni0;gh0r2;ic0;an",
    "Possessive": "true¦anyAh5its,m3noCo1sometBthe0yo1;ir1mselves;ur0;!s;i8y0;!se4;er1i0;mse2s;!s0;!e0;lf;o1t0;hing;ne",
    "Currency": "true¦$,aud,bScQdLeurKfJgbp,hkd,iIjpy,kGlEp8r7s3usd,x2y1z0¢,£,¥,ден,лв,руб,฿,₡,₨,€,₭,﷼;lotySł;en,uanR;af,of;h0t5;e0il5;k0q0;elM;iel,oubleLp,upeeL;e2ound st0;er0;lingI;n0soH;ceGn0;ies,y;e0i8;i,mpi7;n,r0wanzaCyatC;!onaBw;ls,nr;ori7ranc9;!o8;en3i2kk,o0;b0ll2;ra5;me4n0rham4;ar3;ad,e0ny;nt1;aht,itcoin0;!s",
    "City": "true¦a2Wb26c1Wd1Re1Qf1Og1Ih1Ai18jakar2Hk0Zl0Tm0Gn0Co0ApZquiYrVsLtCuBv8w3y1z0;agreb,uri1Z;ang1Te0okohama;katerin1Hrev34;ars3e2i0rocl3;ckl0Vn0;nipeg,terth0W;llingt1Oxford;aw;a1i0;en2Hlni2Z;lenc2Uncouv0Gr2G;lan bat0Dtrecht;a6bilisi,e5he4i3o2rondheim,u0;nVr0;in,ku;kyo,ronIulouC;anj23l13miso2Jra2A; haJssaloni0X;gucigalpa,hr2Ol av0L;i0llinn,mpe2Bngi07rtu;chu22n2MpT;a3e2h1kopje,t0ydney;ockholm,uttga12;angh1Fenzh1X;o0KvZ;int peters0Ul3n0ppo1F; 0ti1B;jo0salv2;se;v0z0Q;adU;eykjavik,i1o0;me,sario,t25;ga,o de janei17;to;a8e6h5i4o2r0ueb1Qyongya1N;a0etor24;gue;rt0zn24; elizabe3o;ls1Grae24;iladelph1Znom pe07oenix;r0tah tik19;th;lerJr0tr10;is;dessa,s0ttawa;a1Hlo;a2ew 0is;delTtaip0york;ei;goya,nt0Upl0Uv1R;a5e4i3o1u0;mb0Lni0I;nt0scH;evideo,real;l1Mn01skolc;dellín,lbour0S;drid,l5n3r0;ib1se0;ille;or;chest0dalWi0Z;er;mo;a4i1o0vAy01;nd00s angel0F;ege,ma0nz,sbZverpo1;!ss0;ol; pla0Iusan0F;a5hark4i3laipeda,o1rak0uala lump2;ow;be,pavog0sice;ur;ev,ng8;iv;b3mpa0Kndy,ohsiu0Hra0un03;c0j;hi;ncheMstanb0̇zmir;ul;a5e3o0; chi mi1ms,u0;stI;nh;lsin0rakliG;ki;ifa,m0noi,va0A;bu0SiltD;alw4dan3en2hent,iza,othen1raz,ua0;dalaj0Gngzhou;bu0P;eUoa;sk;ay;es,rankfu0;rt;dmont4indhovU;a1ha01oha,u0;blRrb0Eshanbe;e0kar,masc0FugavpiJ;gu,je0;on;a7ebu,h2o0raioJuriti01;lo0nstanJpenhagNrk;gFmbo;enn3i1ristchur0;ch;ang m1c0ttagoL;ago;ai;i0lgary,pe town,rac4;ro;aHeBirminghWogoAr5u0;char3dap3enos air2r0sZ;g0sa;as;es;est;a2isba1usse0;ls;ne;silPtisla0;va;ta;i3lgrade,r0;g1l0n;in;en;ji0rut;ng;ku,n3r0sel;celo1ranquil0;la;na;g1ja lu0;ka;alo0kok;re;aBb9hmedabad,l7m4n2qa1sh0thens,uckland;dod,gabat;ba;k0twerp;ara;m5s0;terd0;am;exandr0maty;ia;idj0u dhabi;an;lbo1rh0;us;rg",
    "Abbreviation": "true¦a08b05cZdXeUfSgRhQiPjNkanMlKmGnEoDpCque,rAs6t4u3v2w0;is0y00;!c;a,s,t;niv,safa,t;ce,e0;nn,x;ask,e1fc,gt,ir,r,t,u0;pt,rg;nDp0;!t;d,e0;pAs,v;a,d,ennGhd,l,rof,vt;ct,kla,nt,p,rd;eb0ov;!r;a2d,essrs,i1lle,me,r5s0t;!tr;nn,ster;!j,r;it,lb,t0;!d;!s;an,r,u0;l,n;a,da,e,nc;on,wy;a,en,ov;eb,l0t,y;!a;g,s1tc,x0;!p;p,q;ak,e0ist,r;c,pt,t;a3ca,l,m2o0pl,res,t;!l0m1nn,rp;!o;dr;!l0pt;!if;a,c,l1r0;ig,os;!dg,vd;d3l2pr,r1ss0tty,ug,ve;n,t;c,iz;!ta;!j,m,v",
    "Place": "true¦a07b05cZdYeXfVgRhQiOjfk,kMlKmHneEoDp9que,rd,s8t5u4v3w0yyz;is1y0;!o;!c;a,t;pYsafa,t;e1he 0;bronx,hamptons;nn,x;ask,fo,oho,t,under6yd;a2e1h0;l,x;k,nnK;!cifX;kla,nt;b1w eng0;land;!r;a1co,i0t,uc;dKnn;libu,nhattS;a0gw,hr;s,x;an0ul;!s;a0cn,da,ndianMst;!x;arlem,kg,nd,wy;a2re0;at 0enwich;britain,lak6;!y village;co,l0ra;!a;urope,verglad2;ak,en,fw,ist,own4xb;al4dg,gk,hina3l2o1r0t;es;lo,nn;!t;town;!if;cn,e0kk,lvd,rooklyn;l air,verly hills;frica,lta,m5ntarct2r1sia,tl0ve;!ant1;ct0iz;ic0; oce0;an;ericas,s",
    "Country": "true¦0:38;1:2L;a2Wb2Dc21d1Xe1Rf1Lg1Bh19i13j11k0Zl0Um0Gn05om3CpZqat1JrXsKtCu6v4wal3yemTz2;a24imbabwe;es,lis and futu2X;a2enezue31ietnam;nuatu,tican city;.5gTkraiZnited 3ruXs2zbeE;a,sr;arab emirat0Kkingdom,states2;! of am2X;k.,s.2; 27a.;a7haBimor-les0Bo6rinidad4u2;nis0rk2valu;ey,me2Xs and caic1T; and 2-2;toba1J;go,kel0Ynga;iw2Vji2nz2R;ki2T;aCcotl1eBi8lov7o5pa2Bri lanka,u4w2yr0;az2ed9itzerl1;il1;d2Qriname;lomon1Vmal0uth 2;afr2IkLsud2O;ak0en0;erra leoEn2;gapo1Wt maart2;en;negKrb0ychellY;int 2moa,n marino,udi arab0;hele24luc0mart1Z;epublic of ir0Com2Cuss0w2;an25;a3eHhilippinTitcairn1Ko2uerto riM;l1rtugE;ki2Bl3nama,pua new0Tra2;gu6;au,esti2;ne;aAe8i6or2;folk1Gth3w2;ay; k2ern mariana1B;or0M;caragua,ger2ue;!ia;p2ther18w zeal1;al;mib0u2;ru;a6exi5icro09o2yanm04;ldova,n2roc4zamb9;a3gol0t2;enegro,serrat;co;c9dagascZl6r4urit3yot2;te;an0i14;shall0Vtin2;ique;a3div2i,ta;es;wi,ys0;ao,ed00;a5e4i2uxembourg;b2echtenste10thu1E;er0ya;ban0Gsotho;os,tv0;azakh1De2iriba02osovo,uwait,yrgyz1D;eling0Jnya;a2erF;ma15p1B;c6nd5r3s2taly,vory coast;le of m19rael;a2el1;n,q;ia,oI;el1;aiSon2ungary;dur0Mg kong;aAermany,ha0Pibralt9re7u2;a5ern4inea2ya0O;!-biss2;au;sey;deloupe,m,tema0P;e2na0M;ce,nl1;ar;bTmb0;a6i5r2;ance,ench 2;guia0Dpoly2;nes0;ji,nl1;lklandTroeT;ast tim6cu5gypt,l salv5ngl1quatorial3ritr4st2thiop0;on0; guin2;ea;ad2;or;enmark,jibou4ominica3r con2;go;!n B;ti;aAentral african 9h7o4roat0u3yprQzech2; 8ia;ba,racao;c3lo2morPngo-brazzaville,okFsta r03te d'ivoiK;mb0;osD;i2ristmasF;le,na;republic;m2naTpe verde,yman9;bod0ero2;on;aFeChut00o8r4u2;lgar0r2;kina faso,ma,undi;azil,itish 2unei;virgin2; is2;lands;liv0nai4snia and herzegoviGtswaGuvet2; isl1;and;re;l2n7rmuF;ar2gium,ize;us;h3ngladesh,rbad2;os;am3ra2;in;as;fghaFlCmAn5r3ustr2zerbaijH;al0ia;genti2men0uba;na;dorra,g4t2;arct6igua and barbu2;da;o2uil2;la;er2;ica;b2ger0;an0;ia;ni2;st2;an",
    "Region": "true¦0:1U;a20b1Sc1Id1Des1Cf19g13h10i0Xj0Vk0Tl0Qm0FnZoXpSqPrMsDtAut9v6w3y1zacatec22;o05u1;cat18kZ;a1est vi4isconsin,yomi14;rwick0shington1;! dc;er2i1;rgin1S;acruz,mont;ah,tar pradesh;a2e1laxca1DuscaA;nnessee,x1R;bas0Kmaulip1QsmJ;a6i4o2taf0Ou1ylh13;ffVrr00s0Y;me10no1Auth 1;cSdR;ber1Ic1naloa;hu0Sily;n2skatchew0Rxo1;ny; luis potosi,ta catari1I;a1hode7;j1ngp02;asth0Mshahi;inghai,u1;e1intana roo;bec,ensWreta0E;ara4e2rince edward1; isU;i,nnsylv1rnambu02;an14;!na;axa0Ndisha,h1klaho1Bntar1reg4x04;io;ayarit,eBo3u1;evo le1nav0L;on;r1tt0Rva scot0X;f6mandy,th1; 1ampton0;c3d2yo1;rk0;ako0Y;aroli0V;olk;bras0Xva01w1; 2foundland1;! and labrador;brunswick,hamp0jers1mexiJyork state;ey;a6i2o1;nta0Nrelos;ch3dlanBn2ss1;issippi,ouri;as geraGneso0M;igQoacQ;dhya,harasht04ine,ni3r1ssachusetts;anhao,y1;land;p1toba;ur;anca0e1incoln0ouis8;e1iH;ds;a1entucky,hul0A;ns08rnata0Dshmir;alis1iangxi;co;daho,llino2nd1owa;ia05;is;a2ert1idalEunA;ford0;mp0waii;ansu,eorgWlou5u1;an2erre1izhou,jarat;ro;ajuato,gdo1;ng;cester0;lori2uji1;an;da;sex;e4o2uran1;go;rs1;et;lawaErby0;a8ea7hi6o1umbrH;ahui4l3nnectic2rsi1ventry;ca;ut;iMorado;la;apEhuahua;ra;l8m1;bridge0peche;a5r4uck1;ingham0;shi1;re;emen,itish columb3;h2ja cal1sque,var2;iforn1;ia;guascalientes,l4r1;izo2kans1;as;na;a2ber1;ta;ba2s1;ka;ma",
    "FemaleName": "true¦0:FY;1:G2;2:FR;3:FD;4:FC;5:EP;6:ER;7:FS;8:GF;9:EZ;A:GB;B:E5;C:FO;D:FL;E:G8;F:EG;aE2bD4cB8dAIe9Gf91g8Hh83i7Sj6Uk60l4Om38n2To2Qp2Fqu2Er1Os0Qt04ursu6vUwOyLzG;aJeHoG;e,la,ra;lGna;da,ma;da,ra;as7EeHol1TvG;et5onB9;le0sen3;an9endBNhiB4iG;lInG;if3AniGo0;e,f39;a,helmi0lGma;a,ow;aMeJiG;cHviG;an9XenG1;kCZtor3;da,l8Vnus,rG;a,nGoniD2;a,iDC;leGnesEC;nDLrG;i1y;aSePhNiMoJrGu6y4;acG3iGu0E;c3na,sG;h9Mta;nHrG;a,i;i9Jya;a5IffaCGna,s7;al3eGomasi0;a,l8Go6Xres1;g7Uo6WrHssG;!a,ie;eFi,ri8;bNliMmKnIrHs7tGwa0;ia0um;a,yn;iGya;a,ka,s7;a4e4iGmCAra;!ka;a,t7;at7it7;a05carlet2Ye04hUiSkye,oQtMuHyG;bFJlvi1;e,sHzG;an2Tet5ie,y;anGi8;!a,e,nG;aDe;aIeG;fGl3DphG;an2;cF8r6;f3nGphi1;d4ia,ja,ya;er4lv3mon1nGobh75;dy;aKeGirlBLo0y6;ba,e0i6lIrG;iGrBPyl;!d70;ia,lBV;ki4nIrHu0w0yG;la,na;i,leAon,ron;a,da,ia,nGon;a,on;l5Yre0;bMdLi9lKmIndHrGs7vannaD;aDi0;ra,y;aGi4;nt7ra;lBNome;e,ie;in1ri0;a02eXhViToHuG;by,thBK;bQcPlOnNsHwe0xG;an94ie,y;aHeGie,lE;ann8ll1marBFtB;!lGnn1;iGyn;e,nG;a,d7W;da,i,na;an9;hel53io;bin,erByn;a,cGkki,na,ta;helBZki;ea,iannDXoG;da,n12;an0bIgi0i0nGta,y0;aGee;!e,ta;a,eG;cARkaD;chGe,i0mo0n5EquCDvCy0;aCCelGi9;!e,le;een2ia0;aMeLhJoIrG;iGudenAW;scil1Uyamva9;lly,rt3;ilome0oebe,ylG;is,lis;arl,ggy,nelope,r6t4;ige,m0Fn4Oo6rvaBBtHulG;a,et5in1;ricGsy,tA8;a,e,ia;ctav3deHfAWlGphAW;a,ga,iv3;l3t5;aQePiJoGy6;eHrG;aDeCma;ll1mi;aKcIkGla,na,s7ta;iGki;!ta;hoB2k8BolG;a,eBH;!mh;l7Tna,risF;dIi5PnHo23taG;li1s7;cy,et5;eAiCO;a01ckenz2eViLoIrignayani,uriBGyG;a,rG;a,na,tAS;i4ll9XnG;a,iG;ca,ka,qB4;a,chOkaNlJmi,nIrGtzi;aGiam;!n9;a,dy,erva,h,n2;a,dIi9JlG;iGy;cent,e;red;!e6;ae6el3G;ag4KgKi,lHrG;edi61isFyl;an2iGliF;nGsAM;a,da;!an,han;b08c9Ed06e,g04i03l01nZrKtJuHv6Sx87yGz2;a,bell,ra;de,rG;a,eC;h75il9t2;a,cSgOiJjor2l6In2s7tIyG;!aGbe5QjaAlou;m,n9S;a,ha,i0;!aIbALeHja,lEna,sGt53;!a,ol,sa;!l06;!h,m,nG;!a,e,n1;arIeHie,oGr3Kueri5;!t;!ry;et3IiB;elGi61y;a,l1;dGon,ue6;akranBy;iGlo36;a,ka,n9;a,re,s2;daGg2;!l2W;alEd2elGge,isBGon0;eiAin1yn;el,le;a0Ie08iWoQuKyG;d3la,nG;!a,dHe9SnGsAQ;!a,e9R;a,sAO;aB1cJelIiFlHna,pGz;e,iB;a,u;a,la;iGy;a2Ae,l25n9;is,l1GrHtt2uG;el6is1;aIeHi8na,rG;a6Zi8;lei,n1tB;!in1;aQbPd3lLnIsHv3zG;!a,be4Ket5z2;a,et5;a,dG;a,sGy;ay,ey,i,y;a,iaIlG;iGy;a8Ge;!n4F;b7Terty;!n5R;aNda,e0iLla,nKoIslARtGx2;iGt2;c3t3;la,nGra;a,ie,o4;a,or1;a,gh,laG;!ni;!h,nG;a,d4e,n4N;cNdon7Si6kes7na,rMtKurIvHxGy6;mi;ern1in3;a,eGie,yn;l,n;as7is7oG;nya,ya;a,isF;ey,ie,y;aZeUhadija,iMoLrIyG;lGra;a,ee,ie;istGy5B;a,en,iGy;!e,n48;ri,urtn9A;aMerLl99mIrGzzy;a,stG;en,in;!berlG;eGi,y;e,y;a,stC;!na,ra;el6PiJlInHrG;a,i,ri;d4na;ey,i,l9Qs2y;ra,s7;c8Wi5XlOma6nyakumari,rMss5LtJviByG;!e,lG;a,eG;e,i78;a5EeHhGi3PlEri0y;ar5Cer5Cie,leCr9Fy;!lyn73;a,en,iGl4Uyn;!ma,n31sF;ei72i,l2;a04eVilToMuG;anKdJliGst56;aHeGsF;!nAt0W;!n8X;i2Ry;a,iB;!anLcelEd5Vel71han6IlJni,sHva0yG;a,ce;eGie;fi0lEph4X;eGie;en,n1;!a,e,n36;!i10lG;!i0Z;anLle0nIrHsG;i5Qsi5Q;i,ri;!a,el6Pif1RnG;a,et5iGy;!e,f1P;a,e72iHnG;a,e71iG;e,n1;cLd1mi,nHqueliAsmin2Uvie4yAzG;min8;a8eHiG;ce,e,n1s;!lGsFt06;e,le;inHk2lEquelG;in1yn;da,ta;lPmNnMo0rLsHvaG;!na;aHiGob6U;do4;!belGdo4;!a,e,l2G;en1i0ma;a,di4es,gr5R;el9ogG;en1;a,eAia0o0se;aNeKilHoGyacin1N;ll2rten1H;aHdGlaH;a,egard;ry;ath0WiHlGnrietBrmiAst0W;en24ga;di;il75lKnJrGtt2yl75z6D;iGmo4Fri4G;etG;!te;aDnaD;ey,l2;aYeTiOlMold12rIwG;enGyne18;!dolE;acHetGisel9;a,chC;e,ieG;!la;adys,enGor3yn1Y;a,da,na;aJgi,lHna,ov71selG;a,e,le;da,liG;an;!n0;mYnIorgHrG;ald35i,m2Stru73;et5i5T;a,eGna;s1Nvieve;briel3Fil,le,rnet,yle;aReOio0loMrG;anHe9iG;da,e9;!cG;esHiGoi0G;n1s3V;!ca;!rG;a,en43;lHrnG;!an9;ec3ic3;rHtiGy8;ma;ah,rah;d0FileCkBl00mUn4ArRsMtLuKvG;aIelHiG;e,ta;in0Ayn;!ngel2H;geni1la,ni3R;h52ta;meral9peranJtG;eHhGrel6;er;l2Pr;za;iGma,nest29yn;cGka,n;a,ka;eJilImG;aGie,y;!liA;ee,i1y;lGrald;da,y;aTeRiMlLma,no4oJsIvG;a,iG;na,ra;a,ie;iGuiG;se;a,en,ie,y;a0c3da,nJsGzaH;aGe;!beG;th;!a,or;anor,nG;!a;in1na;en,iGna,wi0;e,th;aWeKiJoGul2U;lor51miniq3Yn30rGtt2;a,eCis,la,othGthy;ea,y;an09naDonAx2;anPbOde,eNiLja,lImetr3nGsir4U;a,iG;ce,se;a,iHla,orGphiA;es,is;a,l5J;dGrdG;re;!d4Mna;!b2CoraDra;a,d4nG;!a,e;hl3i0mMnKphn1rHvi1WyG;le,na;a,by,cHia,lG;a,en1;ey,ie;a,et5iG;!ca,el1Aka;arGia;is;a0Qe0Mh04i02lUoJrHynG;di,th3;istGy04;al,i0;lOnLrHurG;tn1D;aId28iGn28riA;!nG;a,e,n1;!l1S;n2sG;tanGuelo;ce,za;eGleC;en,t5;aIeoHotG;il4B;!pat4;ir8rIudG;et5iG;a,ne;a,e,iG;ce,sX;a4er4ndG;i,y;aPeMloe,rG;isHyG;stal;sy,tG;aHen,iGy;!an1e,n1;!l;lseHrG;!i8yl;a,y;nLrG;isJlHmG;aiA;a,eGot5;n1t5;!sa;d4el1PtG;al,el1O;cHlG;es5i3F;el3ilG;e,ia,y;iYlXmilWndVrNsLtGy6;aJeIhGri0;erGleCrEy;in1;ri0;li0ri0;a2GsG;a2Fie;a,iMlKmeIolHrG;ie,ol;!e,in1yn;lGn;!a,la;a,eGie,y;ne,y;na,sF;a0Di0D;a,e,l1;isBl2;tlG;in,yn;arb0CeYianXlVoTrG;andRePiIoHyG;an0nn;nwEok8;an2NdgKg0ItG;n27tG;!aHnG;ey,i,y;ny;etG;!t8;an0e,nG;da,na;i8y;bbi8nG;iBn2;ancGossom,ythe;a,he;ca;aRcky,lin9niBrNssMtIulaDvG;!erlG;ey,y;hHsy,tG;e,i0Zy8;!anG;ie,y;!ie;nGt7yl;adHiG;ce;et5iA;!triG;ce,z;a4ie,ra;aliy29b24d1Lg1Hi19l0Sm0Nn01rWsNthe0uJvIyG;anGes7;a,na;a,r25;drIgusHrG;el3;ti0;a,ey,i,y;hHtrG;id;aKlGt1P;eHi8yG;!n;e,iGy;gh;!nG;ti;iIleHpiB;ta;en,n1t5;an19elG;le;aYdWeUgQiOja,nHtoGya;inet5n3;!aJeHiGmI;e,ka;!mGt5;ar2;!belHliFmT;sa;!le;ka,sGta;a,sa;elGie;a,iG;a,ca,n1qG;ue;!t5;te;je6rea;la;!bHmGstas3;ar3;el;aIberHel3iGy;e,na;!ly;l3n9;da;aTba,eNiKlIma,yG;a,c3sG;a,on,sa;iGys0J;e,s0I;a,cHna,sGza;a,ha,on,sa;e,ia;c3is7jaIna,ssaIxG;aGia;!nd4;nd4;ra;ia;i0nHyG;ah,na;a,is,naD;c7da,leCmLnslKsG;haDlG;inGyW;g,n;!h;ey;ee;en;at7g2nG;es;ie;ha;aVdiSelLrG;eIiG;anLenG;a,e,ne;an0;na;aKeJiHyG;nn;a,n1;a,e;!ne;!iG;de;e,lEsG;on;yn;!lG;iAyn;ne;agaJbHiG;!gaI;ey,i8y;!e;il;ah",
    "WeekDay": "true¦fri2mon2s1t0wednesd3;hurs1ues1;aturd1und1;!d0;ay0;!s",
    "Month": "true¦aBdec9feb7j2mar,nov9oct1sep0;!t8;!o8;an3u0;l1n0;!e;!y;!u1;!ru0;ary;!em0;ber;pr1ug0;!ust;!il",
    "FirstName": "true¦aEblair,cCdevBj8k6lashawn,m3nelly,quinn,re2sh0;ay,e0iloh;a,lby;g1ne;ar1el,org0;an;ion,lo;as8e0r9;ls7nyatta,rry;am0ess1ude;ie,m0;ie;an,on;as0heyenne;ey,sidy;lex1ndra,ubr0;ey;is",
    "LastName": "true¦0:34;1:39;2:3B;3:2Y;4:2E;5:30;a3Bb31c2Od2Ee2Bf25g1Zh1Pi1Kj1Ek17l0Zm0Nn0Jo0Gp05rYsMtHvFwCxBy8zh6;a6ou,u;ng,o;a6eun2Uoshi1Kun;ma6ng;da,guc1Zmo27sh21zaR;iao,u;a7eb0il6o3right,u;li3Bs1;gn0lk0ng,tanabe;a6ivaldi;ssilj37zqu2;a9h8i2Go7r6sui,urn0;an,ynisJ;lst0Prr1Uth;at1Uomps1;kah0Vnaka,ylor;aEchDeChimizu,iBmiAo9t7u6zabo;ar2lliv2AzuE;a6ein0;l23rm0;sa,u3;rn4th;lva,mmo24ngh;mjon4rrano;midt,neid0ulz;ito,n7sa6to;ki;ch2dLtos,z;amBeag1Zi9o7u6;bio,iz,sD;b6dri1MgIj0Tme24osevelt,ssi,ux;erts,ins1;c6ve0F;ci,hards1;ir2os;aEeAh8ic6ow20;as6hl0;so;a6illips;m,n1T;ders5et8r7t6;e0Nr4;ez,ry;ers;h21rk0t6vl4;el,te0J;baBg0Blivei01r6;t6w1O;ega,iz;a6eils1guy5ix1owak,ym1E;gy,ka6var1K;ji6muW;ma;aEeCiBo8u6;ll0n6rr0Bssolini,ñ6;oz;lina,oKr6zart;al0Me6r0U;au,no;hhail4ll0;rci0ssi6y0;!er;eWmmad4r6tsu07;in6tin2;!o;aCe8i6op2uo;!n6u;coln,dholm;fe7n0Qr6w0J;oy;bv6v6;re;mmy,rs5u;aBennedy,imuAle0Lo8u7wo6;k,n;mar,znets4;bay6vacs;asY;ra;hn,rl9to,ur,zl4;aAen9ha3imen2o6u3;h6nYu3;an6ns1;ss1;ki0Es5;cks1nsse0D;glesi9ke8noue,shik7to,vano6;u,v;awa;da;as;aBe8itchcock,o7u6;!a3b0ghNynh;a3ffmann,rvat;mingw7nde6rN;rs1;ay;ns5rrQs7y6;asDes;an4hi6;moJ;a9il,o8r7u6;o,tierr2;ayli3ub0;m2nzal2;nd6o,rcia;hi;erAis9lor8o7uj6;ita;st0urni0;es;ch0;nand2;d7insteHsposi6vaL;to;is1wards;aCeBi9omin8u6;bo6rand;is;gu2;az,mitr4;ov;lgado,vi;nkula,rw7vi6;es,s;in;aFhBlarkAo6;h5l6op0rbyn,x;em7li6;ns;an;!e;an8e7iu,o6ristens5u3we;i,ng,u3w,y;!n,on6u3;!g;mpb7rt0st6;ro;ell;aBe8ha3lanco,oyko,r6yrne;ooks,yant;ng;ck7ethov5nnett;en;er,ham;ch,h8iley,rn6;es,i0;er;k,ng;dDl9nd6;ers6rA;en,on,s1;on;eks7iy8var2;ez;ej6;ev;ams",
    "MaleName": "true¦0:CE;1:BL;2:C2;3:BT;4:B5;5:9V;6:BZ;7:AT;8:BD;9:AX;A:AO;aB4bA8c97d87e7Gf6Yg6Gh5Wi5Ij4Lk4Bl3Rm2Pn2Eo28p22qu20r1As0Qt06u05v00wNxavi3yGzB;aBor0;cBh8Ine;hCkB;!aB1;ar51eB0;ass2i,oCuB;sDu25;nEsDusB;oBsC;uf;ef;at0g;aJeHiCoByaAP;lfgang,odrow;lBn1O;bDey,frBJlB;aA5iB;am,e,s;e89ur;i,nde5sB;!l7t1;de,lCrr6yB;l1ne;lBt3;a93y;aEern1iB;cCha0nceBrg9Bva0;!nt;ente,t5A;lentin49n8Yughn;lyss4Msm0;aTeOhKiIoErCyB;!l3ro8s1;av9QeBist0oy,um0;nt9Iv54y;bDd7XmBny;!as,mBoharu;aAYie,y;i83y;mBt9;!my,othy;adDeoCia7DomB;!as;!do7M;!de9;dErB;en8HrB;an8GeBy;ll,n8F;!dy;dgh,ic9Tnn3req,ts45;aRcotPeNhJiHoFpenc3tBur1Oylve8Hzym1;anDeBua7B;f0phAFvBwa7A;e57ie;!islaw,l7;lom1nA3uB;leyma8ta;dBl7Jm1;!n7;aDeB;lBrm0;d1t1;h6Sne,qu0Uun,wn,y8;aBbasti0k1Xl41rg40th,ymo9I;m9n;!tB;!ie,y;lCmBnti21q4Iul;!mAu4;ik,vato6V;aWeShe92iOoFuCyB;an,ou;b6LdCf9pe6QssB;!elAI;ol2Uy;an,bIcHdGel,geFh0landA9mEnDry,sCyB;!ce;coe,s;!a95nA;an,eo;l3Jr;e4Qg3n7olfo,ri68;co,ky;bAe9U;cBl7;ar5Oc5NhCkBo;!ey,ie,y;a85ie;gCid,ub6x,yBza;ansh,nS;g8WiB;na8Ss;ch5Yfa4lDmCndBpha4sh6Uul,ymo70;al9Yol2By;i9Ion;f,ph;ent2inB;cy,t1;aFeDhilCier62ol,reB;st1;!ip,lip;d9Brcy,tB;ar,e2V;b3Sdra6Ft44ul;ctav2Vliv3m96rFsCtBum8Uw6;is,to;aCc8SvB;al52;ma;i,l49vJ;athJeHiDoB;aBel,l0ma0r2X;h,m;cCg4i3IkB;h6Uola;hol5XkBol5X;!ol5W;al,d,il,ls1vB;il50;anBy;!a4i4;aWeTiKoFuCyB;l21r1;hamCr5ZstaB;fa,p4G;ed,mF;dibo,e,hamDis1XntCsBussa;es,he;e,y;ad,ed,mB;ad,ed;cGgu4kElDnCtchB;!e5;a78ik;house,o03t1;e,olB;aj;ah,hBk7;a4eB;al,l;hClv2rB;le,ri5v2;di,met;ck,hNlLmOnu4rHs1tDuricCxB;!imilian8Cwe5;e,io;eo,hCi52tB;!eo,hew,ia;eBis;us,w;cDio,k86lCqu6Gsha5tBv2;i2Hy;in,on;!el,oKus;achBcolm,ik;ai,y;amBdi,moud;adB;ou;aReNiMlo2RoIuCyB;le,nd1;cEiDkBth3;aBe;!s;gi,s;as,iaB;no;g0nn6RrenDuBwe5;!iB;e,s;!zo;am,on4;a7Bevi,la4SnDoBst3vi;!nB;!a60el;!ny;mCnBr67ur4Twr4T;ce,d1;ar,o4N;aIeDhaled,iBrist4Vu48y3B;er0p,rB;by,k,ollos;en0iEnBrmit,v2;!dCnBt5C;e0Yy;a5ri4N;r,th;na68rBthem;im,l;aYeQiOoDuB;an,liBst2;an,o,us;aqu2eJhnInGrEsB;eChBi7Bue;!ua;!ph;dBge;an,i,on;!aBny;h,s,th4X;!ath4Wie,nA;!l,sBy;ph;an,e,mB;!mA;d,ffGrDsB;sBus;!e;a5JemCmai8oBry;me,ni0O;i6Uy;!e58rB;ey,y;cHd6kGmFrDsCvi3yB;!d6s1;on,p3;ed,od,rBv4M;e4Zod;al,es,is1;e,ob,ub;k,ob,quB;es;aNbrahMchika,gKkeJlija,nuIrGsDtBv0;ai,sB;uki;aBha0i6Fma4sac;ac,iaB;h,s;a,vinBw2;!g;k,nngu52;!r;nacBor;io;im;in,n;aJeFina4VoDuByd56;be25gBmber4CsD;h,o;m3ra33sBwa3X;se2;aDctCitCn4ErB;be20m0;or;th;bKlJmza,nIo,rDsCyB;a43d6;an,s0;lEo4FrDuBv7;hi40ki,tB;a,o;is1y;an,ey;k,s;!im;ib;aQeMiLlenKoIrEuB;illerCsB;!tavo;mo;aDegBov3;!g,orB;io,y;dy,h57nt;nzaBrd1;lo;!n;lbe4Qno,ovan4R;ne,oDrB;aBry;ld,rd4U;ffr7rge;bri4l6rBv2;la1Zr3Eth,y;aReNiLlJorr0IrB;anDedBitz;!dAeBri24;ri23;cDkB;!ie,lB;in,yn;esJisB;!co,zek;etch3oB;yd;d4lBonn;ip;deriDliCng,rnB;an01;pe,x;co;bi0di;arZdUfrTit0lNmGnFo2rCsteb0th0uge8vBym6zra;an,ere2V;gi,iCnBrol,v2w2;est45ie;c07k;och,rique,zo;aGerFiCmB;aFe2P;lCrB;!h0;!io;s1y;nu4;be09d1iEliDmCt1viBwood;n,s;er,o;ot1Ts;!as,j43sB;ha;a2en;!dAg32mEuCwB;a25in;arB;do;o0Su0S;l,nB;est;aYeOiLoErDuCwByl0;ay8ight;a8dl7nc0st2;ag0ew;minFnDri0ugCyB;le;!l03;!a29nBov0;e5ie,y;go,icB;!k;armuCeBll1on,rk;go;id;anIj0lbeHmetri9nFon,rEsDvCwBxt3;ay8ey;en,in;hawn,mo08;ek,ri0F;is,nBv3;is,y;rt;!dB;re;lKmInHrDvB;e,iB;!d;en,iDne5rByl;eBin,yl;l2Vn;n,o,us;!e,i4ny;iBon;an,en,on;e,lB;as;a06e04hWiar0lLoGrEuCyrB;il,us;rtB;!is;aBistobal;ig;dy,lEnCrB;ey,neli9y;or,rB;ad;by,e,in,l2t1;aGeDiByI;fBnt;fo0Ct1;meCt9velaB;nd;nt;rDuCyB;!t1;de;enB;ce;aFeErisCuB;ck;!tB;i0oph3;st3;d,rlBs;eBie;s,y;cBdric,s11;il;lEmer1rB;ey,lCro5y;ll;!os,t1;eb,v2;ar02eUilTlaSoPrCuByr1;ddy,rtI;aJeEiDuCyB;an,ce,on;ce,no;an,ce;nCtB;!t;dCtB;!on;an,on;dCndB;en,on;!foBl7y;rd;bCrByd;is;!by;i8ke;al,lA;nFrBshoi;at,nCtB;!r10;aBie;rd0S;!edict,iCjam2nA;ie,y;to;n7rBt;eBy;tt;ey;ar0Xb0Nd0Jgust2hm0Gid6ja0ElZmXnPputsiOrFsaEuCveBya0ziz;ry;gust9st2;us;hi;aIchHi4jun,maFnDon,tBy0;hBu06;ur;av,oB;ld;an,nd0A;el;ie;ta;aq;dGgel05tB;hoEoB;i8nB;!i02y;ne;ny;reBy;!as,s,w;ir,mBos;ar;an,beOd6eIfFi,lEonDphonHt1vB;aMin;on;so,zo;an,en;onCrB;edP;so;c,jaEksandDssaExB;!and3;er;ar,er;ndB;ro;rtH;ni;en;ad,eB;d,t;in;aColfBri0vik;!o;mBn;!a;dFeEraCuB;!bakr,lfazl;hBm;am;!l;allEel,oulaye,ulB;!lCrahm0;an;ah,o;ah;av,on",
    "Person": "true¦ashton kutchSbRcMdKeIgastNhGinez,jEkDleCmBnettJoAp8r4s3t2v0;a0irgin maG;lentino rossi,n go3;heresa may,iger woods,yra banks;addam hussain,carlett johanssJlobodan milosevic,uB;ay romano,eese witherspoIo1ush limbau0;gh;d stewart,nald0;inho,o;a0ipJ;lmIris hiltD;prah winfrFra;essiaen,itt romnEubarek;bron james,e;anye west,iefer sutherland,obe bryant;aime,effers8k rowli0;ng;alle ber0itlBulk hogan;ry;ff0meril lagasse,zekiel;ie;a0enzel washingt2ick wolf;lt1nte;ar1lint0ruz;on;dinal wols1son0;! palm2;ey;arack obama,rock;er",
    "Verb": "true¦awak9born,cannot,fr8g7h5k3le2m1s0wors9;e8h3;ake sure,sg;ngth6ss6;eep tabs,n0;own;as0e2;!t2;iv1onna;ight0;en",
    "PhrasalVerb": "true¦0:72;1:6Q;2:7E;3:74;4:6J;5:7H;6:76;7:6P;8:6C;9:6D;A:5I;B:71;C:70;a7Hb63c5Dd5Ae58f46g3Oh38iron0j34k2Zl2Km2Bn29o27p1Pr1Es09tQuOvacuum 1wGyammerCzD;eroAip EonD;e0k0;by,up;aJeGhFiEorDrit53;d 1k2R;mp0n4Ape0r8s8;eel Bip 7L;aEiD;gh 06rd0;n Br 3D;it 5Kk8lk6rm 0Qsh 74t67v4P;rgeCsD;e 9herA;aRePhNiJoHrFuDype 0N;ckArn D;d2in,o3Gup;ade YiDot0y 28;ckle68p 7A;ne67p Ds4D;d2o6Lup;ck FdEe Dgh5Tme0p o0Dre0;aw3ba4d2in,up;e5Ky 1;by,o6V;ink Drow 5V;ba4ov7up;aDe 4Ill4O;m 1r W;ckCke Elk D;ov7u4O;aDba4d2in,o31up;ba4ft7p4Tw3;a0Gc0Fe09h05i02lYmXnWoVpSquare RtJuHwD;earFiD;ngEtch D;aw3ba4o6P; by;ck Dit 1m 1ss0;in,up;aIe0RiHoFrD;aigh1MiD;ke 5Yn2Y;p Drm1P;by,in,o6B;n2Zr 1tc3I;c2Ymp0nd Dr6Hve6y 1;ba4d2up;d2o67up;ar2Vell0ill4UlErDurC;ingCuc8;a33it 3U;be4Crt0;ap 4Eow B;ash 4Zoke0;eep EiDow 9;c3Np 1;in,oD;ff,v7;gn Eng2Zt Dz8;d2o5up;in,o5up;aFoDu4F;ot Dut0w 5X;aw3ba4f37o5R;c2FdeAk4Sve6;e Hll0nd GtD; Dtl43;d2in,o5upD;!on;aw3ba4d2in,o1Yup;o5to;al4Lout0rap4L;il6v8;at0eKiJoGuD;b 4Ele0n Dstl8;aDba4d2in53o3Gt30u3E;c1Xw3;ot EuD;g2Knd6;a1Xf2Ro5;ng 4Op6;aDel6inAnt0;c4Yd D;o2Tu0C;aQePiOlMoKrHsyc2AuD;ll Ft D;aDba4d2in,o1Ht34up;p39w3;ap38d2in,o5t32up;attleCess EiGoD;p 1;ah1Hon;iDp 53re3Mur45wer 53;nt0;ay3ZuD;gAmp 9;ck 53g0leCn 9p3W;el 47ncilA;c3Pir 2In0ss FtEy D;ba4o4R; d2c1Y;aw3ba4o12;pDw3K;e3Jt B;arrow3Terd0oD;d6te3S;aJeHiGoEuD;ddl8ll37;c17p 1uth6ve D;al3Bd2in,o5up;ss0x 1;asur8lt 9ss D;a1Aup;ke Dn 9r30s1Lx0;do,o3Yup;aPeNiIoDuck0;a17c37g GoDse0;k Dse35;aft7ba4d2forw2Bin3Wov7uD;nd7p;in,o0J;e GghtFnEsDv1T;ten 4D;e 1k 1; 1e2Y;ar43d2;av1Ht 2YvelD; o3L;p 1sh DtchCugh6y1U;in3Lo5;eEick6nock D;d2o3H;eDyA;l2Hp D;aw3ba4d2fSin,o05to,up;aFoEuD;ic8mpA;ke2St2W;c31zz 1;aPeKiHoEuD;nker2Ts0U;lDneArse2O;d De 1;ba4d2fast,oZup;de Et D;ba4on,up;aw3o5;aDlp0;d Fl22r Dt 1;fDof;rom;in,oRu1A;cZm 1nDve it,ze1Y;d Dg 27kerF;d2in,o5;aReLive Jloss1VoFrEunD; f0M;in39ow 23; Dof 0U;aEb17it,oDr35t0Ou12;ff,n,v7;bo5ft7hJw3;aw3ba4d2in,oDup,w3;ff,n,ut;a17ek0t D;aEb11d2oDr2Zup;ff,n,ut,v7;cEhDl1Pr2Xt,w3;ead;ross;d aEnD;g 1;bo5;a08e01iRlNoJrFuD;cDel 1;k 1;eEighten DownCy 1;aw3o2L;eDshe1G; 1z8;lFol D;aDwi19;bo5r2I;d 9;aEeDip0;sh0;g 9ke0mDrD;e 2K;gLlJnHrFsEzzD;le0;h 2H;e Dm 1;aw3ba4up;d0isD;h 1;e Dl 11;aw3fI;ht ba4ure0;eInEsD;s 1;cFd D;fDo1X;or;e B;dQl 1;cHll Drm0t0O;apYbFd2in,oEtD;hrough;ff,ut,v7;a4ehi1S;e E;at0dge0nd Dy8;o1Mup;o09rD;ess 9op D;aw3bNin,o15;aShPlean 9oDross But 0T;me FoEuntD; o1M;k 1l6;aJbIforGin,oFtEuD;nd7;ogeth7;ut,v7;th,wD;ard;a4y;pDr19w3;art;eDipA;ck BeD;r 1;lJncel0rGsFtch EveA; in;o16up;h Bt6;ry EvD;e V;aw3o12;l Dm02;aDba4d2o10up;r0Vw3;a0He08l01oSrHuD;bbleFcklTilZlEndlTrn 05tDy 10zz6;t B;k 9; ov7;anMeaKiDush6;ghHng D;aEba4d2forDin,o5up;th;bo5lDr0Lw3;ong;teD;n 1;k D;d2in,o5up;ch0;arKgJil 9n8oGssFttlEunce Dx B;aw3ba4;e 9; ar0B;k Bt 1;e 1;d2up; d2;d 1;aIeed0oDurt0;cFw D;aw3ba4d2o5up;ck;k D;in,oK;ck0nk0st6; oJaGef 1nd D;d2ov7up;er;up;r0t D;d2in,oDup;ff,ut;ff,nD;to;ck Jil0nFrgEsD;h B;ainCe B;g BkC; on;in,o5; o5;aw3d2o5up;ay;cMdIsk Fuction6; oD;ff;arDo5;ouD;nd;d D;d2oDup;ff,n;own;t D;o5up;ut",
    "Modal": "true¦c5lets,m4ought3sh1w0;ill,o5;a0o4;ll,nt;! to;ay,ight,ust;an,o0;uld",
    "Adjective": "true¦0:75;1:7K;2:7Q;3:7J;4:7C;5:5C;6:48;7:49;8:4S;9:61;A:7H;B:70;C:6Z;D:73;E:5X;a6Jb65c5Rd57e4Tf49g41h3Qi35j33k32l2Rm2Gn27o1Rp1Aquack,r10s0Gt09uQvNwFyear5;arp0eJholeIiHoF;man5oFu6C;d6Ezy;despr75s5G;!sa7;eGlFste26;co1Il o4L;!k5;aGiFola4B;b7Tce versa,ol55;ca2gabo63nilla;ltWnJpGrb5Asu4tterF;!moC; f34b1OpGsFti1H;ca7et,ide dMtairs;er,i3N;aPbeco6Rconvin27deMeLfair,ivers4knKprecedYrIsGwF;iel20ritt5Z;i1VuF;pervis0specti3;eFu5;cognLgul6Hl6H;own;ndi3v5Txpect0;cid0rF;!grou5OsF;iz0tood;b7ppeaLssu6GuthorF;iz0;i24ra;aJeHhough4PoGrF;i1oubl0;geth8p,rpB;en5QlFm50rr2Ust0;li3;boo,lFn;ent0;aXcWeUhTiRmug,nobbi3EoPpOqueami3EtJuFymb64;bHi gener55pFrprisi3;erFre0L;! dup8b,i29;du0seq4U;anda6UeIi0PrFy38;aightFip0; fFfF;or5B;adfaCreotyp0;aEec2Gir1JlendBot on; call0le,mb8phist1XrFu0Xvi42;dBry;gnifica2nF;ceEg7;am2Pe8ocki3ut;cFda1em5lfi2Yni1Wpa69re6;o1Gr3W;at58ient28reec58;cr0me,ns serif;aMeIiGoF;buCtt4UuSy4;ghtFv4;!-29f9;ar,bel,condi1du63fres52lHpublic3WsFtard0;is48oF;lu1na2;e1Euc46;bBciF;al,st;aQeOicayu6lacBopuliCrGuF;bl5Amp0;eJiGoF;!b0AfuDmi32p8;mGor,sFva1;ti6;a4We;ciDmF;a0IiF;er,um;ac20rFti1;feAma2Uplexi3v34;rFst;allelHtF;-tiFi4;me;!ed;bQffOkNld fashion0nMpLrg1Hth8utKvF;al,erF;!aHniGt,wF;eiFrouF;ght;ll;do0Ver,g2Msi46;en,posi1; boa5Gg2Kli6;!ay; gua5EbFli6;eat;eHsF;cFer0Hole1;e6uE;d2Tse;ak0eMiLoFua4P;nJrGtF;ab7;thF;!eF;rn;chala2descri50stop;ght5;arby,cessa3Xighbor5xt;aNeLiIoFultip7;bi7derGlFnth5ot,st;dy;a1n;nFx0;iaFor;tuE;di4FnaFre;ci3;cFgenta,in,j03keshift,le,mmoth,ny,sculi6;abEho;aOeJiGoFu13;uti12vi3;mGteraF;l,te;it0;ftIgFth4;al,eGitiF;ma1;nda3D;!-0C;nguBst,tt8;ap1Tind5no0A;agg0uF;niOstifi0veni7;de4gno4Clleg4mSnHpso 1WrF;a1releF;va2; NaMbr0corLdJfluenTiTnIsHtF;aAenDoxF;ic37;a6i2S;a1er,oce2;iGoF;or;reA;deq3Kppr2Z;fFsitu,vitro;ro2;mJpF;arHerfeAoFrop8;li1rtF;a2ed;ti4;eFi0R;d2RnD;aKelJiHoFumdr3C;neCok0rrFs07ur5;if2T;ghfalut1PspF;an2R;liZpf9;lInHrF;d05roF;wi3;dy,gi3;f,low0;ainf9ener2Kiga23lLoKraHuF;ilFng ho;ty;cGtF;ef9is;ef9;ne,od;ea2Eob4;aUeOinNlMoHrF;a1UeFoz1L;e2Eq13tf9;oHrF; keeps,eFm8tuna1;g05ign;liF;sh;ag30ue2;al,i1;dJmGrF;ti7;a7ini6;ne;le; up;bl0i2lDr Gux,voF;ri1uri1;oFreac1F;ff;aOfficie2lNmiMnKreAthere4veJxF;aAcess,peHtraGuF;be2Ml0I;!va1E;ct0rt;n,ryday; Fcouragi3tiE;rou1sui1;ne2;abo23dQe18i1;g8sF;t,ygF;oi3;er;aVeNiHoFrea15ue;mina2ne,ubF;le,tf9;dact1Bfficu1OsGvF;erD;creHeas0gruntl0honeCordGtF;a2ress0;er5;et; LadpKfJgene1PliHrang0spe1PtGvoF;ut;ail0ermin0;be1Mca1ghF;tf9;ia2;an;facto;i5magFngeroZs0I;ed,i3;ly;ertaRhief,ivil,oHrF;aFowd0u0H;mp0v02z0;loNmLnGoi3rrFve0P;eAu1I;cre1grIsHtF;emFra0F;po0D;ta2;ue2;mer08pleF;te,x;ni4ss4;in;aPeLizarElJoGrF;and new,isk,okP;gGna fiWttom,urgeoF;is;us;ank,iI;re;autif9hiGlov0nFst,yoG;eVt;nd;ul;ckGnkru0XrrF;en;!wards; priori,b0Nc0Kd0AfraBg05h04lZma06ntiquYpUrOsMttracti07utheLvIwF;aGkF;wa0U;ke,re;ant garGerF;age;de;ntV;leep,tonisF;hi3;ab,bitIroHtiF;fiF;ci4;ga2;raF;ry;pFt;are2etiPrF;oprF;ia1;at0;arIcohGeFiMl,oof;rt;olF;ic;mi3;ead;ainCgressiGoniF;zi3;ve;st;id; MeKuJvF;aGerD;se;nc0;ed;lt;pt,qF;ua1;hoc,infinitF;um;cuGtu4u1;al;ra1;erPlOoMruLsGuF;nda2;e2oGtraA;ct;lu1rbi3;ng;te;pt;aFve;rd;aze,e;ra2;nt",
    "Comparable": "true¦0:40;1:4H;2:44;3:4A;4:2X;5:3W;a4Nb43c3Nd3Ce34f2Qg2Eh23i1Uj1Tk1Ql1Hm1Bn15o13p0Tqu0Rr0IsRtKuIvFw7y6za11;ell26ou3;aBe9hi1Xi7r6;o3y;ck0Mde,l6n1ry,se;d,y;a6i4Lt;k,ry;n1Sr6sI;m,y;a7e6ulgar;nge5rda2xi3;gue,in,st;g0n6pco3Lse5;like0ti1;aAen9hi8i7ough,r6;anqu2Pen1ue;dy,g3Tme0ny,r09;ck,n,rs2Q;d41se;ll,me,rt,s6wd46;te5;aVcarUeThRiQkin0FlMmKoHpGqua1GtAu7w6;eet,ift;b7dd14per0Gr6;e,re2I;sta2Gt4;aAe9iff,r7u6;pXr1;a6ict,o3;ig3Gn0V;a1ep,rn;le,rk;e23i3Gright0;ci29ft,l7o6re,ur;n,thi3;emn,id;a6el0ooth;ll,rt;e8i6ow,y;ck,g36m6;!y;ek,nd3E;ck,l0mp4;a6iTort,rill,y;dy,ll0Yrp;cu0Sve0Sxy;ce,ed,y;d,fe,int0l1Wv15;aBe9i8o6ude;mantic,o1Jsy,u6;gh,nd;ch,pe,tzy;a6d,mo0I;dy,l;gg7ndom,p6re,w;id;ed;ai2i6;ck,et;aEhoDi1RlCoBr8u6;ny,r6;e,p4;egna2ic7o6;fouZud;ey,k0;li05or,te1C;ain,easa2;ny;in5le;dd,f6i0ld,ranR;fi11;aAe8i7o6;b4isy,rm16sy;ce,mb4;a6w;r,t;ive,rr02;aAe8ild,o7u6;nda1Ate;ist,o1;a6ek,llY;n,s0ty;d,tuR;aCeBi9o6ucky;f0Vn7o1Eu6ve0w18y0U;d,sy;e0g;g1Uke0tt4v6;e0i3;an,wd;me,r6te;ge;e7i6;nd;en;ol0ui1P;cy,ll,n6;sBt6;e6ima8;llege2r6;es7media6;te;ti3;ecu6ta2;re;aEeBiAo8u6;ge,m6ng1R;b4id;ll6me0t;ow;gh,l0;a6f04sita2;dy,v6;en0y;nd1Hppy,r6te5;d,sh;aGenFhDiClBoofy,r6;a9e8is0o6ue1E;o6ss;vy;at,en,y;nd,y;ad,ib,ooI;a2d1;a6o6;st0;t4uiY;u1y;aIeeb4iDlat,oAr8u6;ll,n6r14;!ny;aHe6iend0;e,sh;a7r6ul;get5mG;my;erce8n6rm,t;an6e;ciC;! ;le;ir,ke,n0Fr,st,t,ulA;aAerie,mp9sse7v6xtre0Q;il;nti6;al;ty;r7s6;tern,y;ly,th0;aFeCi9r7u6;ll,mb;u6y;nk;r7vi6;ne;e,ty;a6ep,nD;d6f,r;!ly;mp,pp03rk;aHhDlAo8r7u6;dd0r0te;isp,uel;ar6ld,mmon,ol,st0ward0zy;se;e6ou1;a6vW;n,r;ar8e6il0;ap,e6;sy;mi3;gey,lm8r6;e5i3;ful;!i3;aNiLlIoEr8u6;r0sy;ly;aAi7o6;ad,wn;ef,g7llia2;nt;ht;sh,ve;ld,r7un6;cy;ed,i3;ng;a7o6ue;nd,o1;ck,nd;g,tt6;er;d,ld,w1;dy;bsu9ng8we6;so6;me;ry;rd",
    "TextValue": "true¦bMeIfChundredNmMnin9one,qu8s6t0zeroN;enMh3rLw0;e0o;l0ntC;fGve;ir0ousandIree;d,t5;e0ix7;cond,ptEven6xtE;adrDintD;e0th;!t0;e9ie8y;i3o0;rt1ur0;!t2;ie4y;ft0rst,ve;e3h,ie2y;ight0lev2;!e1h,ie0y;th;en1;illion0;!th",
    "Ordinal": "true¦bGeDf9hundredHmGnin7qu6s4t0zeroH;enGh1rFwe0;lfFn9;ir0ousandE;d,t4;e0ixt9;cond,ptAvent8xtA;adr9int9;et0th;e6ie8;i2o0;r0urt3;tie5;ft1rst;ight0lev1;e0h,ie2;en1;illion0;th",
    "Cardinal": "true¦bGeDf7hundred,mGnine9one,qu6s4t0zero;en,h2rFw0;e0o;lve,n7;irt8ousand,ree;e0ix4;ptAven3xtA;adr9int9;i3o0;r1ur0;!t2;ty;ft0ve;e2y;ight0lev1;!e0y;en;illion",
    "Expression": "true¦a02b01dXeVfuck,gShLlImHnGoDpBshAtsk,u7voi04w3y0;a1eLu0;ck,p;!a,hoo,y;h1ow,t0;af,f;e0oa;e,w;gh,h0;! 0h,m;huh,oh;eesh,hh,it;ff,hew,l0sst;ease,z;h1o0w,y;h,o,ps;!h;ah,ope;eh,mm;m1ol0;!s;ao,fao;a4e2i,mm,oly1urr0;ah;! mo6;e,ll0y;!o;ha0i;!ha;ah,ee,o0rr;l0odbye;ly;e0h,t cetera,ww;k,p;'oh,a0uh;m0ng;mit,n0;!it;ah,oo,ye; 1h0rgh;!em;la",
    "Adverb": "true¦a07by 05d01eYfShQinPjustOkinda,mMnJoEpCquite,r9s5t2up1very,w0Bye0;p,s; to,wards5;h1o0wiO;o,t6ward;en,us;everal,o0uch;!me1rt0; of;hXtimes,w07;a1e0;alS;ndomRthN;ar excellDer0oint blank; Mhaps;f3n0;ce0ly;! 0;ag00moU; courHten;ewJo0; longEt 0;onHwithstanding;aybe,eanwhiAore0;!ovB;! aboS;deed,steT;en0;ce;or2u0;l9rther0;!moH; 0ev3;examp0good,suF;le;n mas1v0;er;se;e0irect1; 1finite0;ly;ju7trop;far,n0;ow; CbroBd nauseam,gAl5ny2part,side,t 0w3;be5l0mo5wor5;arge,ea4;mo1w0;ay;re;l 1mo0one,ready,so,ways;st;b1t0;hat;ut;ain;ad;lot,posteriori",
    "Preposition": "true¦'o,-,aKbHcGdFexcept,fEinDmidPnotwithstandiQoBpRqua,sAt6u3vi2w0;/o,hereMith0;!in,oQ;a,s-a-vis;n1p0;!on;like,til;h0ill,owards;an,r0;ough0u;!oI;ans,ince,o that;',f0n1ut;!f;!to;or,rom;espite,own,u3;hez,irca;ar1e0oAy;low,sides,tween;ri6;',bo7cross,ft6lo5m3propos,round,s1t0;!op;! long 0;as;id0ong0;!st;ng;er;ut",
    "Determiner": "true¦aAboth,d8e5few,l3mu7neiCown,plenty,some,th2various,wh0;at0ich0;evB;at,e3is,ose;a,e0;!ast,s;a1i6l0nough,very;!se;ch;e0u;!s;!n0;!o0y;th0;er"
  };

  var entity = ['Person', 'Place', 'Organization'];
  var nouns = {
    Noun: {
      notA: ['Verb', 'Adjective', 'Adverb']
    },
    // - singular
    Singular: {
      isA: 'Noun',
      notA: 'Plural'
    },
    //a specific thing that's capitalized
    ProperNoun: {
      isA: 'Noun'
    },
    // -- people
    Person: {
      isA: ['ProperNoun', 'Singular'],
      notA: ['Place', 'Organization', 'Date']
    },
    FirstName: {
      isA: 'Person'
    },
    MaleName: {
      isA: 'FirstName',
      notA: ['FemaleName', 'LastName']
    },
    FemaleName: {
      isA: 'FirstName',
      notA: ['MaleName', 'LastName']
    },
    LastName: {
      isA: 'Person',
      notA: ['FirstName']
    },
    Honorific: {
      isA: 'Noun',
      notA: ['FirstName', 'LastName']
    },
    // -- places
    Place: {
      isA: 'Singular',
      notA: ['Person', 'Organization']
    },
    Country: {
      isA: ['Place', 'ProperNoun'],
      notA: ['City']
    },
    City: {
      isA: ['Place', 'ProperNoun'],
      notA: ['Country']
    },
    Region: {
      isA: ['Place', 'ProperNoun']
    },
    Address: {
      isA: 'Place'
    },
    //---Orgs---
    Organization: {
      isA: ['Singular', 'ProperNoun'],
      notA: ['Person', 'Place']
    },
    SportsTeam: {
      isA: 'Organization'
    },
    School: {
      isA: 'Organization'
    },
    Company: {
      isA: 'Organization'
    },
    // - plural
    Plural: {
      isA: 'Noun',
      notA: ['Singular']
    },
    //(not plural or singular)
    Uncountable: {
      isA: 'Noun'
    },
    Pronoun: {
      isA: 'Noun',
      notA: entity
    },
    //a word for someone doing something -'plumber'
    Actor: {
      isA: 'Noun',
      notA: entity
    },
    //a gerund-as-noun - 'swimming'
    Activity: {
      isA: 'Noun',
      notA: ['Person', 'Place']
    },
    //'kilograms'
    Unit: {
      isA: 'Noun',
      notA: entity
    },
    //'Canadians'
    Demonym: {
      isA: ['Noun', 'ProperNoun'],
      notA: entity
    },
    //`john's`
    Possessive: {
      isA: 'Noun' // notA: 'Pronoun',

    }
  };

  var verbs = {
    Verb: {
      notA: ['Noun', 'Adjective', 'Adverb', 'Value']
    },
    // walks
    PresentTense: {
      isA: 'Verb',
      notA: ['PastTense', 'Copula', 'FutureTense']
    },
    // neutral form - 'walk'
    Infinitive: {
      isA: 'PresentTense',
      notA: ['PastTense', 'Gerund']
    },
    // walking
    Gerund: {
      isA: 'PresentTense',
      notA: ['PastTense', 'Copula', 'FutureTense']
    },
    // walked
    PastTense: {
      isA: 'Verb',
      notA: ['FutureTense']
    },
    // will walk
    FutureTense: {
      isA: 'Verb'
    },
    // is
    Copula: {
      isA: 'Verb'
    },
    // would have
    Modal: {
      isA: 'Verb',
      notA: ['Infinitive']
    },
    // had walked
    PerfectTense: {
      isA: 'Verb',
      notA: 'Gerund'
    },
    Pluperfect: {
      isA: 'Verb'
    },
    // shown
    Participle: {
      isA: 'Verb'
    },
    // show up
    PhrasalVerb: {
      isA: 'Verb'
    },
    //'up' part
    Particle: {
      isA: 'PhrasalVerb'
    }
  };

  var values = {
    Value: {
      notA: ['Verb', 'Adjective', 'Adverb']
    },
    Ordinal: {
      isA: 'Value',
      notA: ['Cardinal']
    },
    Cardinal: {
      isA: 'Value',
      notA: ['Ordinal']
    },
    RomanNumeral: {
      isA: 'Cardinal',
      //can be a person, too
      notA: ['Ordinal', 'TextValue']
    },
    TextValue: {
      isA: 'Value',
      notA: ['NumericValue']
    },
    NumericValue: {
      isA: 'Value',
      notA: ['TextValue']
    },
    Money: {
      isA: 'Cardinal'
    },
    Percent: {
      isA: 'Value'
    }
  };

  var anything = ['Noun', 'Verb', 'Adjective', 'Adverb', 'Value'];
  var misc = {
    //--Adjectives--
    Adjective: {
      notA: ['Noun', 'Verb', 'Adverb', 'Value']
    },
    // adjectives that can conjugate
    Comparable: {
      isA: ['Adjective']
    },
    // better
    Comparative: {
      isA: ['Adjective']
    },
    // best
    Superlative: {
      isA: ['Adjective'],
      notA: ['Comparative']
    },
    NumberRange: {
      isA: ['Contraction']
    },
    Adverb: {
      notA: ['Noun', 'Verb', 'Adjective', 'Value']
    },
    // Dates:
    //not a noun, but usually is
    Date: {
      notA: ['Verb', 'Conjunction', 'Adverb', 'Preposition', 'Adjective']
    },
    Month: {
      isA: ['Date', 'Singular'],
      notA: ['Year', 'WeekDay', 'Time']
    },
    WeekDay: {
      isA: ['Date', 'Noun']
    },
    // '9:20pm'
    Time: {
      isA: ['Date'],
      notA: ['Value']
    },
    //glue
    Determiner: {
      notA: anything
    },
    Conjunction: {
      notA: anything
    },
    Preposition: {
      notA: anything
    },
    // what, who, why
    QuestionWord: {
      notA: ['Determiner']
    },
    // peso, euro
    Currency: {},
    // ughh
    Expression: {
      notA: ['Noun', 'Adjective', 'Verb', 'Adverb']
    },
    // dr.
    Abbreviation: {},
    // internet tags
    Url: {
      notA: ['HashTag', 'PhoneNumber', 'Verb', 'Adjective', 'Value', 'AtMention', 'Email']
    },
    PhoneNumber: {
      notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention', 'Email']
    },
    HashTag: {},
    AtMention: {
      isA: ['Noun'],
      notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'Email']
    },
    Emoji: {
      notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention']
    },
    Emoticon: {
      notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention']
    },
    Email: {
      notA: ['HashTag', 'Verb', 'Adjective', 'Value', 'AtMention']
    },
    //non-exclusive
    Auxiliary: {
      notA: ['Noun', 'Adjective', 'Value']
    },
    Acronym: {
      notA: ['Plural', 'RomanNumeral']
    },
    Negative: {
      notA: ['Noun', 'Adjective', 'Value']
    },
    // if, unless, were
    Condition: {
      notA: ['Verb', 'Adjective', 'Noun', 'Value']
    }
  };

  // i just made these up
  var colorMap = {
    Noun: 'blue',
    Verb: 'green',
    Negative: 'green',
    Date: 'red',
    Value: 'red',
    Adjective: 'magenta',
    Preposition: 'cyan',
    Conjunction: 'cyan',
    Determiner: 'cyan',
    Adverb: 'cyan'
  };
  /** add a debug color to some tags */

  var addColors = function addColors(tags) {
    Object.keys(tags).forEach(function (k) {
      if (colorMap[k]) {
        tags[k].color = colorMap[k];
        return;
      }

      tags[k].isA.some(function (t) {
        if (colorMap[t]) {
          tags[k].color = colorMap[t];
          return true;
        }

        return false;
      });
    });
    return tags;
  };

  var _color = addColors;

  var unique$2 = function unique(arr) {
    return arr.filter(function (v, i, a) {
      return a.indexOf(v) === i;
    });
  }; //add 'downward' tags (that immediately depend on this one)


  var inferIsA = function inferIsA(tags) {
    Object.keys(tags).forEach(function (k) {
      var tag = tags[k];
      var len = tag.isA.length;

      for (var i = 0; i < len; i++) {
        var down = tag.isA[i];

        if (tags[down]) {
          tag.isA = tag.isA.concat(tags[down].isA);
        }
      } // clean it up


      tag.isA = unique$2(tag.isA);
    });
    return tags;
  };

  var _isA = inferIsA;

  var unique$3 = function unique(arr) {
    return arr.filter(function (v, i, a) {
      return a.indexOf(v) === i;
    });
  }; // crawl the tag-graph and infer any conflicts
  // faster than doing this at tag-time


  var inferNotA = function inferNotA(tags) {
    var keys = Object.keys(tags);
    keys.forEach(function (k) {
      var tag = tags[k];
      tag.notA = tag.notA || [];
      tag.isA.forEach(function (down) {
        if (tags[down] && tags[down].notA) {
          // borrow its conflicts
          var notA = typeof tags[down].notA === 'string' ? [tags[down].isA] : tags[down].notA || [];
          tag.notA = tag.notA.concat(notA);
        }
      }); // any tag that lists us as a conflict, we conflict it back.

      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];

        if (tags[key].notA.indexOf(k) !== -1) {
          tag.notA.push(key);
        }
      } // clean it up


      tag.notA = unique$3(tag.notA);
    });
    return tags;
  };

  var _notA = inferNotA;

  // a lineage is all 'incoming' tags that have this as 'isA'
  var inferLineage = function inferLineage(tags) {
    var keys = Object.keys(tags);
    keys.forEach(function (k) {
      var tag = tags[k];
      tag.lineage = []; // find all tags with it in their 'isA' set

      for (var i = 0; i < keys.length; i++) {
        if (tags[keys[i]].isA.indexOf(k) !== -1) {
          tag.lineage.push(keys[i]);
        }
      }
    });
    return tags;
  };

  var _lineage = inferLineage;

  var validate = function validate(tags) {
    // cleanup format
    Object.keys(tags).forEach(function (k) {
      var tag = tags[k]; // ensure isA is an array

      tag.isA = tag.isA || [];

      if (typeof tag.isA === 'string') {
        tag.isA = [tag.isA];
      } // ensure notA is an array


      tag.notA = tag.notA || [];

      if (typeof tag.notA === 'string') {
        tag.notA = [tag.notA];
      }
    });
    return tags;
  }; // build-out the tag-graph structure


  var inferTags = function inferTags(tags) {
    // validate data
    tags = validate(tags); // build its 'down tags'

    tags = _isA(tags); // infer the conflicts

    tags = _notA(tags); // debug tag color

    tags = _color(tags); // find incoming links

    tags = _lineage(tags);
    return tags;
  };

  var inference = inferTags;

  var addIn = function addIn(obj, tags) {
    Object.keys(obj).forEach(function (k) {
      tags[k] = obj[k];
    });
  };

  var build = function build() {
    var tags = {};
    addIn(nouns, tags);
    addIn(verbs, tags);
    addIn(values, tags);
    addIn(misc, tags); // do the graph-stuff

    tags = inference(tags);
    return tags;
  };

  var tags = build();

  var seq = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      cache = seq.split("").reduce(function (n, o, e) {
    return n[o] = e, n;
  }, {}),
      toAlphaCode = function toAlphaCode(n) {
    if (void 0 !== seq[n]) return seq[n];
    var o = 1,
        e = 36,
        t = "";

    for (; n >= e; n -= e, o++, e *= 36) {
    }

    for (; o--;) {
      var _o = n % 36;

      t = String.fromCharCode((_o < 10 ? 48 : 55) + _o) + t, n = (n - _o) / 36;
    }

    return t;
  },
      fromAlphaCode = function fromAlphaCode(n) {
    if (void 0 !== cache[n]) return cache[n];
    var o = 0,
        e = 1,
        t = 36,
        r = 1;

    for (; e < n.length; o += t, e++, t *= 36) {
    }

    for (var _e = n.length - 1; _e >= 0; _e--, r *= 36) {
      var _t = n.charCodeAt(_e) - 48;

      _t > 10 && (_t -= 7), o += _t * r;
    }

    return o;
  };

  var encoding = {
    toAlphaCode: toAlphaCode,
    fromAlphaCode: fromAlphaCode
  },
      symbols = function symbols(n) {
    var o = new RegExp("([0-9A-Z]+):([0-9A-Z]+)");

    for (var e = 0; e < n.nodes.length; e++) {
      var t = o.exec(n.nodes[e]);

      if (!t) {
        n.symCount = e;
        break;
      }

      n.syms[encoding.fromAlphaCode(t[1])] = encoding.fromAlphaCode(t[2]);
    }

    n.nodes = n.nodes.slice(n.symCount, n.nodes.length);
  };

  var indexFromRef = function indexFromRef(n, o, e) {
    var t = encoding.fromAlphaCode(o);
    return t < n.symCount ? n.syms[t] : e + t + 1 - n.symCount;
  },
      toArray = function toArray(n) {
    var o = [],
        e = function e(t, r) {
      var s = n.nodes[t];
      "!" === s[0] && (o.push(r), s = s.slice(1));
      var c = s.split(/([A-Z0-9,]+)/g);

      for (var _s = 0; _s < c.length; _s += 2) {
        var u = c[_s],
            i = c[_s + 1];
        if (!u) continue;
        var l = r + u;

        if ("," === i || void 0 === i) {
          o.push(l);
          continue;
        }

        var f = indexFromRef(n, i, t);
        e(f, l);
      }
    };

    return e(0, ""), o;
  },
      unpack = function unpack(n) {
    var o = {
      nodes: n.split(";"),
      syms: [],
      symCount: 0
    };
    return n.match(":") && symbols(o), toArray(o);
  };

  var unpack_1 = unpack,
      unpack_1$1 = function unpack_1$1(n) {
    var o = n.split("|").reduce(function (n, o) {
      var e = o.split("¦");
      return n[e[0]] = e[1], n;
    }, {}),
        e = {};
    return Object.keys(o).forEach(function (n) {
      var t = unpack_1(o[n]);
      "true" === n && (n = !0);

      for (var _o2 = 0; _o2 < t.length; _o2++) {
        var r = t[_o2];
        !0 === e.hasOwnProperty(r) ? !1 === Array.isArray(e[r]) ? e[r] = [e[r], n] : e[r].push(n) : e[r] = n;
      }
    }), e;
  };

  var efrtUnpack_min = unpack_1$1;

  //safely add it to the lexicon
  var addWord = function addWord(word, tag, lex) {
    if (lex[word] !== undefined) {
      if (typeof lex[word] === 'string') {
        lex[word] = [lex[word]];
      }

      lex[word].push(tag);
    } else {
      lex[word] = tag;
    }
  }; // blast-out more forms for some given words


  var addMore = function addMore(word, tag, world) {
    var lexicon = world.words;
    var transform = world.transforms; // cache multi-words

    var words = word.split(' ');

    if (words.length > 1) {
      //cache the beginning word
      world.hasCompound[words[0]] = true;
    } // inflect our nouns


    if (tag === 'Singular') {
      var plural = transform.toPlural(word, world);
      lexicon[plural] = lexicon[plural] || 'Plural'; // only if it's safe
    } //conjugate our verbs


    if (tag === 'Infinitive') {
      var conj = transform.conjugate(word, world);
      var tags = Object.keys(conj);

      for (var i = 0; i < tags.length; i++) {
        var w = conj[tags[i]];
        lexicon[w] = lexicon[w] || tags[i]; // only if it's safe
      }
    } //derive more adjective forms


    if (tag === 'Comparable') {
      var _conj = transform.adjectives(word);

      var _tags = Object.keys(_conj);

      for (var _i = 0; _i < _tags.length; _i++) {
        var _w = _conj[_tags[_i]];
        lexicon[_w] = lexicon[_w] || _tags[_i]; // only if it's safe
      }
    } //conjugate phrasal-verbs


    if (tag === 'PhrasalVerb') {
      //add original form
      addWord(word, 'Infinitive', lexicon); //conjugate first word

      var _conj2 = transform.conjugate(words[0], world);

      var _tags2 = Object.keys(_conj2);

      for (var _i2 = 0; _i2 < _tags2.length; _i2++) {
        //add it to our cache
        world.hasCompound[_conj2[_tags2[_i2]]] = true; //first + last words

        var _w2 = _conj2[_tags2[_i2]] + ' ' + words[1];

        addWord(_w2, _tags2[_i2], lexicon);
        addWord(_w2, 'PhrasalVerb', lexicon);
      }
    } // inflect our demonyms - 'germans'


    if (tag === 'Demonym') {
      var _plural = transform.toPlural(word, world);

      lexicon[_plural] = lexicon[_plural] || ['Demonym', 'Plural']; // only if it's safe
    }
  }; // throw a bunch of words in our lexicon
  // const doWord = function(words, tag, world) {
  //   let lexicon = world.words
  //   for (let i = 0; i < words.length; i++) {
  //     addWord(words[i], tag, lexicon)
  //     // do some fancier stuff
  //     addMore(words[i], tag, world)
  //   }
  // }


  var addWords = {
    addWord: addWord,
    addMore: addMore
  };

  // add words from plurals and conjugations data
  var addIrregulars = function addIrregulars(world) {
    //add irregular plural nouns
    var nouns = world.irregulars.nouns;
    var words = Object.keys(nouns);

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      world.words[w] = 'Singular';
      world.words[nouns[w]] = 'Plural';
    } // add irregular verb conjugations


    var verbs = world.irregulars.verbs;
    var keys = Object.keys(verbs);

    var _loop = function _loop(_i) {
      var inf = keys[_i]; //add only if it it's safe...

      world.words[inf] = world.words[inf] || 'Infinitive';
      var forms = world.transforms.conjugate(inf, world);
      forms = Object.assign(forms, verbs[inf]); //add the others

      Object.keys(forms).forEach(function (tag) {
        world.words[forms[tag]] = world.words[forms[tag]] || tag;
      });
    };

    for (var _i = 0; _i < keys.length; _i++) {
      _loop(_i);
    }
  };

  var addIrregulars_1 = addIrregulars;

  //words that can't be compressed, for whatever reason
  var misc$1 = {
    // numbers
    '20th century fox': 'Organization',
    // '3m': 'Organization',
    '7 eleven': 'Organization',
    '7-eleven': 'Organization',
    g8: 'Organization',
    'motel 6': 'Organization',
    vh1: 'Organization',
    q1: 'Date',
    q2: 'Date',
    q3: 'Date',
    q4: 'Date'
  };

  //nouns with irregular plural/singular forms
  //used in noun.inflect, and also in the lexicon.
  var plurals = {
    addendum: 'addenda',
    alga: 'algae',
    alumna: 'alumnae',
    alumnus: 'alumni',
    analysis: 'analyses',
    antenna: 'antennae',
    appendix: 'appendices',
    avocado: 'avocados',
    axis: 'axes',
    bacillus: 'bacilli',
    barracks: 'barracks',
    beau: 'beaux',
    bus: 'buses',
    cactus: 'cacti',
    chateau: 'chateaux',
    child: 'children',
    circus: 'circuses',
    clothes: 'clothes',
    corpus: 'corpora',
    criterion: 'criteria',
    curriculum: 'curricula',
    database: 'databases',
    deer: 'deer',
    diagnosis: 'diagnoses',
    echo: 'echoes',
    embargo: 'embargoes',
    epoch: 'epochs',
    foot: 'feet',
    formula: 'formulae',
    fungus: 'fungi',
    genus: 'genera',
    goose: 'geese',
    halo: 'halos',
    hippopotamus: 'hippopotami',
    index: 'indices',
    larva: 'larvae',
    leaf: 'leaves',
    libretto: 'libretti',
    loaf: 'loaves',
    man: 'men',
    matrix: 'matrices',
    memorandum: 'memoranda',
    modulus: 'moduli',
    mosquito: 'mosquitoes',
    mouse: 'mice',
    move: 'moves',
    nebula: 'nebulae',
    nucleus: 'nuclei',
    octopus: 'octopi',
    opus: 'opera',
    ovum: 'ova',
    ox: 'oxen',
    parenthesis: 'parentheses',
    person: 'people',
    phenomenon: 'phenomena',
    prognosis: 'prognoses',
    quiz: 'quizzes',
    radius: 'radii',
    referendum: 'referenda',
    rodeo: 'rodeos',
    sex: 'sexes',
    shoe: 'shoes',
    sombrero: 'sombreros',
    stimulus: 'stimuli',
    stomach: 'stomachs',
    syllabus: 'syllabi',
    synopsis: 'synopses',
    tableau: 'tableaux',
    thesis: 'theses',
    thief: 'thieves',
    tooth: 'teeth',
    tornado: 'tornados',
    tuxedo: 'tuxedos',
    vertebra: 'vertebrae' // virus: 'viri',
    // zero: 'zeros',

  };

  // a list of irregular verb conjugations
  // used in verbs().conjugate()
  // but also added to our lexicon
  //use shorter key-names
  var mapping = {
    g: 'Gerund',
    prt: 'Participle',
    perf: 'PerfectTense',
    pst: 'PastTense',
    fut: 'FuturePerfect',
    pres: 'PresentTense',
    pluperf: 'Pluperfect',
    a: 'Actor'
  }; // '_' in conjugations is the infinitive form

  var conjugations = {
    act: {
      a: '_or'
    },
    ache: {
      pst: 'ached',
      g: 'aching'
    },
    age: {
      g: 'ageing',
      pst: 'aged',
      pres: 'ages'
    },
    aim: {
      a: '_er',
      g: '_ing',
      pst: '_ed'
    },
    arise: {
      prt: '_n',
      pst: 'arose'
    },
    babysit: {
      a: '_ter',
      pst: 'babysat'
    },
    ban: {
      a: '',
      g: '_ning',
      pst: '_ned'
    },
    be: {
      a: '',
      g: 'am',
      prt: 'been',
      pst: 'was',
      pres: 'is'
    },
    beat: {
      a: '_er',
      g: '_ing',
      prt: '_en'
    },
    become: {
      prt: '_'
    },
    begin: {
      g: '_ning',
      prt: 'begun',
      pst: 'began'
    },
    being: {
      g: 'are',
      pst: 'were',
      pres: 'are'
    },
    bend: {
      prt: 'bent'
    },
    bet: {
      a: '_ter',
      prt: '_'
    },
    bind: {
      pst: 'bound'
    },
    bite: {
      g: 'biting',
      prt: 'bitten',
      pst: 'bit'
    },
    bleed: {
      prt: 'bled',
      pst: 'bled'
    },
    blow: {
      prt: '_n',
      pst: 'blew'
    },
    boil: {
      a: '_er'
    },
    brake: {
      prt: 'broken'
    },
    "break": {
      pst: 'broke'
    },
    breed: {
      pst: 'bred'
    },
    bring: {
      prt: 'brought',
      pst: 'brought'
    },
    broadcast: {
      pst: '_'
    },
    budget: {
      pst: '_ed'
    },
    build: {
      prt: 'built',
      pst: 'built'
    },
    burn: {
      prt: '_ed'
    },
    burst: {
      prt: '_'
    },
    buy: {
      prt: 'bought',
      pst: 'bought'
    },
    can: {
      a: '',
      fut: '_',
      g: '',
      pst: 'could',
      perf: 'could',
      pluperf: 'could',
      pres: '_'
    },
    "catch": {
      pst: 'caught'
    },
    choose: {
      g: 'choosing',
      prt: 'chosen',
      pst: 'chose'
    },
    cling: {
      prt: 'clung'
    },
    come: {
      prt: '_',
      pst: 'came',
      g: 'coming'
    },
    compete: {
      a: 'competitor',
      g: 'competing',
      pst: '_d'
    },
    cost: {
      pst: '_'
    },
    creep: {
      prt: 'crept'
    },
    cut: {
      prt: '_'
    },
    deal: {
      prt: '_t',
      pst: '_t'
    },
    develop: {
      a: '_er',
      g: '_ing',
      pst: '_ed'
    },
    die: {
      g: 'dying',
      pst: '_d'
    },
    dig: {
      g: '_ging',
      prt: 'dug',
      pst: 'dug'
    },
    dive: {
      prt: '_d'
    },
    "do": {
      pst: 'did',
      pres: '_es'
    },
    draw: {
      prt: '_n',
      pst: 'drew'
    },
    dream: {
      prt: '_t'
    },
    drink: {
      prt: 'drunk',
      pst: 'drank'
    },
    drive: {
      g: 'driving',
      prt: '_n',
      pst: 'drove'
    },
    drop: {
      g: '_ping',
      pst: '_ped'
    },
    eat: {
      a: '_er',
      g: '_ing',
      prt: '_en',
      pst: 'ate'
    },
    edit: {
      g: '_ing'
    },
    egg: {
      pst: '_ed'
    },
    fall: {
      prt: '_en',
      pst: 'fell'
    },
    feed: {
      prt: 'fed',
      pst: 'fed'
    },
    feel: {
      a: '_er',
      pst: 'felt'
    },
    fight: {
      prt: 'fought',
      pst: 'fought'
    },
    find: {
      pst: 'found'
    },
    flee: {
      g: '_ing',
      prt: 'fled'
    },
    fling: {
      prt: 'flung'
    },
    fly: {
      prt: 'flown',
      pst: 'flew'
    },
    forbid: {
      pst: 'forbade'
    },
    forget: {
      g: '_ing',
      prt: 'forgotten',
      pst: 'forgot'
    },
    forgive: {
      g: 'forgiving',
      prt: '_n',
      pst: 'forgave'
    },
    free: {
      a: '',
      g: '_ing'
    },
    freeze: {
      g: 'freezing',
      prt: 'frozen',
      pst: 'froze'
    },
    get: {
      pst: 'got',
      prt: 'gotten'
    },
    give: {
      g: 'giving',
      prt: '_n',
      pst: 'gave'
    },
    go: {
      prt: '_ne',
      pst: 'went',
      pres: 'goes'
    },
    grow: {
      prt: '_n'
    },
    hang: {
      prt: 'hung',
      pst: 'hung'
    },
    have: {
      g: 'having',
      prt: 'had',
      pst: 'had',
      pres: 'has'
    },
    hear: {
      prt: '_d',
      pst: '_d'
    },
    hide: {
      prt: 'hidden',
      pst: 'hid'
    },
    hit: {
      prt: '_'
    },
    hold: {
      prt: 'held',
      pst: 'held'
    },
    hurt: {
      prt: '_',
      pst: '_'
    },
    ice: {
      g: 'icing',
      pst: '_d'
    },
    imply: {
      pst: 'implied',
      pres: 'implies'
    },
    is: {
      a: '',
      g: 'being',
      pst: 'was',
      pres: '_'
    },
    keep: {
      prt: 'kept'
    },
    kneel: {
      prt: 'knelt'
    },
    know: {
      prt: '_n'
    },
    lay: {
      prt: 'laid',
      pst: 'laid'
    },
    lead: {
      prt: 'led',
      pst: 'led'
    },
    leap: {
      prt: '_t'
    },
    leave: {
      prt: 'left',
      pst: 'left'
    },
    lend: {
      prt: 'lent'
    },
    lie: {
      g: 'lying',
      pst: 'lay'
    },
    light: {
      prt: 'lit',
      pst: 'lit'
    },
    log: {
      g: '_ging',
      pst: '_ged'
    },
    loose: {
      prt: 'lost'
    },
    lose: {
      g: 'losing',
      pst: 'lost'
    },
    make: {
      prt: 'made',
      pst: 'made'
    },
    mean: {
      prt: '_t',
      pst: '_t'
    },
    meet: {
      a: '_er',
      g: '_ing',
      prt: 'met',
      pst: 'met'
    },
    miss: {
      pres: '_'
    },
    name: {
      g: 'naming'
    },
    pay: {
      prt: 'paid',
      pst: 'paid'
    },
    prove: {
      prt: '_n'
    },
    puke: {
      g: 'puking'
    },
    put: {
      prt: '_'
    },
    quit: {
      prt: '_'
    },
    read: {
      prt: '_',
      pst: '_'
    },
    ride: {
      prt: 'ridden'
    },
    ring: {
      prt: 'rung',
      pst: 'rang'
    },
    rise: {
      fut: 'will have _n',
      g: 'rising',
      prt: '_n',
      pst: 'rose',
      pluperf: 'had _n'
    },
    rub: {
      g: '_bing',
      pst: '_bed'
    },
    run: {
      g: '_ning',
      prt: '_',
      pst: 'ran'
    },
    say: {
      prt: 'said',
      pst: 'said',
      pres: '_s'
    },
    seat: {
      prt: 'sat'
    },
    see: {
      g: '_ing',
      prt: '_n',
      pst: 'saw'
    },
    seek: {
      prt: 'sought'
    },
    sell: {
      prt: 'sold',
      pst: 'sold'
    },
    send: {
      prt: 'sent'
    },
    set: {
      prt: '_'
    },
    sew: {
      prt: '_n'
    },
    shake: {
      prt: '_n'
    },
    shave: {
      prt: '_d'
    },
    shed: {
      g: '_ding',
      pst: '_',
      pres: '_s'
    },
    shine: {
      prt: 'shone',
      pst: 'shone'
    },
    shoot: {
      prt: 'shot',
      pst: 'shot'
    },
    show: {
      pst: '_ed'
    },
    shut: {
      prt: '_'
    },
    sing: {
      prt: 'sung',
      pst: 'sang'
    },
    sink: {
      pst: 'sank',
      pluperf: 'had sunk'
    },
    sit: {
      pst: 'sat'
    },
    ski: {
      pst: '_ied'
    },
    slay: {
      prt: 'slain'
    },
    sleep: {
      prt: 'slept'
    },
    slide: {
      prt: 'slid',
      pst: 'slid'
    },
    smash: {
      pres: '_es'
    },
    sneak: {
      prt: 'snuck'
    },
    speak: {
      fut: 'will have spoken',
      prt: 'spoken',
      pst: 'spoke',
      perf: 'have spoken',
      pluperf: 'had spoken'
    },
    speed: {
      prt: 'sped'
    },
    spend: {
      prt: 'spent'
    },
    spill: {
      prt: '_ed',
      pst: 'spilt'
    },
    spin: {
      g: '_ning',
      prt: 'spun',
      pst: 'spun'
    },
    spit: {
      prt: 'spat'
    },
    split: {
      prt: '_'
    },
    spread: {
      pst: '_'
    },
    spring: {
      prt: 'sprung'
    },
    stand: {
      pst: 'stood'
    },
    steal: {
      a: '_er',
      pst: 'stole'
    },
    stick: {
      pst: 'stuck'
    },
    sting: {
      pst: 'stung'
    },
    stink: {
      prt: 'stunk',
      pst: 'stunk'
    },
    stream: {
      a: '_er'
    },
    strew: {
      prt: '_n'
    },
    strike: {
      g: 'striking',
      pst: 'struck'
    },
    suit: {
      a: '_er',
      g: '_ing',
      pst: '_ed'
    },
    sware: {
      prt: 'sworn'
    },
    swear: {
      pst: 'swore'
    },
    sweep: {
      prt: 'swept'
    },
    swim: {
      g: '_ming',
      pst: 'swam'
    },
    swing: {
      pst: 'swung'
    },
    take: {
      fut: 'will have _n',
      pst: 'took',
      perf: 'have _n',
      pluperf: 'had _n'
    },
    teach: {
      pst: 'taught',
      pres: '_es'
    },
    tear: {
      pst: 'tore'
    },
    tell: {
      pst: 'told'
    },
    think: {
      pst: 'thought'
    },
    thrive: {
      prt: '_d'
    },
    tie: {
      g: 'tying',
      pst: '_d'
    },
    undergo: {
      prt: '_ne'
    },
    understand: {
      pst: 'understood'
    },
    upset: {
      prt: '_'
    },
    wait: {
      a: '_er',
      g: '_ing',
      pst: '_ed'
    },
    wake: {
      pst: 'woke'
    },
    wear: {
      pst: 'wore'
    },
    weave: {
      prt: 'woven'
    },
    wed: {
      pst: 'wed'
    },
    weep: {
      prt: 'wept'
    },
    win: {
      g: '_ning',
      pst: 'won'
    },
    wind: {
      prt: 'wound'
    },
    withdraw: {
      pst: 'withdrew'
    },
    wring: {
      prt: 'wrung'
    },
    write: {
      g: 'writing',
      prt: 'written',
      pst: 'wrote'
    }
  }; //uncompress our ad-hoc compression scheme

  var keys = Object.keys(conjugations);

  var _loop = function _loop(i) {
    var inf = keys[i];
    var _final = {};
    Object.keys(conjugations[inf]).forEach(function (key) {
      var str = conjugations[inf][key]; //swap-in infinitives for '_'

      str = str.replace('_', inf);
      var full = mapping[key];
      _final[full] = str;
    }); //over-write original

    conjugations[inf] = _final;
  };

  for (var i = 0; i < keys.length; i++) {
    _loop(i);
  }

  var conjugations_1 = conjugations;

  var endsWith = {
    b: [{
      reg: /([^aeiou][aeiou])b$/i,
      repl: {
        pr: '$1bs',
        pa: '$1bbed',
        gr: '$1bbing'
      }
    }],
    d: [{
      reg: /(end)$/i,
      repl: {
        pr: '$1s',
        pa: 'ent',
        gr: '$1ing',
        ar: '$1er'
      }
    }, {
      reg: /(eed)$/i,
      repl: {
        pr: '$1s',
        pa: '$1ed',
        gr: '$1ing',
        ar: '$1er'
      }
    }, {
      reg: /(ed)$/i,
      repl: {
        pr: '$1s',
        pa: '$1ded',
        ar: '$1der',
        gr: '$1ding'
      }
    }, {
      reg: /([^aeiou][ou])d$/i,
      repl: {
        pr: '$1ds',
        pa: '$1dded',
        gr: '$1dding'
      }
    }],
    e: [{
      reg: /(eave)$/i,
      repl: {
        pr: '$1s',
        pa: '$1d',
        gr: 'eaving',
        ar: '$1r'
      }
    }, {
      reg: /(ide)$/i,
      repl: {
        pr: '$1s',
        pa: 'ode',
        gr: 'iding',
        ar: 'ider'
      }
    }, {
      //shake
      reg: /(t|sh?)(ake)$/i,
      repl: {
        pr: '$1$2s',
        pa: '$1ook',
        gr: '$1aking',
        ar: '$1$2r'
      }
    }, {
      //awake
      reg: /w(ake)$/i,
      repl: {
        pr: 'w$1s',
        pa: 'woke',
        gr: 'waking',
        ar: 'w$1r'
      }
    }, {
      //make
      reg: /m(ake)$/i,
      repl: {
        pr: 'm$1s',
        pa: 'made',
        gr: 'making',
        ar: 'm$1r'
      }
    }, {
      reg: /(a[tg]|i[zn]|ur|nc|gl|is)e$/i,
      repl: {
        pr: '$1es',
        pa: '$1ed',
        gr: '$1ing' // prt: '$1en',

      }
    }, {
      reg: /([bd]l)e$/i,
      repl: {
        pr: '$1es',
        pa: '$1ed',
        gr: '$1ing'
      }
    }, {
      reg: /(om)e$/i,
      repl: {
        pr: '$1es',
        pa: 'ame',
        gr: '$1ing'
      }
    }],
    g: [{
      reg: /([^aeiou][ou])g$/i,
      repl: {
        pr: '$1gs',
        pa: '$1gged',
        gr: '$1gging'
      }
    }],
    h: [{
      reg: /(..)([cs]h)$/i,
      repl: {
        pr: '$1$2es',
        pa: '$1$2ed',
        gr: '$1$2ing'
      }
    }],
    k: [{
      reg: /(ink)$/i,
      repl: {
        pr: '$1s',
        pa: 'unk',
        gr: '$1ing',
        ar: '$1er'
      }
    }],
    m: [{
      reg: /([^aeiou][aeiou])m$/i,
      repl: {
        pr: '$1ms',
        pa: '$1mmed',
        gr: '$1mming'
      }
    }],
    n: [{
      reg: /(en)$/i,
      repl: {
        pr: '$1s',
        pa: '$1ed',
        gr: '$1ing'
      }
    }],
    p: [{
      reg: /(e)(ep)$/i,
      repl: {
        pr: '$1$2s',
        pa: '$1pt',
        gr: '$1$2ing',
        ar: '$1$2er'
      }
    }, {
      reg: /([^aeiou][aeiou])p$/i,
      repl: {
        pr: '$1ps',
        pa: '$1pped',
        gr: '$1pping'
      }
    }, {
      reg: /([aeiu])p$/i,
      repl: {
        pr: '$1ps',
        pa: '$1p',
        gr: '$1pping'
      }
    }],
    r: [{
      reg: /([td]er)$/i,
      repl: {
        pr: '$1s',
        pa: '$1ed',
        gr: '$1ing'
      }
    }, {
      reg: /(er)$/i,
      repl: {
        pr: '$1s',
        pa: '$1ed',
        gr: '$1ing'
      }
    }],
    s: [{
      reg: /(ish|tch|ess)$/i,
      repl: {
        pr: '$1es',
        pa: '$1ed',
        gr: '$1ing'
      }
    }],
    t: [{
      reg: /(ion|end|e[nc]t)$/i,
      repl: {
        pr: '$1s',
        pa: '$1ed',
        gr: '$1ing'
      }
    }, {
      reg: /(.eat)$/i,
      repl: {
        pr: '$1s',
        pa: '$1ed',
        gr: '$1ing'
      }
    }, {
      reg: /([aeiu])t$/i,
      repl: {
        pr: '$1ts',
        pa: '$1t',
        gr: '$1tting'
      }
    }, {
      reg: /([^aeiou][aeiou])t$/i,
      repl: {
        pr: '$1ts',
        pa: '$1tted',
        gr: '$1tting'
      }
    }],
    w: [{
      reg: /(..)(ow)$/i,
      repl: {
        pr: '$1$2s',
        pa: '$1ew',
        gr: '$1$2ing',
        prt: '$1$2n'
      }
    }],
    y: [{
      reg: /([i|f|rr])y$/i,
      repl: {
        pr: '$1ies',
        pa: '$1ied',
        gr: '$1ying'
      }
    }],
    z: [{
      reg: /([aeiou]zz)$/i,
      repl: {
        pr: '$1es',
        pa: '$1ed',
        gr: '$1ing'
      }
    }]
  };
  var suffixes = endsWith;

  var posMap = {
    pr: 'PresentTense',
    pa: 'PastTense',
    gr: 'Gerund',
    prt: 'Participle',
    ar: 'Actor'
  };

  var doTransform = function doTransform(str, obj) {
    var found = {};
    var keys = Object.keys(obj.repl);

    for (var i = 0; i < keys.length; i += 1) {
      var pos = keys[i];
      found[posMap[pos]] = str.replace(obj.reg, obj.repl[pos]);
    }

    return found;
  }; //look at the end of the word for clues


  var checkSuffix = function checkSuffix() {
    var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var c = str[str.length - 1];

    if (suffixes.hasOwnProperty(c) === true) {
      for (var r = 0; r < suffixes[c].length; r += 1) {
        var reg = suffixes[c][r].reg;

        if (reg.test(str) === true) {
          return doTransform(str, suffixes[c][r]);
        }
      }
    }

    return {};
  };

  var _01Suffixes = checkSuffix;

  //non-specifc, 'hail-mary' transforms from infinitive, into other forms
  var hasY = /[bcdfghjklmnpqrstvwxz]y$/;
  var generic = {
    Gerund: function Gerund(inf) {
      if (inf.charAt(inf.length - 1) === 'e') {
        return inf.replace(/e$/, 'ing');
      }

      return inf + 'ing';
    },
    PresentTense: function PresentTense(inf) {
      if (inf.charAt(inf.length - 1) === 's') {
        return inf + 'es';
      }

      if (hasY.test(inf) === true) {
        return inf.slice(0, -1) + 'ies';
      }

      return inf + 's';
    },
    PastTense: function PastTense(inf) {
      if (inf.charAt(inf.length - 1) === 'e') {
        return inf + 'd';
      }

      if (inf.substr(-2) === 'ed') {
        return inf;
      }

      if (hasY.test(inf) === true) {
        return inf.slice(0, -1) + 'ied';
      }

      return inf + 'ed';
    }
  };
  var _02Generic = generic;

  //we assume the input word is a proper infinitive

  var conjugate = function conjugate() {
    var inf = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var world = arguments.length > 1 ? arguments[1] : undefined;
    var found = {}; // 1. look at irregulars
    //the lexicon doesn't pass this in

    if (world && world.irregulars) {
      if (world.irregulars.verbs.hasOwnProperty(inf) === true) {
        found = Object.assign({}, world.irregulars.verbs[inf]);
      }
    } //2. rule-based regex


    found = Object.assign({}, _01Suffixes(inf), found); //3. generic transformations
    //'buzzing'

    if (found.Gerund === undefined) {
      found.Gerund = _02Generic.Gerund(inf);
    } //'buzzed'


    if (found.PastTense === undefined) {
      found.PastTense = _02Generic.PastTense(inf);
    } //'buzzes'


    if (found.PresentTense === undefined) {
      found.PresentTense = _02Generic.PresentTense(inf);
    }

    return found;
  };

  var conjugate_1 = conjugate; // console.log(conjugate('bake'))

  //turn 'quick' into 'quickest'
  var do_rules = [/ght$/, /nge$/, /ough$/, /ain$/, /uel$/, /[au]ll$/, /ow$/, /oud$/, /...p$/];
  var dont_rules = [/ary$/];
  var irregulars = {
    nice: 'nicest',
    late: 'latest',
    hard: 'hardest',
    inner: 'innermost',
    outer: 'outermost',
    far: 'furthest',
    worse: 'worst',
    bad: 'worst',
    good: 'best',
    big: 'biggest',
    large: 'largest'
  };
  var transforms = [{
    reg: /y$/i,
    repl: 'iest'
  }, {
    reg: /([aeiou])t$/i,
    repl: '$1ttest'
  }, {
    reg: /([aeou])de$/i,
    repl: '$1dest'
  }, {
    reg: /nge$/i,
    repl: 'ngest'
  }, {
    reg: /([aeiou])te$/i,
    repl: '$1test'
  }];

  var to_superlative = function to_superlative(str) {
    //irregulars
    if (irregulars.hasOwnProperty(str)) {
      return irregulars[str];
    } //known transforms


    for (var i = 0; i < transforms.length; i++) {
      if (transforms[i].reg.test(str)) {
        return str.replace(transforms[i].reg, transforms[i].repl);
      }
    } //dont-rules


    for (var _i = 0; _i < dont_rules.length; _i++) {
      if (dont_rules[_i].test(str) === true) {
        return null;
      }
    } //do-rules


    for (var _i2 = 0; _i2 < do_rules.length; _i2++) {
      if (do_rules[_i2].test(str) === true) {
        if (str.charAt(str.length - 1) === 'e') {
          return str + 'st';
        }

        return str + 'est';
      }
    }

    return str + 'est';
  };

  var toSuperlative = to_superlative;

  //turn 'quick' into 'quickly'
  var do_rules$1 = [/ght$/, /nge$/, /ough$/, /ain$/, /uel$/, /[au]ll$/, /ow$/, /old$/, /oud$/, /e[ae]p$/];
  var dont_rules$1 = [/ary$/, /ous$/];
  var irregulars$1 = {
    grey: 'greyer',
    gray: 'grayer',
    green: 'greener',
    yellow: 'yellower',
    red: 'redder',
    good: 'better',
    well: 'better',
    bad: 'worse',
    sad: 'sadder',
    big: 'bigger'
  };
  var transforms$1 = [{
    reg: /y$/i,
    repl: 'ier'
  }, {
    reg: /([aeiou])t$/i,
    repl: '$1tter'
  }, {
    reg: /([aeou])de$/i,
    repl: '$1der'
  }, {
    reg: /nge$/i,
    repl: 'nger'
  }];

  var to_comparative = function to_comparative(str) {
    //known-irregulars
    if (irregulars$1.hasOwnProperty(str)) {
      return irregulars$1[str];
    } //known-transforms


    for (var i = 0; i < transforms$1.length; i++) {
      if (transforms$1[i].reg.test(str) === true) {
        return str.replace(transforms$1[i].reg, transforms$1[i].repl);
      }
    } //dont-patterns


    for (var _i = 0; _i < dont_rules$1.length; _i++) {
      if (dont_rules$1[_i].test(str) === true) {
        return null;
      }
    } //do-patterns


    for (var _i2 = 0; _i2 < do_rules$1.length; _i2++) {
      if (do_rules$1[_i2].test(str) === true) {
        return str + 'er';
      }
    } //easy-one


    if (/e$/.test(str) === true) {
      return str + 'r';
    }

    return str + 'er';
  };

  var toComparative = to_comparative;

  var fns$1 = {
    toSuperlative: toSuperlative,
    toComparative: toComparative
  };
  /** conjugate an adjective into other forms */

  var conjugate$1 = function conjugate(w) {
    var res = {}; // 'greatest'

    var sup = fns$1.toSuperlative(w);

    if (sup) {
      res.Superlative = sup;
    } // 'greater'


    var comp = fns$1.toComparative(w);

    if (comp) {
      res.Comparative = comp;
    }

    return res;
  };

  var adjectives = conjugate$1;

  /** patterns for turning 'bus' to 'buses'*/
  var suffixes$1 = {
    a: [[/(antenn|formul|nebul|vertebr|vit)a$/i, '$1ae'], [/([ti])a$/i, '$1a']],
    e: [[/(kn|l|w)ife$/i, '$1ives'], [/(hive)$/i, '$1s'], [/([m|l])ouse$/i, '$1ice'], [/([m|l])ice$/i, '$1ice']],
    f: [[/^(dwar|handkerchie|hoo|scar|whar)f$/i, '$1ves'], [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)f$/i, '$1ves']],
    i: [[/(octop|vir)i$/i, '$1i']],
    m: [[/([ti])um$/i, '$1a']],
    n: [[/^(oxen)$/i, '$1']],
    o: [[/(al|ad|at|er|et|ed|ad)o$/i, '$1oes']],
    s: [[/(ax|test)is$/i, '$1es'], [/(alias|status)$/i, '$1es'], [/sis$/i, 'ses'], [/(bu)s$/i, '$1ses'], [/(sis)$/i, 'ses'], [/^(?!talis|.*hu)(.*)man$/i, '$1men'], [/(octop|vir|radi|nucle|fung|cact|stimul)us$/i, '$1i']],
    x: [[/(matr|vert|ind|cort)(ix|ex)$/i, '$1ices'], [/^(ox)$/i, '$1en']],
    y: [[/([^aeiouy]|qu)y$/i, '$1ies']],
    z: [[/(quiz)$/i, '$1zes']]
  };
  var _rules = suffixes$1;

  var addE = /(x|ch|sh|s|z)$/;

  var trySuffix = function trySuffix(str) {
    var c = str[str.length - 1];

    if (_rules.hasOwnProperty(c) === true) {
      for (var i = 0; i < _rules[c].length; i += 1) {
        var reg = _rules[c][i][0];

        if (reg.test(str) === true) {
          return str.replace(reg, _rules[c][i][1]);
        }
      }
    }

    return null;
  };
  /** Turn a singular noun into a plural
   * assume the given string is singular
   */


  var pluralize = function pluralize() {
    var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var world = arguments.length > 1 ? arguments[1] : undefined;
    var irregulars = world.irregulars.nouns; // check irregulars list

    if (irregulars.hasOwnProperty(str)) {
      return irregulars[str];
    } //we have some rules to try-out


    var plural = trySuffix(str);

    if (plural !== null) {
      return plural;
    } //like 'church'


    if (addE.test(str)) {
      return str + 'es';
    } // ¯\_(ツ)_/¯


    return str + 's';
  };

  var toPlural = pluralize;

  //patterns for turning 'dwarves' to 'dwarf'
  var _rules$1 = [[/([^v])ies$/i, '$1y'], [/ises$/i, 'isis'], [/(kn|[^o]l|w)ives$/i, '$1ife'], [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)ves$/i, '$1f'], [/^(dwar|handkerchie|hoo|scar|whar)ves$/i, '$1f'], [/(antenn|formul|nebul|vertebr|vit)ae$/i, '$1a'], [/(octop|vir|radi|nucle|fung|cact|stimul)(i)$/i, '$1us'], [/(buffal|tomat|tornad)(oes)$/i, '$1o'], // [/(analy|diagno|parenthe|progno|synop|the)ses$/i, '$1sis'],
  [/(..[aeiou]s)es$/i, '$1'], [/(vert|ind|cort)(ices)$/i, '$1ex'], [/(matr|append)(ices)$/i, '$1ix'], [/(x|ch|ss|sh|z|o)es$/i, '$1'], [/men$/i, 'man'], [/(n)ews$/i, '$1ews'], [/([ti])a$/i, '$1um'], [/([^aeiouy]|qu)ies$/i, '$1y'], [/(s)eries$/i, '$1eries'], [/(m)ovies$/i, '$1ovie'], [/([m|l])ice$/i, '$1ouse'], [/(cris|ax|test)es$/i, '$1is'], [/(alias|status)es$/i, '$1'], [/(ss)$/i, '$1'], [/(ics)$/i, '$1'], [/s$/i, '']];

  var invertObj = function invertObj(obj) {
    return Object.keys(obj).reduce(function (h, k) {
      h[obj[k]] = k;
      return h;
    }, {});
  };

  var toSingular = function toSingular(str, world) {
    var irregulars = world.irregulars.nouns;
    var invert = invertObj(irregulars); // check irregulars list

    if (invert.hasOwnProperty(str)) {
      return invert[str];
    } // go through our regexes


    for (var i = 0; i < _rules$1.length; i++) {
      if (_rules$1[i][0].test(str) === true) {
        str = str.replace(_rules$1[i][0], _rules$1[i][1]);
        return str;
      }
    }

    return str;
  };

  var toSingular_1 = toSingular;

  //rules for turning a verb into infinitive form
  var rules = {
    Participle: [{
      reg: /own$/i,
      to: 'ow'
    }, {
      reg: /(.)un([g|k])$/i,
      to: '$1in$2'
    }],
    Actor: [{
      reg: /(er)er$/i,
      to: '$1'
    }],
    PresentTense: [{
      reg: /(..)(ies)$/i,
      to: '$1y'
    }, {
      reg: /(tch|sh)es$/i,
      to: '$1'
    }, {
      reg: /(ss|zz)es$/i,
      to: '$1'
    }, {
      reg: /([tzlshicgrvdnkmu])es$/i,
      to: '$1e'
    }, {
      reg: /(n[dtk]|c[kt]|[eo]n|i[nl]|er|a[ytrl])s$/i,
      to: '$1'
    }, {
      reg: /(ow)s$/i,
      to: '$1'
    }, {
      reg: /(op)s$/i,
      to: '$1'
    }, {
      reg: /([eirs])ts$/i,
      to: '$1t'
    }, {
      reg: /(ll)s$/i,
      to: '$1'
    }, {
      reg: /(el)s$/i,
      to: '$1'
    }, {
      reg: /(ip)es$/i,
      to: '$1e'
    }, {
      reg: /ss$/i,
      to: 'ss'
    }, {
      reg: /s$/i,
      to: ''
    }],
    Gerund: [{
      //popping -> pop
      reg: /(..)(p|d|t|g){2}ing$/i,
      to: '$1$2'
    }, {
      //fuzzing -> fuzz
      reg: /(ll|ss|zz)ing$/i,
      to: '$1'
    }, {
      reg: /([^aeiou])ying$/i,
      to: '$1y'
    }, {
      reg: /([^ae]i.)ing$/i,
      to: '$1e'
    }, {
      //eating, reading
      reg: /(ea[dklnrtv])ing$/i,
      to: '$1'
    }, {
      //washing -> wash
      reg: /(ch|sh)ing$/i,
      to: '$1'
    }, //soft-e forms:
    {
      //z : hazing (not buzzing)
      reg: /(z)ing$/i,
      to: '$1e'
    }, {
      //a : baking, undulating
      reg: /(a[gdkvtc])ing$/i,
      to: '$1e'
    }, {
      //u : conjuring, tubing
      reg: /(u[rtcbn])ing$/i,
      to: '$1e'
    }, {
      //o : forboding, poking, hoping, boring (not hooping)
      reg: /([^o]o[bdknprv])ing$/i,
      to: '$1e'
    }, {
      //ling : tingling, wrinkling, circling, scrambling, bustling
      reg: /([tbckg]l)ing$/i,
      //dp
      to: '$1e'
    }, {
      //cing : bouncing, denouncing
      reg: /(c)ing$/i,
      //dp
      to: '$1e'
    }, // {
    //   //soft-e :
    //   reg: /([ua]s|[dr]g|z|o[rlsp]|cre)ing$/i,
    //   to: '$1e',
    // },
    {
      //fallback
      reg: /(..)ing$/i,
      to: '$1'
    }],
    PastTense: [{
      reg: /(ued)$/i,
      to: 'ue'
    }, {
      reg: /a([^aeiouy])ed$/i,
      to: 'a$1e'
    }, {
      reg: /([aeiou]zz)ed$/i,
      to: '$1'
    }, {
      reg: /(e|i)lled$/i,
      to: '$1ll'
    }, {
      reg: /(.)(sh|ch)ed$/i,
      to: '$1$2'
    }, {
      reg: /(tl|gl)ed$/i,
      to: '$1e'
    }, {
      reg: /(um?pt?)ed$/i,
      to: '$1'
    }, {
      reg: /(ss)ed$/i,
      to: '$1'
    }, {
      reg: /pped$/i,
      to: 'p'
    }, {
      reg: /tted$/i,
      to: 't'
    }, {
      reg: /(..)gged$/i,
      to: '$1g'
    }, {
      reg: /(..)lked$/i,
      to: '$1lk'
    }, {
      reg: /([^aeiouy][aeiou])ked$/i,
      to: '$1ke'
    }, {
      reg: /(.[aeiou])led$/i,
      to: '$1l'
    }, {
      reg: /(..)(h|ion|n[dt]|ai.|[cs]t|pp|all|ss|tt|int|ail|ld|en|oo.|er|k|pp|w|ou.|rt|ght|rm)ed$/i,
      to: '$1$2'
    }, {
      reg: /(.ut)ed$/i,
      to: '$1e'
    }, {
      reg: /(.pt)ed$/i,
      to: '$1'
    }, {
      reg: /(us)ed$/i,
      to: '$1e'
    }, {
      reg: /(..[^aeiouy])ed$/i,
      to: '$1e'
    }, {
      reg: /(..)ied$/i,
      to: '$1y'
    }, {
      reg: /(.o)ed$/i,
      to: '$1o'
    }, {
      reg: /(..i)ed$/i,
      to: '$1'
    }, {
      reg: /(.a[^aeiou])ed$/i,
      to: '$1'
    }, {
      //owed, aced
      reg: /([aeiou][^aeiou])ed$/i,
      to: '$1e'
    }, {
      reg: /([rl])ew$/i,
      to: '$1ow'
    }, {
      reg: /([pl])t$/i,
      to: '$1t'
    }]
  };
  var _transform = rules;

  var guessVerb = {
    Gerund: ['ing'],
    Actor: ['erer'],
    Infinitive: ['ate', 'ize', 'tion', 'rify', 'then', 'ress', 'ify', 'age', 'nce', 'ect', 'ise', 'ine', 'ish', 'ace', 'ash', 'ure', 'tch', 'end', 'ack', 'and', 'ute', 'ade', 'ock', 'ite', 'ase', 'ose', 'use', 'ive', 'int', 'nge', 'lay', 'est', 'ain', 'ant', 'ent', 'eed', 'er', 'le', 'own', 'unk', 'ung', 'en'],
    PastTense: ['ed', 'lt', 'nt', 'pt', 'ew', 'ld'],
    PresentTense: ['rks', 'cks', 'nks', 'ngs', 'mps', 'tes', 'zes', 'ers', 'les', 'acks', 'ends', 'ands', 'ocks', 'lays', 'eads', 'lls', 'els', 'ils', 'ows', 'nds', 'ays', 'ams', 'ars', 'ops', 'ffs', 'als', 'urs', 'lds', 'ews', 'ips', 'es', 'ts', 'ns']
  }; //flip it into a lookup object

  guessVerb = Object.keys(guessVerb).reduce(function (h, k) {
    guessVerb[k].forEach(function (a) {
      return h[a] = k;
    });
    return h;
  }, {});
  var _guess = guessVerb;

  /** it helps to know what we're conjugating from */

  var guessTense = function guessTense(str) {
    var three = str.substr(str.length - 3);

    if (_guess.hasOwnProperty(three) === true) {
      return _guess[three];
    }

    var two = str.substr(str.length - 2);

    if (_guess.hasOwnProperty(two) === true) {
      return _guess[two];
    }

    var one = str.substr(str.length - 1);

    if (one === 's') {
      return 'PresentTense';
    }

    return null;
  };

  var toInfinitive = function toInfinitive(str, world, tense) {
    if (!str) {
      return '';
    } //1. look at known irregulars


    if (world.words.hasOwnProperty(str) === true) {
      var irregs = world.irregulars.verbs;
      var keys = Object.keys(irregs);

      for (var i = 0; i < keys.length; i++) {
        var forms = Object.keys(irregs[keys[i]]);

        for (var o = 0; o < forms.length; o++) {
          if (str === irregs[keys[i]][forms[o]]) {
            return keys[i];
          }
        }
      }
    } // give'r!


    tense = tense || guessTense(str);

    if (tense && _transform[tense]) {
      for (var _i = 0; _i < _transform[tense].length; _i++) {
        var rule = _transform[tense][_i];

        if (rule.reg.test(str) === true) {
          return str.replace(rule.reg, rule.to);
        }
      }
    }

    return str;
  };

  var toInfinitive_1 = toInfinitive;

  var irregulars$2 = {
    nouns: plurals,
    verbs: conjugations_1
  }; //these behaviours are configurable & shared across some plugins

  var transforms$2 = {
    conjugate: conjugate_1,
    adjectives: adjectives,
    toPlural: toPlural,
    toSingular: toSingular_1,
    toInfinitive: toInfinitive_1
  };
  var _isVerbose = false;
  /** all configurable linguistic data */

  var World =
  /*#__PURE__*/
  function () {
    function World() {
      _classCallCheck(this, World);

      // quiet these properties from a console.log
      Object.defineProperty(this, 'words', {
        enumerable: false,
        value: misc$1,
        writable: true
      });
      Object.defineProperty(this, 'hasCompound', {
        enumerable: false,
        value: {},
        writable: true
      });
      Object.defineProperty(this, 'irregulars', {
        enumerable: false,
        value: irregulars$2,
        writable: true
      });
      Object.defineProperty(this, 'tags', {
        enumerable: false,
        value: Object.assign({}, tags),
        writable: true
      });
      Object.defineProperty(this, 'transforms', {
        enumerable: false,
        value: transforms$2,
        writable: true
      });
      Object.defineProperty(this, 'taggers', {
        enumerable: false,
        value: [],
        writable: true
      }); // add our compressed data to lexicon

      this.unpackWords(_data); // add our irregulars to lexicon

      this.addIrregulars(); // cache our abbreviations for our sentence-parser

      Object.defineProperty(this, 'cache', {
        enumerable: false,
        value: {
          abbreviations: this.getByTag('Abbreviation')
        }
      });
    }
    /** more logs for debugging */


    _createClass(World, [{
      key: "verbose",
      value: function verbose(bool) {
        _isVerbose = bool;
        return this;
      }
    }, {
      key: "isVerbose",
      value: function isVerbose() {
        return _isVerbose;
      }
      /** get all terms in our lexicon with this tag */

    }, {
      key: "getByTag",
      value: function getByTag(tag) {
        var lex = this.words;
        var res = {};
        var words = Object.keys(lex);

        for (var i = 0; i < words.length; i++) {
          if (typeof lex[words[i]] === 'string') {
            if (lex[words[i]] === tag) {
              res[words[i]] = true;
            }
          } else if (lex[words[i]].some(function (t) {
            return t === tag;
          })) {
            res[words[i]] = true;
          }
        }

        return res;
      }
      /** augment our lingustic data with new data */

    }, {
      key: "unpackWords",
      value: function unpackWords(lex) {
        var tags = Object.keys(lex);

        for (var i = 0; i < tags.length; i++) {
          var words = Object.keys(efrtUnpack_min(lex[tags[i]]));

          for (var w = 0; w < words.length; w++) {
            addWords.addWord(words[w], tags[i], this.words); // do some fancier stuff

            addWords.addMore(words[w], tags[i], this);
          }
        }
      }
      /** put new words into our lexicon, properly */

    }, {
      key: "addWords",
      value: function addWords$1(obj) {
        var keys = Object.keys(obj);

        for (var i = 0; i < keys.length; i++) {
          var word = keys[i].toLowerCase();
          addWords.addWord(word, obj[keys[i]], this.words); // do some fancier stuff

          addWords.addMore(word, obj[keys[i]], this);
        }
      }
    }, {
      key: "addIrregulars",
      value: function addIrregulars() {
        addIrregulars_1(this);

        return this;
      }
      /** extend the compromise tagset */

    }, {
      key: "addTags",
      value: function addTags(tags) {
        tags = Object.assign({}, tags);
        this.tags = Object.assign(this.tags, tags); // calculate graph implications for the new tags

        this.tags = inference(this.tags);
        return this;
      }
      /** call methods after tagger runs */

    }, {
      key: "postProcess",
      value: function postProcess(fn) {
        this.taggers.push(fn);
        return this;
      }
      /** helper method for logging + debugging */

    }, {
      key: "stats",
      value: function stats() {
        return {
          words: Object.keys(this.words).length,
          plurals: Object.keys(this.irregulars.nouns).length,
          conjugations: Object.keys(this.irregulars.verbs).length,
          compounds: Object.keys(this.hasCompound).length,
          postProcessors: this.taggers.length
        };
      }
    }]);

    return World;
  }(); //  ¯\_(:/)_/¯


  var clone$1 = function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  };
  /** produce a deep-copy of all lingustic data */


  World.prototype.clone = function () {
    var w2 = new World(); // these are simple to copy:

    w2.words = Object.assign({}, this.words);
    w2.hasCompound = Object.assign({}, this.hasCompound); //these ones are nested:

    w2.irregulars = clone$1(this.irregulars);
    w2.tags = clone$1(this.tags); // these are functions

    w2.transforms = this.transforms;
    w2.taggers = this.taggers;
    return w2;
  };

  var World_1 = World;

  var _01Utils$1 = createCommonjsModule(function (module, exports) {
    /** return the root, first document */
    exports.all = function () {
      return this.parents()[0] || this;
    };
    /** return the previous result */


    exports.parent = function () {
      if (this.from) {
        return this.from;
      }

      return this;
    };
    /**  return a list of all previous results */


    exports.parents = function (n) {
      var arr = [];

      var addParent = function addParent(doc) {
        if (doc.from) {
          arr.push(doc.from);
          addParent(doc.from);
        }
      };

      addParent(this);
      arr = arr.reverse();

      if (typeof n === 'number') {
        return arr[n];
      }

      return arr;
    };
    /** deep-copy the document, so that no references remain */


    exports.clone = function (doShallow) {
      var list = this.list.map(function (ts) {
        return ts.clone(doShallow);
      });
      var tmp = this.buildFrom(list);
      return tmp;
    };
    /** how many seperate terms does the document have? */


    exports.wordCount = function () {
      return this.list.reduce(function (count, p) {
        count += p.wordCount();
        return count;
      }, 0);
    };

    exports.wordcount = exports.wordCount;
    /** turn on logging for decision-debugging */
    // exports.verbose = function(bool) {
    //   if (bool === undefined) {
    //     bool = true
    //   }
    //   this.world.verbose = bool
    // }

    /** freeze the current state of the document, for speed-purposes*/

    exports.cache = function (options) {
      var _this = this;

      options = options || {};
      this.list.forEach(function (p) {
        var words = {};
        p.cache = p.cache || {};
        p.cache.terms = p.cache.terms || p.terms(); // cache all the terms

        p.cache.terms.forEach(function (t) {
          words[t.clean] = true;
          words[t.reduced] = true;
          words[t.text.toLowerCase()] = true;

          if (t.implicit) {
            words[t.implicit] = true;
          }

          if (t.root) {
            words[t.root] = true;
          }

          if (t.alias !== undefined) {
            words = Object.assign(words, t.alias);
          }

          if (options.root) {
            t.setRoot(_this.world);
            words[t.root] = true;
          }
        });
        delete words[''];
        p.cache.words = words;
      });
      return this;
    };
    /** un-freezes the current state of the document, so it may be transformed */


    exports.uncache = function () {
      this.list.forEach(function (p) {
        p.cache = {};
      }); // do parents too?

      this.parents().forEach(function (doc) {
        doc.list.forEach(function (p) {
          p.cache = {};
        });
      });
      return this;
    };
  });
  var _01Utils_1 = _01Utils$1.all;
  var _01Utils_2 = _01Utils$1.parent;
  var _01Utils_3 = _01Utils$1.parents;
  var _01Utils_4 = _01Utils$1.clone;
  var _01Utils_5 = _01Utils$1.wordCount;
  var _01Utils_6 = _01Utils$1.wordcount;
  var _01Utils_7 = _01Utils$1.cache;
  var _01Utils_8 = _01Utils$1.uncache;

  var _02Accessors = createCommonjsModule(function (module, exports) {
    /** use only the first result(s) */
    exports.first = function (n) {
      if (n === undefined) {
        return this.get(0);
      }

      return this.slice(0, n);
    };
    /** use only the last result(s) */


    exports.last = function (n) {
      if (n === undefined) {
        return this.get(this.list.length - 1);
      }

      var end = this.list.length;
      return this.slice(end - n, end);
    };
    /** grab a given subset of the results*/


    exports.slice = function (start, end) {
      var list = this.list.slice(start, end);
      return this.buildFrom(list);
    };
    /* grab nth result */


    exports.eq = function (n) {
      var p = this.list[n];

      if (p === undefined) {
        return this.buildFrom([]);
      }

      return this.buildFrom([p]);
    };

    exports.get = exports.eq;
    /** grab term[0] for every match */

    exports.firstTerm = function () {
      return this.match('^.');
    };
    /** grab the last term for every match  */


    exports.lastTerm = function () {
      return this.match('.$');
    };
    /** return a flat array of term objects */


    exports.termList = function (num) {
      var arr = []; //'reduce' but faster

      for (var i = 0; i < this.list.length; i++) {
        var terms = this.list[i].terms();

        for (var o = 0; o < terms.length; o++) {
          arr.push(terms[o]); //support .termList(4)

          if (num !== undefined && arr[num] !== undefined) {
            return arr[num];
          }
        }
      }

      return arr;
    };
  });
  var _02Accessors_1 = _02Accessors.first;
  var _02Accessors_2 = _02Accessors.last;
  var _02Accessors_3 = _02Accessors.slice;
  var _02Accessors_4 = _02Accessors.eq;
  var _02Accessors_5 = _02Accessors.get;
  var _02Accessors_6 = _02Accessors.firstTerm;
  var _02Accessors_7 = _02Accessors.lastTerm;
  var _02Accessors_8 = _02Accessors.termList;

  var _03Match = createCommonjsModule(function (module, exports) {
    /** return a new Doc, with this one as a parent */
    exports.match = function (reg) {
      //parse-up the input expression
      var regs = syntax_1(reg);

      if (regs.length === 0) {
        return this.buildFrom([]);
      } //try expression on each phrase


      var matches = this.list.reduce(function (arr, p) {
        return arr.concat(p.match(regs));
      }, []);
      return this.buildFrom(matches);
    };
    /** return all results except for this */


    exports.not = function (reg) {
      //parse-up the input expression
      var regs = syntax_1(reg); //if it's empty, return them all!

      if (regs.length === 0) {
        return this;
      } //try expression on each phrase


      var matches = this.list.reduce(function (arr, p) {
        return arr.concat(p.not(regs));
      }, []);
      return this.buildFrom(matches);
    };
    /** return only the first match */


    exports.matchOne = function (reg) {
      var regs = syntax_1(reg);

      for (var i = 0; i < this.list.length; i++) {
        var match = this.list[i].match(regs, true);
        return this.buildFrom(match);
      }

      return this.buildFrom([]);
    };
    /** return each current phrase, only if it contains this match */


    exports["if"] = function (reg) {
      var regs = syntax_1(reg);
      var found = this.list.filter(function (p) {
        return p.has(regs) === true;
      });
      return this.buildFrom(found);
    };
    /** Filter-out any current phrases that have this match*/


    exports.ifNo = function (reg) {
      var regs = syntax_1(reg);
      var found = this.list.filter(function (p) {
        return p.has(regs) === false;
      });
      return this.buildFrom(found);
    };
    /**Return a boolean if this match exists */


    exports.has = function (reg) {
      var regs = syntax_1(reg);
      return this.list.some(function (p) {
        return p.has(regs) === true;
      });
    };
    /** match any terms after our matches, within the sentence */


    exports.lookAhead = function (reg) {
      // find everything afterwards, by default
      if (!reg) {
        reg = '.*';
      }

      var regs = syntax_1(reg);
      var matches = [];
      this.list.forEach(function (p) {
        matches = matches.concat(p.lookAhead(regs));
      });
      matches = matches.filter(function (p) {
        return p;
      });
      return this.buildFrom(matches);
    };

    exports.lookAfter = exports.lookAhead;
    /** match any terms before our matches, within the sentence */

    exports.lookBehind = function (reg) {
      // find everything afterwards, by default
      if (!reg) {
        reg = '.*';
      }

      var regs = syntax_1(reg);
      var matches = [];
      this.list.forEach(function (p) {
        matches = matches.concat(p.lookBehind(regs));
      });
      matches = matches.filter(function (p) {
        return p;
      });
      return this.buildFrom(matches);
    };

    exports.lookBefore = exports.lookBehind;
    /** return all terms before a match, in each phrase */

    exports.before = function (reg) {
      var regs = syntax_1(reg); //only the phrases we care about

      var phrases = this["if"](regs).list;
      var befores = phrases.map(function (p) {
        var ids = p.terms().map(function (t) {
          return t.id;
        }); //run the search again

        var m = p.match(regs)[0];
        var index = ids.indexOf(m.start); //nothing is before a first-term match

        if (index === 0 || index === -1) {
          return null;
        }

        return p.buildFrom(p.start, index);
      });
      befores = befores.filter(function (p) {
        return p !== null;
      });
      return this.buildFrom(befores);
    };
    /** return all terms after a match, in each phrase */


    exports.after = function (reg) {
      var regs = syntax_1(reg); //only the phrases we care about

      var phrases = this["if"](regs).list;
      var befores = phrases.map(function (p) {
        var terms = p.terms();
        var ids = terms.map(function (t) {
          return t.id;
        }); //run the search again

        var m = p.match(regs)[0];
        var index = ids.indexOf(m.start); //skip if nothing is after it

        if (index === -1 || !terms[index + m.length]) {
          return null;
        } //create the new phrase, after our match.


        var id = terms[index + m.length].id;
        var len = p.length - index - m.length;
        return p.buildFrom(id, len);
      });
      befores = befores.filter(function (p) {
        return p !== null;
      });
      return this.buildFrom(befores);
    };
  });
  var _03Match_1 = _03Match.match;
  var _03Match_2 = _03Match.not;
  var _03Match_3 = _03Match.matchOne;
  var _03Match_4 = _03Match.ifNo;
  var _03Match_5 = _03Match.has;
  var _03Match_6 = _03Match.lookAhead;
  var _03Match_7 = _03Match.lookAfter;
  var _03Match_8 = _03Match.lookBehind;
  var _03Match_9 = _03Match.lookBefore;
  var _03Match_10 = _03Match.before;
  var _03Match_11 = _03Match.after;

  /** apply a tag, or tags to all terms */
  var tagTerms = function tagTerms(tag, doc, safe, reason) {
    var tagList = [];

    if (typeof tag === 'string') {
      tagList = tag.split(' ');
    } //do indepenent tags for each term:


    doc.list.forEach(function (p) {
      var terms = p.cache.terms || p.terms(); // tagSafe - apply only to fitting terms

      if (safe === true) {
        terms = terms.filter(function (t) {
          return t.canBe(tag, doc.world);
        });
      }

      terms.forEach(function (t, i) {
        //fancy version:
        if (tagList.length > 1) {
          if (tagList[i] && tagList[i] !== '.') {
            t.tag(tagList[i], reason, doc.world);
          }
        } else {
          //non-fancy version (same tag for all terms)
          t.tag(tag, reason, doc.world);
        }
      });
    });
    return;
  };

  var _setTag = tagTerms;

  /** Give all terms the given tag */

  var tag$1 = function tag(tags, why) {
    if (!tags) {
      return this;
    }

    _setTag(tags, this, false, why);
    return this;
  };
  /** Only apply tag to terms if it is consistent with current tags */


  var tagSafe$1 = function tagSafe(tags, why) {
    if (!tags) {
      return this;
    }

    _setTag(tags, this, true, why);
    return this;
  };
  /** Remove this term from the given terms */


  var unTag$1 = function unTag(tags, why) {
    var _this = this;

    this.list.forEach(function (p) {
      p.terms().forEach(function (t) {
        return t.unTag(tags, why, _this.world);
      });
    });
    return this;
  };
  /** return only the terms that can be this tag*/


  var canBe$2 = function canBe(tag) {
    if (!tag) {
      return this;
    }

    var world = this.world;
    var matches = this.list.reduce(function (arr, p) {
      return arr.concat(p.canBe(tag, world));
    }, []);
    return this.buildFrom(matches);
  };

  var _04Tag = {
    tag: tag$1,
    tagSafe: tagSafe$1,
    unTag: unTag$1,
    canBe: canBe$2
  };

  /* run each phrase through a function, and create a new document */
  var map = function map(fn) {
    var _this = this;

    if (!fn) {
      return this;
    }

    var list = this.list.map(function (p, i) {
      var doc = _this.buildFrom([p]);

      doc.from = null; //it's not a child/parent

      var res = fn(doc, i);

      if (res.list && res.list[0]) {
        return res.list[0];
      }

      return res;
    });

    if (list.length === 0) {
      return this.buildFrom(list);
    } // if it is not a list of Phrase objects, then don't try to make a Doc object


    if (_typeof(list[0]) !== 'object' || list[0].isA !== 'Phrase') {
      return list;
    }

    return this.buildFrom(list);
  };
  /** run a function on each phrase */


  var forEach = function forEach(fn, detachParent) {
    var _this2 = this;

    if (!fn) {
      return this;
    }

    this.list.forEach(function (p, i) {
      var sub = _this2.buildFrom([p]); // if we're doing fancy insertions, we may want to skip updating the parent each time.


      if (detachParent === true) {
        sub.from = null; //
      }

      fn(sub, i);
    });
    return this;
  };
  /** return only the phrases that return true */


  var filter = function filter(fn) {
    var _this3 = this;

    if (!fn) {
      return this;
    }

    var list = this.list.filter(function (p, i) {
      var doc = _this3.buildFrom([p]);

      doc.from = null; //it's not a child/parent

      return fn(doc, i);
    });
    return this.buildFrom(list);
  };
  /** return a document with only the first phrase that matches */


  var find = function find(fn) {
    var _this4 = this;

    if (!fn) {
      return this;
    }

    var phrase = this.list.find(function (p, i) {
      var doc = _this4.buildFrom([p]);

      doc.from = null; //it's not a child/parent

      return fn(doc, i);
    });

    if (phrase) {
      return this.buildFrom([phrase]);
    }

    return undefined;
  };
  /** return true or false if there is one matching phrase */


  var some = function some(fn) {
    var _this5 = this;

    if (!fn) {
      return this;
    }

    return this.list.some(function (p, i) {
      var doc = _this5.buildFrom([p]);

      doc.from = null; //it's not a child/parent

      return fn(doc, i);
    });
  };
  /** sample a subset of the results */


  var random = function random(n) {
    if (!this.found) {
      return this;
    }

    var r = Math.floor(Math.random() * this.list.length);

    if (n === undefined) {
      var list = [this.list[r]];
      return this.buildFrom(list);
    } //prevent it from going over the end


    if (r + n > this.length) {
      r = this.length - n;
      r = r < 0 ? 0 : r;
    }

    return this.slice(r, r + n);
  };
  /** combine each phrase into a new data-structure */
  // exports.reduce = function(fn, h) {
  //   let list = this.list.reduce((_h, ts) => {
  //     let doc = this.buildFrom([ts])
  //     doc.from = null //it's not a child/parent
  //     return fn(_h, doc)
  //   }, h)
  //   return this.buildFrom(list)
  // }


  var _05Loops = {
    map: map,
    forEach: forEach,
    filter: filter,
    find: find,
    some: some,
    random: random
  };

  var _06Lookup = createCommonjsModule(function (module, exports) {
    // compare one term and one match
    var doesMatch = function doesMatch(term, str) {
      if (str === '') {
        return false;
      }

      return term.reduced === str || term.implicit === str || term.root === str || term.text.toLowerCase() === str;
    }; // is this lookup found in these terms?


    var findStart = function findStart(arr, terms) {
      var _loop = function _loop(i) {
        if (doesMatch(terms[i], arr[0])) {
          if (arr.every(function (a, n) {
            return doesMatch(terms[i + n], a) === true;
          })) {
            return {
              v: terms[i].id
            };
          }
        }
      };

      //find the start
      for (var i = 0; i < terms.length; i++) {
        var _ret = _loop(i);

        if (_typeof(_ret) === "object") return _ret.v;
      }

      return false;
    };
    /** lookup an array of words or phrases */


    exports.lookup = function (arr) {
      var _this = this;

      if (typeof arr === 'string') {
        arr = [arr];
      }

      var lookups = arr.map(function (str) {
        str = str.toLowerCase();
        var words = _02Words(str);
        words = words.map(function (s) {
          return s.trim();
        });
        return words;
      });
      this.cache();
      var found = []; // try each lookup

      lookups.forEach(function (a) {
        //try each phrase
        _this.list.forEach(function (p) {
          // cache-miss, skip.
          if (p.cache.words[a[0]] !== true) {
            return;
          } //we found a potential match


          var terms = p.terms();
          var id = findStart(a, terms);

          if (id !== false) {
            // create the actual phrase
            var phrase = p.buildFrom(id, a.length);
            found.push(phrase);
            return;
          }
        });
      });
      return this.buildFrom(found);
    };

    exports.lookUp = exports.lookup;
  });
  var _06Lookup_1 = _06Lookup.lookup;
  var _06Lookup_2 = _06Lookup.lookUp;

  var titleCase$2 = function titleCase(str) {
    return str.charAt(0).toUpperCase() + str.substr(1);
  };
  /** substitute-in new content */


  var replaceWith = function replaceWith(replace) {
    var _this = this;

    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    if (!replace) {
      return this["delete"]();
    } //support old-style params


    if (options === true) {
      options = {
        keepTags: true
      };
    }

    if (options === false) {
      options = {
        keepTags: false
      };
    }

    options = options || {}; // clear the cache

    this.uncache(); // return this

    this.list.forEach(function (p) {
      var input = replace; // accept a function for replace

      if (typeof replace === 'function') {
        input = replace(p);
      }

      var newPhrases; // accept a Doc object to replace

      if (input && _typeof(input) === 'object' && input.isA === 'Doc') {
        newPhrases = input.list;

        _this.pool().merge(input.pool());
      } else if (typeof input === 'string') {
        //input is a string
        if (options.keepCase !== false && p.terms(0).isTitleCase()) {
          input = titleCase$2(input);
        }

        newPhrases = _01Tokenizer.fromText(input, _this.world, _this.pool()); //tag the new phrases

        var tmpDoc = _this.buildFrom(newPhrases);

        tmpDoc.tagger();
      } else {
        return; //don't even bother
      } // try to keep its old tags, if appropriate


      if (options.keepTags === true) {
        var oldTags = p.json({
          terms: {
            tags: true
          }
        }).terms;
        newPhrases[0].terms().forEach(function (t, i) {
          if (oldTags[i]) {
            t.tagSafe(oldTags[i].tags, 'keptTag', _this.world);
          }
        });
      }

      p.replace(newPhrases[0], _this); //Oneday: support multi-sentence replacements
    });
    return this;
  };
  /** search and replace match with new content */


  var replace$1 = function replace(match, _replace, options) {
    // if there's no 2nd param, use replaceWith
    if (_replace === undefined) {
      return this.replaceWith(match, options);
    }

    this.match(match).replaceWith(_replace, options);
    return this;
  };

  var _01Replace = {
    replaceWith: replaceWith,
    replace: replace$1
  };

  var _02Insert = createCommonjsModule(function (module, exports) {
    /** add these new terms to the end*/
    exports.append = function (str) {
      var _this = this;

      if (!str) {
        return this;
      } // clear the cache


      this.uncache(); //add it to end of every phrase

      this.list.forEach(function (p) {
        //build it
        var phrase = _01Tokenizer.fromText(str, _this.world, _this.pool())[0]; //assume it's one sentence, for now
        //tag it

        var tmpDoc = _this.buildFrom([phrase]);

        tmpDoc.tagger(); // push it onto the end

        p.append(phrase, _this);
      });
      return this;
    };

    exports.insertAfter = exports.append;
    exports.insertAt = exports.append;
    /** add these new terms to the front*/

    exports.prepend = function (str) {
      var _this2 = this;

      if (!str) {
        return this;
      } // clear the cache


      this.uncache(); //add it to start of every phrase

      this.list.forEach(function (p) {
        //build it
        var phrase = _01Tokenizer.fromText(str, _this2.world, _this2.pool())[0]; //assume it's one sentence, for now
        //tag it

        var tmpDoc = _this2.buildFrom([phrase]);

        tmpDoc.tagger(); // add it to the start

        p.prepend(phrase, _this2);
      });
      return this;
    };

    exports.insertBefore = exports.prepend;
    /** add these new things to the end*/

    exports.concat = function () {
      // clear the cache
      this.uncache();
      var list = this.list.slice(0); //repeat for any number of params

      for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i]; //support a fresh string

        if (typeof arg === 'string') {
          var arr = _01Tokenizer.fromText(arg, this.world); //TODO: phrase.tagger()?

          list = list.concat(arr);
        } else if (arg.isA === 'Doc') {
          list = list.concat(arg.list);
        } else if (arg.isA === 'Phrase') {
          list.push(arg);
        }
      }

      return this.buildFrom(list);
    };
    /** fully remove these terms from the document */


    exports["delete"] = function (match) {
      var _this3 = this;

      // clear the cache
      this.uncache();
      var toRemove = this;

      if (match) {
        toRemove = this.match(match);
      }

      toRemove.list.forEach(function (phrase) {
        return phrase["delete"](_this3);
      });
      return this;
    }; // aliases


    exports.remove = exports["delete"];
  });
  var _02Insert_1 = _02Insert.append;
  var _02Insert_2 = _02Insert.insertAfter;
  var _02Insert_3 = _02Insert.insertAt;
  var _02Insert_4 = _02Insert.prepend;
  var _02Insert_5 = _02Insert.insertBefore;
  var _02Insert_6 = _02Insert.concat;
  var _02Insert_7 = _02Insert.remove;

  var shouldTrim = {
    clean: true,
    reduced: true,
    root: true
  };
  /** return the document as text */

  var text$1 = function text(options) {
    var _this = this;

    options = options || {}; //are we showing every phrase?

    var showFull = false;

    if (this.parents().length === 0) {
      showFull = true;
    } // cache roots, if necessary


    if (options === 'root' || _typeof(options) === 'object' && options.root) {
      this.list.forEach(function (p) {
        p.terms().forEach(function (t) {
          if (t.root === null) {
            t.setRoot(_this.world);
          }
        });
      });
    }

    var txt = this.list.reduce(function (str, p, i) {
      var trimPre = !showFull && i === 0;
      var trimPost = !showFull && i === _this.list.length - 1;
      return str + p.text(options, trimPre, trimPost);
    }, ''); // clumsy final trim of leading/trailing whitespace

    if (shouldTrim[options] === true || options.reduced === true || options.clean === true || options.root === true) {
      txt = txt.trim();
    }

    return txt;
  };

  var _01Text = {
    text: text$1
  };

  var _02Json = createCommonjsModule(function (module, exports) {
    var jsonDefaults = {
      text: true,
      terms: true,
      trim: true
    }; // get all character startings in doc

    var termOffsets = function termOffsets(doc) {
      var elapsed = 0;
      var index = 0;
      var offsets = {};
      doc.termList().forEach(function (term) {
        offsets[term.id] = {
          index: index,
          start: elapsed + term.pre.length,
          length: term.text.length
        };
        elapsed += term.pre.length + term.text.length + term.post.length;
        index += 1;
      });
      return offsets;
    };
    /** pull out desired metadata from the document */


    exports.json = function () {
      var _this = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      //support json(3) format
      if (typeof options === 'number' && this.list[options]) {
        return this.list[options].json(jsonDefaults);
      }

      options = Object.assign({}, jsonDefaults, options); // cache roots, if necessary

      if (options === 'root' || _typeof(options) === 'object' && options.root) {
        this.list.forEach(function (p) {
          p.terms().forEach(function (t) {
            if (t.root === null) {
              t.setRoot(_this.world);
            }
          });
        });
      }

      if (options.unique) {
        options.reduced = true;
      }

      if (options.offset) {
        options.terms = options.terms === true ? {} : options.terms;
        options.terms.offset = true;
      }

      if (options.index || options.terms.index) {
        options.terms = options.terms === true ? {} : options.terms;
        options.terms.id = true;
      }

      var result = this.list.map(function (p) {
        return p.json(options, _this.world);
      }); // add offset and index data for each term

      if (options.terms.offset || options.offset || options.terms.index || options.index) {
        // calculate them, (from beginning of doc)
        var offsets = termOffsets(this.all()); // add index values

        if (options.terms.index || options.index) {
          result.forEach(function (o) {
            o.terms.forEach(function (t) {
              t.index = offsets[t.id].index;
            });
            o.index = o.terms[0].index;
          });
        } // add offset values


        if (options.terms.offset || options.offset) {
          result.forEach(function (o) {
            o.terms.forEach(function (t) {
              t.offset = offsets[t.id] || {};
            });
            var len = o.terms.reduce(function (n, t) {
              n += t.offset.length || 0;
              return n;
            }, 0);
            o.offset = o.terms[0].offset;
            o.offset.length = len;
          });
        }
      } // add frequency #s


      if (options.frequency || options.freq || options.count) {
        var obj = {};
        this.list.forEach(function (p) {
          var str = p.text('reduced');
          obj[str] = obj[str] || 0;
          obj[str] += 1;
        });
        this.list.forEach(function (p, i) {
          result[i].count = obj[p.text('reduced')];
        });
      } // remove duplicates


      if (options.unique) {
        var already = {};
        result = result.filter(function (o) {
          if (already[o.reduced] === true) {
            return false;
          }

          already[o.reduced] = true;
          return true;
        });
      }

      return result;
    }; //aliases


    exports.data = exports.json;
  });
  var _02Json_1 = _02Json.json;
  var _02Json_2 = _02Json.data;

  var _debug = createCommonjsModule(function (module) {
    // https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
    var reset = '\x1b[0m';

    var padEnd = function padEnd(str, width) {
      str = str.toString();

      while (str.length < width) {
        str += ' ';
      }

      return str;
    };

    function isClientSide() {
      return typeof window !== 'undefined' && window.document;
    } // some nice colors for client-side debug


    var css = {
      green: '#7f9c6c',
      red: '#914045',
      blue: '#6699cc',
      magenta: '#6D5685',
      cyan: '#2D85A8',
      yellow: '#e6d7b3',
      black: '#303b50'
    };

    var logClientSide = function logClientSide(doc) {
      doc.list.forEach(function (p) {
        console.log('\n%c"' + p.text() + '"', 'color: #e6d7b3;');
        var terms = p.cache.terms || p.terms();
        terms.forEach(function (t) {
          var tags$1 = Object.keys(t.tags);
          var text = t.text || '-';

          if (t.implicit) {
            text = '[' + t.implicit + ']';
          }

          var word = "'" + text + "'";
          word = padEnd(word, 8);
          var found = tags$1.find(function (tag) {
            return tags[tag] && tags[tag].color;
          });
          var color = 'steelblue';

          if (tags[found]) {
            color = tags[found].color;
            color = css[color];
          }

          console.log("   ".concat(word, "  -  %c").concat(tags$1.join(', ')), "color: ".concat(color || 'steelblue', ";"));
        });
      });
    }; //cheaper than requiring chalk


    var cli = {
      green: function green(str) {
        return '\x1b[32m' + str + reset;
      },
      red: function red(str) {
        return '\x1b[31m' + str + reset;
      },
      blue: function blue(str) {
        return '\x1b[34m' + str + reset;
      },
      magenta: function magenta(str) {
        return '\x1b[35m' + str + reset;
      },
      cyan: function cyan(str) {
        return '\x1b[36m' + str + reset;
      },
      yellow: function yellow(str) {
        return '\x1b[33m' + str + reset;
      },
      black: function black(str) {
        return '\x1b[30m' + str + reset;
      }
    };

    var tagString = function tagString(tags$1) {
      tags$1 = tags$1.map(function (tag) {
        if (!tags.hasOwnProperty(tag)) {
          return tag;
        }

        var c = tags[tag].color || 'blue';
        return cli[c](tag);
      });
      return tags$1.join(', ');
    }; //output some helpful stuff to the console


    var debug = function debug(doc) {
      if (isClientSide()) {
        logClientSide(doc);
        return doc;
      }

      console.log(cli.blue('====='));
      doc.list.forEach(function (p) {
        console.log(cli.blue('  -----'));
        var terms = p.cache.terms || p.terms();
        terms.forEach(function (t) {
          var tags = Object.keys(t.tags);
          var text = t.text || '-';

          if (t.implicit) {
            text = '[' + t.implicit + ']';
          }

          {
            text = cli.yellow(text);
          }

          var word = "'" + text + "'";
          word = padEnd(word, 18);
          var str = cli.blue('  ｜ ') + word + '  - ' + tagString(tags);
          console.log(str);
        });
      });
      console.log('');
      return doc;
    };

    module.exports = debug;
  });

  var topk = function topk(doc) {
    var list = doc.json({
      text: false,
      terms: false,
      reduced: true
    }); // combine them

    var obj = {};
    list.forEach(function (o) {
      if (!obj[o.reduced]) {
        o.count = 0;
        obj[o.reduced] = o;
      }

      obj[o.reduced].count += 1;
    });
    var arr = Object.keys(obj).map(function (k) {
      return obj[k];
    }); // sort them

    arr.sort(function (a, b) {
      if (a.count > b.count) {
        return -1;
      } else if (a.count < b.count) {
        return 1;
      }

      return 0;
    });
    return arr;
  };

  var _topk = topk;

  /** pretty-print the current document and its tags */

  var debug_1 = function debug_1() {
    _debug(this);
    return this;
  };
  /** some named output formats */


  var out = function out(method) {
    if (method === 'text') {
      return this.text();
    }

    if (method === 'normal') {
      return this.text('normal');
    }

    if (method === 'json') {
      return this.json();
    }

    if (method === 'offset' || method === 'offsets') {
      return this.json({
        offset: true
      });
    }

    if (method === 'array') {
      return this.json({
        terms: false
      }).map(function (obj) {
        return obj.text;
      });
    }

    if (method === 'freq' || method === 'frequency') {
      return _topk(this);
    }

    if (method === 'terms') {
      var list = [];
      this.json({
        text: false,
        terms: {
          text: true
        }
      }).forEach(function (obj) {
        var terms = obj.terms.map(function (t) {
          return t.text;
        });
        terms = terms.filter(function (t) {
          return t;
        });
        list = list.concat(terms);
      });
      return list;
    }

    if (method === 'tags') {
      return this.list.map(function (p) {
        return p.terms().reduce(function (h, t) {
          h[t.clean || t.implicit] = Object.keys(t.tags);
          return h;
        }, {});
      });
    }

    if (method === 'debug') {
      _debug(this);
      return this;
    }

    return this.text();
  };

  var _03Out = {
    debug: debug_1,
    out: out
  };

  // compress a list of things by frequency
  var topk$1 = function topk(list) {
    var counts = {};
    list.forEach(function (a) {
      counts[a] = counts[a] || 0;
      counts[a] += 1;
    });
    var arr = Object.keys(counts);
    arr = arr.sort(function (a, b) {
      if (counts[a] > counts[b]) {
        return -1;
      } else {
        return 1;
      }
    }); // arr = arr.filter(a => counts[a] > 1)

    return arr.map(function (a) {
      return [a, counts[a]];
    });
  }; // remove implied tags, like 'Noun' when we have 'Plural'


  var reduceTags = function reduceTags(tags, world) {
    var tagset = world.tags;
    var implied = [];
    tags.forEach(function (tag) {
      if (tagset[tag] && tagset[tag].isA) {
        implied = implied.concat(tagset[tag].isA);
      }
    });
    implied = implied.reduce(function (h, tag) {
      h[tag] = true;
      return h;
    }, {});
    tags = tags.filter(function (tag) {
      return !implied[tag];
    }); // tags

    return tags;
  };
  /** store a parsed document for later use */


  var export_1 = function export_1() {
    var _this = this;

    var phraseList = this.json({
      text: true,
      trim: false,
      terms: {
        tags: true,
        whitespace: true
      }
    }); // let phraseList = json.map(p => p.terms)

    var allTags = [];
    phraseList.forEach(function (p) {
      p.terms.forEach(function (t) {
        // reduce redundant tags
        var tags = reduceTags(t.tags, _this.world);
        allTags = allTags.concat(tags);
      });
    }); // compress the top tags

    allTags = topk$1(allTags);
    var tagMap = {};
    allTags.forEach(function (a, i) {
      tagMap[a[0]] = i;
    }); //use index numbers instead of redundant tag-names

    phraseList = phraseList.map(function (p) {
      var terms = p.terms.map(function (term) {
        var tags = term.tags;
        tags = reduceTags(tags, _this.world);
        tags = tags.map(function (tag) {
          return tagMap[tag];
        });
        tags = tags.join(',');
        return tags;
      });
      terms = terms.join('|');
      return [p.text, terms];
    });
    return {
      tags: Object.keys(tagMap),
      // words: {},
      list: phraseList
    };
  };

  var _04Export = {
    "export": export_1
  };

  var methods$2 = {
    /** alphabetical order */
    alpha: function alpha(a, b) {
      var left = a.text('clean');
      var right = b.text('clean');

      if (left < right) {
        return -1;
      }

      if (left > right) {
        return 1;
      }

      return 0;
    },

    /** count the # of characters of each match */
    length: function length(a, b) {
      var left = a.text().trim().length;
      var right = b.text().trim().length;

      if (left < right) {
        return 1;
      }

      if (left > right) {
        return -1;
      }

      return 0;
    },

    /** count the # of terms in each match */
    wordCount: function wordCount(a, b) {
      var left = a.wordCount();
      var right = b.wordCount();

      if (left < right) {
        return 1;
      }

      if (left > right) {
        return -1;
      }

      return 0;
    }
  };
  /** sort by # of duplicates in the document*/

  var byFreq = function byFreq(doc) {
    var counts = {};
    var options = {
      "case": true,
      punctuation: false,
      whitespace: true,
      unicode: true
    };
    doc.list.forEach(function (p) {
      var str = p.text(options);
      counts[str] = counts[str] || 0;
      counts[str] += 1;
    }); // sort by freq

    doc.list.sort(function (a, b) {
      var left = counts[a.text(options)];
      var right = counts[b.text(options)];

      if (left < right) {
        return 1;
      }

      if (left > right) {
        return -1;
      }

      return 0;
    });
    return doc;
  }; // order results 'chronologically', or document-order


  var sortSequential = function sortSequential(doc) {
    var order = {};
    doc.json({
      terms: {
        offset: true
      }
    }).forEach(function (o) {
      order[o.terms[0].id] = o.terms[0].offset.start;
    });
    doc.list = doc.list.sort(function (a, b) {
      if (order[a.start] > order[b.start]) {
        return 1;
      } else if (order[a.start] < order[b.start]) {
        return -1;
      }

      return 0;
    });
    return doc;
  }; //aliases


  methods$2.alphabetical = methods$2.alpha;
  methods$2.wordcount = methods$2.wordCount; // aliases for sequential ordering

  var seqNames = {
    index: true,
    sequence: true,
    seq: true,
    sequential: true,
    chron: true,
    chronological: true
  };
  /** re-arrange the order of the matches (in place) */

  var sort = function sort(input) {
    input = input || 'alpha'; //do this one up-front

    if (input === 'freq' || input === 'frequency' || input === 'topk') {
      return byFreq(this);
    }

    if (seqNames.hasOwnProperty(input)) {
      return sortSequential(this);
    }

    input = methods$2[input] || input; // apply sort method on each phrase

    if (typeof input === 'function') {
      this.list = this.list.sort(input);
      return this;
    }

    return this;
  };
  /** reverse the order of the matches, but not the words */


  var reverse = function reverse() {
    var list = [].concat(this.list);
    list = list.reverse();
    return this.buildFrom(list);
  };
  /** remove any duplicate matches */


  var unique$4 = function unique() {
    var list = [].concat(this.list);
    var obj = {};
    list = list.filter(function (p) {
      var str = p.text('reduced').trim();

      if (obj.hasOwnProperty(str) === true) {
        return false;
      }

      obj[str] = true;
      return true;
    });
    return this.buildFrom(list);
  };

  var _01Sort = {
    sort: sort,
    reverse: reverse,
    unique: unique$4
  };

  var isPunct = /[\[\]{}⟨⟩:,،、‒–—―…‹›«»‐\-;\/⁄·*\•^†‡°¡¿※№÷×ºª%‰=‱¶§~|‖¦©℗®℠™¤₳฿]/g;
  var quotes = /['‘’“”"′″‴]+/g;
  var methods$3 = {
    // cleanup newlines and extra spaces
    whitespace: function whitespace(doc) {
      var termArr = doc.list.map(function (ts) {
        return ts.terms();
      });
      termArr.forEach(function (terms, o) {
        terms.forEach(function (t, i) {
          // keep dashes between words
          if (t.hasDash() === true) {
            t.post = ' - ';
            return;
          } // remove existing spaces


          t.pre = t.pre.replace(/\s/g, '');
          t.post = t.post.replace(/\s/g, ''); //last word? ensure there's a next sentence.

          if (terms.length - 1 === i && !termArr[o + 1]) {
            return;
          } // no extra spaces for contractions


          if (t.implicit && Boolean(t.text) === true) {
            return;
          } // no extra spaces for hyphenated words


          if (t.hasHyphen() === true) {
            return;
          }

          t.post += ' ';
        });
      });
    },
    punctuation: function punctuation(termList) {
      termList.forEach(function (t) {
        // space between hyphenated words
        if (t.hasHyphen() === true) {
          t.post = ' ';
        }

        t.pre = t.pre.replace(isPunct, '');
        t.post = t.post.replace(isPunct, ''); // elipses

        t.post = t.post.replace(/\.\.\./, ''); // only allow one exclamation

        if (/!/.test(t.post) === true) {
          t.post = t.post.replace(/!/g, '');
          t.post = '!' + t.post;
        } // only allow one question mark


        if (/\?/.test(t.post) === true) {
          t.post = t.post.replace(/[\?!]*/, '');
          t.post = '?' + t.post;
        }
      });
    },
    unicode: function unicode(termList) {
      termList.forEach(function (t) {
        if (t.isImplicit() === true) {
          return;
        }

        t.text = unicode_1(t.text);
      });
    },
    quotations: function quotations(termList) {
      termList.forEach(function (t) {
        t.post = t.post.replace(quotes, '');
        t.pre = t.pre.replace(quotes, '');
      });
    },
    adverbs: function adverbs(doc) {
      doc.match('#Adverb').not('(not|nary|seldom|never|barely|almost|basically|so)').remove();
    },
    // remove the '.' from 'Mrs.' (safely)
    abbreviations: function abbreviations(doc) {
      doc.list.forEach(function (ts) {
        var terms = ts.terms();
        terms.forEach(function (t, i) {
          if (t.tags.Abbreviation === true && terms[i + 1]) {
            t.post = t.post.replace(/^\./, '');
          }
        });
      });
    }
  };
  var _methods = methods$3;

  var defaults = {
    // light
    whitespace: true,
    unicode: true,
    punctuation: true,
    emoji: true,
    acronyms: true,
    abbreviations: true,
    // medium
    "case": false,
    contractions: false,
    parentheses: false,
    quotations: false,
    adverbs: false,
    // heavy (loose legibility)
    possessives: false,
    verbs: false,
    nouns: false,
    honorifics: false // pronouns: true,

  };
  var mapping$1 = {
    light: {},
    medium: {
      "case": true,
      contractions: true,
      parentheses: true,
      quotations: true,
      adverbs: true
    }
  };
  mapping$1.heavy = Object.assign({}, mapping$1.medium, {
    possessives: true,
    verbs: true,
    nouns: true,
    honorifics: true
  });
  /** common ways to clean-up the document, and reduce noise */

  var normalize = function normalize(options) {
    options = options || {}; // support named forms

    if (typeof options === 'string') {
      options = mapping$1[options] || {};
    } // set defaults


    options = Object.assign({}, defaults, options); // clear the cache

    this.uncache();
    var termList = this.termList(); // lowercase things

    if (options["case"]) {
      this.toLowerCase();
    } //whitespace


    if (options.whitespace) {
      _methods.whitespace(this);
    } // unicode: é -> e


    if (options.unicode) {
      _methods.unicode(termList);
    } //punctuation - keep sentence punctation, quotes, parenths


    if (options.punctuation) {
      _methods.punctuation(termList);
    } // remove ':)'


    if (options.emoji) {
      this.remove('(#Emoji|#Emoticon)');
    } // 'f.b.i.' -> 'FBI'


    if (options.acronyms) {
      this.acronyms().strip(); // .toUpperCase()
    } // remove period from abbreviations


    if (options.abbreviations) {
      _methods.abbreviations(this);
    } // --Medium methods--
    // `isn't` -> 'is not'


    if (options.contraction || options.contractions) {
      this.contractions().expand();
    } // '(word)' -> 'word'


    if (options.parentheses) {
      this.parentheses().unwrap();
    } // remove "" punctuation


    if (options.quotations || options.quotes) {
      _methods.quotations(termList);
    } // remove any un-necessary adverbs


    if (options.adverbs) {
      _methods.adverbs(this);
    } // --Heavy methods--
    // `cory hart's -> cory hart'


    if (options.possessive || options.possessives) {
      this.possessives().strip();
    } // 'he walked' -> 'he walk'


    if (options.verbs) {
      this.verbs().toInfinitive();
    } // 'three dogs' -> 'three dog'


    if (options.nouns || options.plurals) {
      this.nouns().toSingular();
    } // remove 'Mr.' from 'Mr John Smith'


    if (options.honorifics) {
      this.remove('#Honorific');
    }

    return this;
  };

  var _02Normalize = {
    normalize: normalize
  };

  var _03Split = createCommonjsModule(function (module, exports) {
    /** return a Document with three parts for every match
     * seperate everything before the word, as a new phrase
     */
    exports.splitOn = function (reg) {
      // if there's no match, split parent, instead
      if (!reg) {
        var parent = this.parent();
        return parent.splitOn(this);
      } //start looking for a match..


      var regs = syntax_1(reg);
      var matches = [];
      this.list.forEach(function (p) {
        var foundEm = p.match(regs); //no match here, add full sentence

        if (foundEm.length === 0) {
          matches.push(p);
          return;
        } // we found something here.


        var carry = p;
        foundEm.forEach(function (found) {
          var parts = carry.splitOn(found); // add em in

          if (parts.before) {
            matches.push(parts.before);
          }

          if (parts.match) {
            matches.push(parts.match);
          } // start matching now on the end


          carry = parts.after;
        }); // add that last part

        if (carry) {
          matches.push(carry);
        }
      });
      return this.buildFrom(matches);
    };
    /** return a Document with two parts for every match
     * seperate everything after the word, as a new phrase
     */


    exports.splitAfter = function (reg) {
      // if there's no match, split parent, instead
      if (!reg) {
        var parent = this.parent();
        return parent.splitAfter(this);
      } // start looking for our matches


      var regs = syntax_1(reg);
      var matches = [];
      this.list.forEach(function (p) {
        var foundEm = p.match(regs); //no match here, add full sentence

        if (foundEm.length === 0) {
          matches.push(p);
          return;
        } // we found something here.


        var carry = p;
        foundEm.forEach(function (found) {
          var parts = carry.splitOn(found); // add em in

          if (parts.before && parts.match) {
            // merge these two together
            parts.before.length += parts.match.length;
            matches.push(parts.before);
          } else if (parts.match) {
            matches.push(parts.match);
          } // start matching now on the end


          carry = parts.after;
        }); // add that last part

        if (carry) {
          matches.push(carry);
        }
      });
      return this.buildFrom(matches);
    };

    exports.split = exports.splitAfter; //i guess?

    /** return a Document with two parts for every match */

    exports.splitBefore = function (reg) {
      // if there's no match, split parent, instead
      if (!reg) {
        var parent = this.parent();
        return parent.splitBefore(this);
      } //start looking for a match..


      var regs = syntax_1(reg);
      var matches = [];
      this.list.forEach(function (p) {
        var foundEm = p.match(regs); //no match here, add full sentence

        if (foundEm.length === 0) {
          matches.push(p);
          return;
        } // we found something here.


        var carry = p;
        foundEm.forEach(function (found) {
          var parts = carry.splitOn(found); // add before part in

          if (parts.before) {
            matches.push(parts.before);
          } // merge match+after


          if (parts.match && parts.after) {
            parts.match.length += parts.after.length;
          } // start matching now on the end


          carry = parts.match;
        }); // add that last part

        if (carry) {
          matches.push(carry);
        }
      });
      return this.buildFrom(matches);
    };
    /** split a document into labeled sections */


    exports.segment = function (regs, options) {
      regs = regs || {};
      options = options || {
        text: true
      };
      var doc = this;
      var keys = Object.keys(regs); // split em

      keys.forEach(function (k) {
        doc = doc.splitOn(k);
      }); //add labels for each section

      doc.list.forEach(function (p) {
        for (var i = 0; i < keys.length; i += 1) {
          if (p.has(keys[i])) {
            p.segment = regs[keys[i]];
            return;
          }
        }
      });
      return doc.list.map(function (p) {
        var res = p.json(options);
        res.segment = p.segment || null;
        return res;
      });
    };
  });
  var _03Split_1 = _03Split.splitOn;
  var _03Split_2 = _03Split.splitAfter;
  var _03Split_3 = _03Split.split;
  var _03Split_4 = _03Split.splitBefore;
  var _03Split_5 = _03Split.segment;

  var eachTerm = function eachTerm(doc, fn) {
    var world = doc.world;
    doc.list.forEach(function (p) {
      p.terms().forEach(function (t) {
        return t[fn](world);
      });
    });
    return doc;
  };
  /** turn every letter of every term to lower-cse */


  var toLowerCase = function toLowerCase() {
    return eachTerm(this, 'toLowerCase');
  };
  /** turn every letter of every term to upper case */


  var toUpperCase = function toUpperCase() {
    return eachTerm(this, 'toUpperCase');
  };
  /** upper-case the first letter of each term */


  var toTitleCase = function toTitleCase() {
    return eachTerm(this, 'toTitleCase');
  };
  /** remove whitespace and title-case each term */


  var toCamelCase = function toCamelCase() {
    this.list.forEach(function (p) {
      //remove whitespace
      var terms = p.terms();
      terms.forEach(function (t, i) {
        if (i !== 0) {
          t.toTitleCase();
        }

        if (i !== terms.length - 1) {
          t.post = '';
        }
      });
    }); // this.tag('#CamelCase', 'toCamelCase')

    return this;
  };

  var _04Case = {
    toLowerCase: toLowerCase,
    toUpperCase: toUpperCase,
    toTitleCase: toTitleCase,
    toCamelCase: toCamelCase
  };

  var _05Whitespace = createCommonjsModule(function (module, exports) {
    /** add this punctuation or whitespace before each match: */
    exports.pre = function (str, concat) {
      if (str === undefined) {
        return this.list[0].terms(0).pre;
      }

      this.list.forEach(function (p) {
        var term = p.terms(0);

        if (concat === true) {
          term.pre += str;
        } else {
          term.pre = str;
        }
      });
      return this;
    };
    /** add this punctuation or whitespace after each match: */


    exports.post = function (str, concat) {
      // return array of post strings
      if (str === undefined) {
        return this.list.map(function (p) {
          var terms = p.terms();
          var term = terms[terms.length - 1];
          return term.post;
        });
      } // set post string on all ends


      this.list.forEach(function (p) {
        var terms = p.terms();
        var term = terms[terms.length - 1];

        if (concat === true) {
          term.post += str;
        } else {
          term.post = str;
        }
      });
      return this;
    };
    /** remove start and end whitespace */


    exports.trim = function () {
      this.list = this.list.map(function (p) {
        return p.trim();
      });
      return this;
    };
    /** connect words with hyphen, and remove whitespace */


    exports.hyphenate = function () {
      this.list.forEach(function (p) {
        var terms = p.terms(); //remove whitespace

        terms.forEach(function (t, i) {
          if (i !== 0) {
            t.pre = '';
          }

          if (terms[i + 1]) {
            t.post = '-';
          }
        });
      });
      return this;
    };
    /** remove hyphens between words, and set whitespace */


    exports.dehyphenate = function () {
      var hasHyphen = /(-|–|—)/;
      this.list.forEach(function (p) {
        var terms = p.terms(); //remove whitespace

        terms.forEach(function (t) {
          if (hasHyphen.test(t.post)) {
            t.post = ' ';
          }
        });
      });
      return this;
    };

    exports.deHyphenate = exports.dehyphenate;
    /** add quotations around these matches */

    exports.toQuotations = function (start, end) {
      start = start || "\"";
      end = end || "\"";
      this.list.forEach(function (p) {
        var terms = p.terms();
        terms[0].pre = start + terms[0].pre;
        var last = terms[terms.length - 1];
        last.post = end + last.post;
      });
      return this;
    };

    exports.toQuotation = exports.toQuotations;
    /** add brackets around these matches */

    exports.toParentheses = function (start, end) {
      start = start || "(";
      end = end || ")";
      this.list.forEach(function (p) {
        var terms = p.terms();
        terms[0].pre = start + terms[0].pre;
        var last = terms[terms.length - 1];
        last.post = end + last.post;
      });
      return this;
    };
  });
  var _05Whitespace_1 = _05Whitespace.pre;
  var _05Whitespace_2 = _05Whitespace.post;
  var _05Whitespace_3 = _05Whitespace.trim;
  var _05Whitespace_4 = _05Whitespace.hyphenate;
  var _05Whitespace_5 = _05Whitespace.dehyphenate;
  var _05Whitespace_6 = _05Whitespace.deHyphenate;
  var _05Whitespace_7 = _05Whitespace.toQuotations;
  var _05Whitespace_8 = _05Whitespace.toQuotation;
  var _05Whitespace_9 = _05Whitespace.toParentheses;

  /** make all phrases into one phrase */
  var join = function join(str) {
    // clear the cache
    this.uncache(); // make one large phrase - 'main'

    var main = this.list[0];
    var before = main.length;
    var removed = {};

    for (var i = 1; i < this.list.length; i++) {
      var p = this.list[i];
      removed[p.start] = true;
      var term = main.lastTerm(); // add whitespace between them

      if (str) {
        term.post += str;
      } //  main -> p


      term.next = p.start; // main <- p

      p.terms(0).prev = term.id;
      main.length += p.length;
    } // parents are bigger than than their children.
    // when we increase a child, we increase their parent too.


    var increase = main.length - before;
    this.parents().forEach(function (doc) {
      // increase length on each effected phrase
      doc.list.forEach(function (p) {
        var terms = p.terms();

        for (var _i = 0; _i < terms.length; _i++) {
          if (terms[_i].id === main.start) {
            p.length += increase;
            break;
          }
        }
      }); // remove redundant phrases now

      doc.list = doc.list.filter(function (p) {
        return removed[p.start] !== true;
      });
    }); // return one major phrase

    return this.buildFrom([main]);
  };

  var _06Join = {
    join: join
  };

  var postPunct = /[,\)"';:\-–—\.…]/; // const irregulars = {
  //   'will not': `won't`,
  //   'i am': `i'm`,
  // }

  var setContraction = function setContraction(m, suffix) {
    if (!m.found) {
      return;
    }

    var terms = m.termList(); //avoid any problematic punctuation

    for (var i = 0; i < terms.length - 1; i++) {
      var t = terms[i];

      if (postPunct.test(t.post)) {
        return;
      }
    } // set them as implict


    terms.forEach(function (t) {
      t.implicit = t.clean;
    }); // perform the contraction

    terms[0].text += suffix; // clean-up the others

    terms.slice(1).forEach(function (t) {
      t.text = '';
    });

    for (var _i = 0; _i < terms.length - 1; _i++) {
      var _t = terms[_i];
      _t.post = _t.post.replace(/ /, '');
    }
  };
  /** turn 'i am' into i'm */


  var contract = function contract() {
    var doc = this.not('@hasContraction'); // we are -> we're

    var m = doc.match('(we|they|you) are');
    setContraction(m, "'re"); // they will -> they'll

    m = doc.match('(he|she|they|it|we|you) will');
    setContraction(m, "'ll"); // she is -> she's

    m = doc.match('(he|she|they|it|we) is');
    setContraction(m, "'s"); // spencer is -> spencer's

    m = doc.match('#Person is');
    setContraction(m, "'s"); // spencer would -> spencer'd

    m = doc.match('#Person would');
    setContraction(m, "'d"); // would not -> wouldn't

    m = doc.match('(is|was|had|would|should|could|do|does|have|has|can) not');
    setContraction(m, "n't"); // i have -> i've

    m = doc.match('(i|we|they) have');
    setContraction(m, "'ve"); // would have -> would've

    m = doc.match('(would|should|could) have');
    setContraction(m, "'ve"); // i am -> i'm

    m = doc.match('i am');
    setContraction(m, "'m"); // going to -> gonna

    m = doc.match('going to');
    return this;
  };

  var _07Contract = {
    contract: contract
  };

  var methods$4 = Object.assign({}, _01Utils$1, _02Accessors, _03Match, _04Tag, _05Loops, _06Lookup, _01Replace, _02Insert, _01Text, _02Json, _03Out, _04Export, _01Sort, _02Normalize, _03Split, _04Case, _05Whitespace, _06Join, _07Contract);

  var methods$5 = {}; // allow helper methods like .adjectives() and .adverbs()

  var arr = [['terms', '.'], ['hyphenated', '@hasHyphen .'], ['adjectives', '#Adjective'], ['hashTags', '#HashTag'], ['emails', '#Email'], ['emoji', '#Emoji'], ['emoticons', '#Emoticon'], ['atMentions', '#AtMention'], ['urls', '#Url'], ['adverbs', '#Adverb'], ['pronouns', '#Pronoun'], ['conjunctions', '#Conjunction'], ['prepositions', '#Preposition']];
  arr.forEach(function (a) {
    methods$5[a[0]] = function (n) {
      var m = this.match(a[1]);

      if (typeof n === 'number') {
        m = m.get(n);
      }

      return m;
    };
  }); // aliases

  methods$5.emojis = methods$5.emoji;
  methods$5.atmentions = methods$5.atMentions;
  methods$5.words = methods$5.terms;
  /** return anything tagged as a phone number */

  methods$5.phoneNumbers = function (n) {
    var m = this.splitAfter('@hasComma');
    m = m.match('#PhoneNumber+');

    if (typeof n === 'number') {
      m = m.get(n);
    }

    return m;
  };
  /** money + currency pair */


  methods$5.money = function (n) {
    var m = this.match('#Money #Currency?');

    if (typeof n === 'number') {
      m = m.get(n);
    }

    return m;
  };
  /** return all cities, countries, addresses, and regions */


  methods$5.places = function (n) {
    // don't split 'paris, france'
    var keep = this.match('(#City && @hasComma) (#Region|#Country)'); // but split the other commas

    var m = this.not(keep).splitAfter('@hasComma'); // combine them back together

    m = m.concat(keep);
    m.sort('index');
    m = m.match('#Place+');

    if (typeof n === 'number') {
      m = m.get(n);
    }

    return m;
  };
  /** return all schools, businesses and institutions */


  methods$5.organizations = function (n) {
    var m = this.clauses();
    m = m.match('#Organization+');

    if (typeof n === 'number') {
      m = m.get(n);
    }

    return m;
  }; //combine them with .topics() method


  methods$5.entities = function (n) {
    var r = this.clauses(); // Find people, places, and organizations

    var yup = r.people();
    yup = yup.concat(r.places());
    yup = yup.concat(r.organizations());
    var ignore = ['someone', 'man', 'woman', 'mother', 'brother', 'sister', 'father'];
    yup = yup.not(ignore); //return them to normal ordering

    yup.sort('sequence'); // yup.unique() //? not sure

    if (typeof n === 'number') {
      yup = yup.get(n);
    }

    return yup;
  }; //aliases


  methods$5.things = methods$5.entities;
  methods$5.topics = methods$5.entities;
  /** alias for .all() until it gets overloaded by plugin */

  methods$5.sentences = function () {
    return this.all();
  };

  var _simple = methods$5;

  var underOver = /^(under|over)-?/;
  /** match a word-sequence, like 'super bowl' in the lexicon */

  var tryMultiple = function tryMultiple(terms, t, world) {
    var lex = world.words; //try a two-word version

    var txt = terms[t].reduced + ' ' + terms[t + 1].reduced;

    if (lex[txt] !== undefined && lex.hasOwnProperty(txt) === true) {
      terms[t].tag(lex[txt], 'lexicon-two', world);
      terms[t + 1].tag(lex[txt], 'lexicon-two', world);
      return 1;
    } //try a three-word version?


    if (t + 2 < terms.length) {
      txt += ' ' + terms[t + 2].reduced;

      if (lex[txt] !== undefined && lex.hasOwnProperty(txt) === true) {
        terms[t].tag(lex[txt], 'lexicon-three', world);
        terms[t + 1].tag(lex[txt], 'lexicon-three', world);
        terms[t + 2].tag(lex[txt], 'lexicon-three', world);
        return 2;
      }
    } //try a four-word version?


    if (t + 3 < terms.length) {
      txt += ' ' + terms[t + 3].reduced;

      if (lex[txt] !== undefined && lex.hasOwnProperty(txt) === true) {
        terms[t].tag(lex[txt], 'lexicon-four', world);
        terms[t + 1].tag(lex[txt], 'lexicon-four', world);
        terms[t + 2].tag(lex[txt], 'lexicon-four', world);
        terms[t + 3].tag(lex[txt], 'lexicon-four', world);
        return 3;
      }
    }

    return 0;
  };
  /** look at each word in our list of known-words */


  var checkLexicon = function checkLexicon(terms, world) {
    var lex = world.words;
    var hasCompound = world.hasCompound; // use reduced?
    //go through each term, and check the lexicon

    for (var t = 0; t < terms.length; t += 1) {
      var str = terms[t].clean; //is it the start of a compound word, like 'super bowl'?

      if (hasCompound[str] === true && t + 1 < terms.length) {
        var foundWords = tryMultiple(terms, t, world);

        if (foundWords > 0) {
          t += foundWords; //skip any already-found words

          continue;
        }
      } //try one-word lexicon


      if (lex[str] !== undefined && lex.hasOwnProperty(str) === true) {
        terms[t].tag(lex[str], 'lexicon', world);
        continue;
      } // look at reduced version of term, too


      if (str !== terms[t].reduced && lex.hasOwnProperty(terms[t].reduced) === true) {
        terms[t].tag(lex[terms[t].reduced], 'lexicon', world);
        continue;
      } // prefix strip: try to match 'take' for 'undertake'


      if (underOver.test(str) === true) {
        var noPrefix = str.replace(underOver, '');

        if (lex.hasOwnProperty(noPrefix) === true) {
          terms[t].tag(lex[noPrefix], 'noprefix-lexicon', world);
        }
      }
    }

    return terms;
  };

  var _01Lexicon = checkLexicon;

  var apostrophes = /[\'‘’‛‵′`´]$/; //

  var checkPunctuation = function checkPunctuation(terms, i, world) {
    var term = terms[i]; //check hyphenation
    // if (term.post.indexOf('-') !== -1 && terms[i + 1] && terms[i + 1].pre === '') {
    //   term.tag('Hyphenated', 'has-hyphen', world)
    // }
    // support 'head-over'
    // if (term.hasHyphen() === true) {
    //   console.log(term.tags)
    // }
    // console.log(term.hasHyphen(), term.text)
    //an end-tick (trailing apostrophe) - flanders', or Carlos'

    if (apostrophes.test(term.text)) {
      if (!apostrophes.test(term.pre) && !apostrophes.test(term.post) && term.clean.length > 2) {
        var endChar = term.clean[term.clean.length - 2]; //flanders'

        if (endChar === 's') {
          term.tag(['Possessive', 'Noun'], 'end-tick', world);
          return;
        } //chillin'


        if (endChar === 'n') {
          term.tag(['Gerund'], 'chillin', world);
        }
      }
    } // 'NASA' is, but not 'i REALLY love it.'
    // if (term.tags.Noun === true && isAcronym(term, world)) {
    //   term.tag('Acronym', 'acronym-step', world)
    //   term.tag('Noun', 'acronym-infer', world)
    // } else if (!oneLetterWord.hasOwnProperty(term.text) && oneLetterAcronym.test(term.text)) {
    //   term.tag('Acronym', 'one-letter-acronym', world)
    //   term.tag('Noun', 'one-letter-infer', world)
    // }

  };

  var _02Punctuation$1 = checkPunctuation;

  //these are regexes applied to t.text, instead of t.clean
  // order matters.
  var startsWith = [//web tags
  [/^\w+@\w+\.[a-z]{2,3}$/, 'Email'], //not fancy
  [/^#[a-z0-9_\u00C0-\u00FF]{2,}$/, 'HashTag'], [/^@\w{2,}$/, 'AtMention'], [/^(https?:\/\/|www\.)\w+\.[a-z]{2,3}/, 'Url'], //with http/www
  [/^[\w./]+\.(com|net|gov|org|ly|edu|info|biz|ru|jp|de|in|uk|br)/, 'Url'], //http://mostpopularwebsites.net/top-level-domain
  //dates/times
  [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])$/, 'Time'], //4:32:32
  [/^[012]?[0-9](:[0-5][0-9])?(:[0-5][0-9])? ?(am|pm)$/, 'Time'], //4pm
  [/^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])? ?(am|pm)?$/, 'Time'], //4:00pm
  [/^[PMCE]ST$/, 'Time'], //PST, time zone abbrevs
  [/^utc ?[+-]?[0-9]+?$/, 'Time'], //UTC 8+
  [/^[a-z0-9]*? o\'?clock$/, 'Time'], //3 oclock
  [/^[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,4}$/, 'Date'], // 03-02-89
  [/^[0-9]{1,4}\/[0-9]{1,2}\/[0-9]{1,4}$/, 'Date'], // 03/02/89
  //names
  [/^ma?c\'.*/, 'LastName'], //mc'adams
  [/^o\'[drlkn].*/, 'LastName'], //o'douggan
  [/^ma?cd[aeiou]/, 'LastName'], //macdonell - Last patterns https://en.wikipedia.org/wiki/List_of_family_name_affixes
  //slang things
  [/^(lol)+[sz]$/, 'Expression'], //lol
  [/^(un|de|re)\\-[a-z\u00C0-\u00FF]{2}/, 'Verb'], // [/^(over|under)[a-z]{2,}/, 'Adjective'],
  [/^[0-9]{1,4}\.[0-9]{1,2}\.[0-9]{1,4}$/, 'Date'], // 03-02-89
  //phone numbers
  [/^[0-9]{3}-[0-9]{4}$/, 'PhoneNumber'], //589-3809
  [/^[0-9]{3}[ -]?[0-9]{3}-[0-9]{4}$/, 'PhoneNumber'], //632-589-3809
  //money
  // currency regex
  // /[\$\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6]
  //like $5.30
  [/^[-+]?[\$\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6][-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?(k|m|b|bn)?\+?$/, ['Money', 'Value']], //like 5.30$
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?[\$\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BD\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6]\+?$/, ['Money', 'Value']], //like 400usd
  [/^[-+]?[0-9]([0-9,.])+?(usd|eur|jpy|gbp|cad|aud|chf|cny|hkd|nzd|kr|rub)$/i, ['Money', 'Value']], //numbers
  // 50 | -50 | 3.23  | 5,999.0  | 10+
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?\+?$/, ['Cardinal', 'NumericValue']], [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?(st|nd|rd|th)$/, ['Ordinal', 'NumericValue']], // .73th
  [/^\.[0-9]+\+?$/, ['Cardinal', 'NumericValue']], //percent
  [/^[-+]?[0-9]+(,[0-9]{3})*(\.[0-9]+)?%\+?$/, ['Percent', 'Cardinal', 'NumericValue']], //7%  ..
  [/^\.[0-9]+%$/, ['Percent', 'Cardinal', 'NumericValue']], //.7%  ..
  //fraction
  [/^[0-9]{1,4}\/[0-9]{1,4}$/, 'Fraction'], //3/2ths
  //range
  [/^[0-9.]{1,2}[-–][0-9]{1,2}$/, ['Value', 'NumberRange']], //7-8
  [/^[0-9.]{1,4}(st|nd|rd|th)?[-–][0-9\.]{1,4}(st|nd|rd|th)?$/, 'NumberRange'], //5-7
  //with unit
  [/^[0-9.]+([a-z]{1,4})$/, 'Value'] //like 5tbsp
  //ordinal
  // [/^[0-9][0-9,.]*(st|nd|rd|r?th)$/, ['NumericValue', 'Ordinal']], //like 5th
  // [/^[0-9]+(st|nd|rd|th)$/, 'Ordinal'], //like 5th
  ];

  var romanNumeral = /^[IVXLCDM]{2,}$/;
  var romanNumValid = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/; //  https://stackoverflow.com/a/267405/168877
  //try each of the ^regexes in our list

  var checkRegex = function checkRegex(term, world) {
    var str = term.text; // do them all!

    for (var r = 0; r < startsWith.length; r += 1) {
      if (startsWith[r][0].test(str) === true) {
        term.tagSafe(startsWith[r][1], 'prefix #' + r, world);
        break;
      }
    } // do some more!
    //roman numberals - XVII


    if (term.text.length >= 2 && romanNumeral.test(str) && romanNumValid.test(str)) {
      term.tag('RomanNumeral', 'xvii', world);
    }
  };

  var _03Prefixes = checkRegex;

  //regex suffix patterns and their most common parts of speech,
  //built using wordnet, by spencer kelly.
  //this mapping shrinks-down the uglified build
  var Adj = 'Adjective';
  var Inf = 'Infinitive';
  var Pres = 'PresentTense';
  var Sing = 'Singular';
  var Past = 'PastTense';
  var Adverb = 'Adverb';
  var Exp = 'Expression';
  var Actor = 'Actor';
  var Verb = 'Verb';
  var Noun = 'Noun';
  var Last = 'LastName'; //the order here matters.
  //regexes indexed by mandated last-character

  var endsWith$1 = {
    a: [[/.[aeiou]na$/, Noun], [/.[oau][wvl]ska$/, Last], //polish (female)
    [/.[^aeiou]ica$/, Sing], [/^([hyj]a)+$/, Exp] //hahah
    ],
    c: [[/.[^aeiou]ic$/, Adj]],
    d: [//==-ed==
    //double-consonant
    [/[aeiou](pp|ll|ss|ff|gg|tt|rr|bb|nn|mm)ed$/, Past], //popped, planned
    //double-vowel
    [/.[aeo]{2}[bdgmnprvz]ed$/, Past], //beeped, mooned, veered
    //-hed
    [/.[aeiou][sg]hed$/, Past], //stashed, sighed
    //-rd
    [/.[aeiou]red$/, Past], //stored
    [/.[aeiou]r?ried$/, Past], //buried
    //-led
    [/.[bcdgtr]led$/, Past], //startled, rumbled
    [/.[aoui]f?led$/, Past], //impaled, stifled
    //-sed
    [/.[iao]sed$/, Past], //franchised
    [/[aeiou]n?[cs]ed$/, Past], //laced, lanced
    //-med
    [/[aeiou][rl]?[mnf]ed$/, Past], //warmed, attained, engulfed
    //-ked
    [/[aeiou][ns]?c?ked$/, Past], //hooked, masked
    //-ged
    [/[aeiou][nl]?ged$/, Past], //engaged
    //-ted
    [/.[tdbwxz]ed$/, Past], //bribed, boxed
    [/[^aeiou][aeiou][tvx]ed$/, Past], //boxed
    //-ied
    [/.[cdlmnprstv]ied$/, Past], //rallied
    [/[^aeiou]ard$/, Sing], //card
    [/[aeiou][^aeiou]id$/, Adj], [/.[vrl]id$/, Adj]],
    e: [[/.[lnr]ize$/, Inf], [/.[^aeiou]ise$/, Inf], [/.[aeiou]te$/, Inf], [/.[^aeiou][ai]ble$/, Adj], [/.[^aeiou]eable$/, Adj], [/.[ts]ive$/, Adj]],
    h: [[/.[^aeiouf]ish$/, Adj], [/.v[iy]ch$/, Last], //east-europe
    [/^ug?h+$/, Exp], //uhh
    [/^uh[ -]?oh$/, Exp] //uhoh
    ],
    i: [[/.[oau][wvl]ski$/, Last] //polish (male)
    ],
    k: [[/^(k)+$/, Exp] //kkkk
    ],
    l: [[/.[gl]ial$/, Adj], [/.[^aeiou]ful$/, Adj], [/.[nrtumcd]al$/, Adj], [/.[^aeiou][ei]al$/, Adj]],
    m: [[/.[^aeiou]ium$/, Sing], [/[^aeiou]ism$/, Sing], [/^h*u*m+$/, Exp], //mmmmmmm / ummmm / huuuuuummmmmm
    [/^\d+ ?[ap]m$/, 'Date']],
    n: [[/.[lsrnpb]ian$/, Adj], [/[^aeiou]ician$/, Actor], [/[aeiou][ktrp]in$/, 'Gerund'] // 'cookin', 'hootin'
    ],
    o: [[/^no+$/, Exp], //noooo
    [/^(yo)+$/, Exp], //yoyo
    [/^woo+[pt]?$/, Exp] //woo
    ],
    r: [[/.[bdfklmst]ler$/, 'Noun'], [/.[ilk]er$/, 'Comparative'], [/[aeiou][pns]er$/, Sing], [/[^i]fer$/, Inf], [/.[^aeiou][ao]pher$/, Actor]],
    t: [[/.[di]est$/, 'Superlative'], [/.[icldtgrv]ent$/, Adj], [/[aeiou].*ist$/, Adj], [/^[a-z]et$/, Verb]],
    s: [[/.[rln]ates$/, Pres], [/.[^z]ens$/, Verb], [/.[lstrn]us$/, Sing], [/.[aeiou]sks$/, Pres], //masks
    [/.[aeiou]kes$/, Pres], //bakes
    [/[aeiou][^aeiou]is$/, Sing], [/[a-z]\'s$/, Noun], [/^yes+$/, Exp] //yessss
    ],
    v: [[/.[^aeiou][ai][kln]ov$/, Last] //east-europe
    ],
    y: [[/.[cts]hy$/, Adj], [/.[st]ty$/, Adj], [/.[gk]y$/, Adj], [/.[tnl]ary$/, Adj], [/.[oe]ry$/, Sing], [/[rdntkbhs]ly$/, Adverb], [/...lly$/, Adverb], [/[bszmp]{2}y$/, Adj], [/.(gg|bb|zz)ly$/, Adj], [/.[aeiou]my$/, Adj], [/[ea]{2}zy$/, Adj], [/.[^aeiou]ity$/, Sing]]
  };

  //just a foolish lookup of known suffixes
  var Adj$1 = 'Adjective';
  var Inf$1 = 'Infinitive';
  var Pres$1 = 'PresentTense';
  var Sing$1 = 'Singular';
  var Past$1 = 'PastTense';
  var Avb = 'Adverb';
  var Plrl = 'Plural';
  var Actor$1 = 'Actor';
  var Vb = 'Verb';
  var Noun$1 = 'Noun';
  var Last$1 = 'LastName';
  var Modal = 'Modal'; // find any issues - https://observablehq.com/@spencermountain/suffix-word-lookup

  var suffixMap = [null, //0
  null, //1
  {
    //2-letter
    ea: Sing$1,
    ia: Noun$1,
    ic: Adj$1,
    ly: Avb,
    "'n": Vb,
    "'t": Vb
  }, {
    //3-letter
    oed: Past$1,
    ued: Past$1,
    xed: Past$1,
    ' so': Avb,
    "'ll": Modal,
    "'re": 'Copula',
    azy: Adj$1,
    end: Vb,
    ped: Past$1,
    ffy: Adj$1,
    ify: Inf$1,
    ing: 'Gerund',
    //likely to be converted to Adj after lexicon pass
    ize: Inf$1,
    lar: Adj$1,
    mum: Adj$1,
    nes: Pres$1,
    nny: Adj$1,
    oid: Adj$1,
    ous: Adj$1,
    que: Adj$1,
    rmy: Adj$1,
    rol: Sing$1,
    sis: Sing$1,
    zes: Pres$1
  }, {
    //4-letter
    amed: Past$1,
    aped: Past$1,
    ched: Past$1,
    lked: Past$1,
    nded: Past$1,
    cted: Past$1,
    dged: Past$1,
    akis: Last$1,
    //greek
    cede: Inf$1,
    chuk: Last$1,
    //east-europe
    czyk: Last$1,
    //polish (male)
    ects: Pres$1,
    ends: Vb,
    enko: Last$1,
    //east-europe
    ette: Sing$1,
    fies: Pres$1,
    fore: Avb,
    gate: Inf$1,
    gone: Adj$1,
    ices: Plrl,
    ints: Plrl,
    ions: Plrl,
    less: Avb,
    llen: Adj$1,
    made: Adj$1,
    nsen: Last$1,
    //norway
    oses: Pres$1,
    ould: Modal,
    some: Adj$1,
    sson: Last$1,
    //swedish male
    tage: Inf$1,
    teen: 'Value',
    tion: Sing$1,
    tive: Adj$1,
    tors: Noun$1,
    vice: Sing$1
  }, {
    //5-letter
    tized: Past$1,
    urned: Past$1,
    eased: Past$1,
    ances: Plrl,
    bound: Adj$1,
    ettes: Plrl,
    fully: Avb,
    ishes: Pres$1,
    ities: Plrl,
    marek: Last$1,
    //polish (male)
    nssen: Last$1,
    //norway
    ology: Noun$1,
    ports: Plrl,
    rough: Adj$1,
    tches: Pres$1,
    tieth: 'Ordinal',
    tures: Plrl,
    wards: Avb,
    where: Avb
  }, {
    //6-letter
    auskas: Last$1,
    //lithuania
    keeper: Actor$1,
    logist: Actor$1,
    teenth: 'Value'
  }, {
    //7-letter
    opoulos: Last$1,
    //greek
    sdottir: Last$1 //swedish female

  }];

  var endRegexs = function endRegexs(term, world) {
    var str = term.clean;
    var _char = str[str.length - 1];

    if (endsWith$1.hasOwnProperty(_char) === true) {
      var regs = endsWith$1[_char];

      for (var r = 0; r < regs.length; r += 1) {
        if (regs[r][0].test(str) === true) {
          term.tagSafe(regs[r][1], "endReg ".concat(_char, " #").concat(r), world);
          break;
        }
      }
    }
  }; //sweep-through all suffixes


  var knownSuffixes = function knownSuffixes(term, world) {
    var len = term.clean.length;
    var max = 7;

    if (len <= max) {
      max = len - 1;
    }

    for (var i = max; i > 1; i -= 1) {
      var str = term.clean.substr(len - i, len);

      if (suffixMap[str.length].hasOwnProperty(str) === true) {
        var tag = suffixMap[str.length][str];
        term.tagSafe(tag, 'suffix -' + str, world);
        break;
      }
    }
  }; //all-the-way-down!


  var checkRegex$1 = function checkRegex(term, world) {
    knownSuffixes(term, world);
    endRegexs(term, world);
  };

  var _04Suffixes = checkRegex$1;

  //just some of the most common emoticons
  //faster than
  //http://stackoverflow.com/questions/28077049/regex-matching-emoticons
  var emoticons = {
    ':(': true,
    ':)': true,
    ':P': true,
    ':p': true,
    ':O': true,
    ':3': true,
    ':|': true,
    ':/': true,
    ':\\': true,
    ':$': true,
    ':*': true,
    ':@': true,
    ':-(': true,
    ':-)': true,
    ':-P': true,
    ':-p': true,
    ':-O': true,
    ':-3': true,
    ':-|': true,
    ':-/': true,
    ':-\\': true,
    ':-$': true,
    ':-*': true,
    ':-@': true,
    ':^(': true,
    ':^)': true,
    ':^P': true,
    ':^p': true,
    ':^O': true,
    ':^3': true,
    ':^|': true,
    ':^/': true,
    ':^\\': true,
    ':^$': true,
    ':^*': true,
    ':^@': true,
    '):': true,
    '(:': true,
    '$:': true,
    '*:': true,
    ')-:': true,
    '(-:': true,
    '$-:': true,
    '*-:': true,
    ')^:': true,
    '(^:': true,
    '$^:': true,
    '*^:': true,
    '<3': true,
    '</3': true,
    '<\\3': true
  };

  var emojiReg = /^(\u00a9|\u00ae|[\u2319-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/; //for us, there's three types -
  // * ;) - emoticons
  // * 🌵 - unicode emoji
  // * :smiling_face: - asci-represented emoji
  //test for forms like ':woman_tone2:‍:ear_of_rice:'
  //https://github.com/Kikobeats/emojis-keywords/blob/master/index.js

  var isCommaEmoji = function isCommaEmoji(raw) {
    if (raw.charAt(0) === ':') {
      //end comma can be last or second-last ':haircut_tone3:‍♀️'
      if (raw.match(/:.?$/) === null) {
        return false;
      } //ensure no spaces


      if (raw.match(' ')) {
        return false;
      } //reasonably sized


      if (raw.length > 35) {
        return false;
      }

      return true;
    }

    return false;
  }; //check against emoticon whitelist


  var isEmoticon = function isEmoticon(str) {
    str = str.replace(/^[:;]/, ':'); //normalize the 'eyes'

    return emoticons.hasOwnProperty(str);
  };

  var tagEmoji = function tagEmoji(term, world) {
    var raw = term.pre + term.text + term.post;
    raw = raw.trim(); //dont double-up on ending periods

    raw = raw.replace(/[.!?,]$/, ''); //test for :keyword: emojis

    if (isCommaEmoji(raw) === true) {
      term.tag('Emoji', 'comma-emoji', world);
      term.text = raw;
      term.pre = term.pre.replace(':', '');
      term.post = term.post.replace(':', '');
    } //test for unicode emojis


    if (term.text.match(emojiReg)) {
      term.tag('Emoji', 'unicode-emoji', world);
      term.text = raw;
    } //test for emoticon ':)' emojis


    if (isEmoticon(raw) === true) {
      term.tag('Emoticon', 'emoticon-emoji', world);
      term.text = raw;
    }
  };

  var _05Emoji = tagEmoji;

  var steps = {
    lexicon: _01Lexicon,
    punctuation: _02Punctuation$1,
    regex: _03Prefixes,
    suffix: _04Suffixes,
    emoji: _05Emoji
  }; //'lookups' look at a term by itself

  var lookups = function lookups(doc, terms) {
    var world = doc.world; //our list of known-words

    steps.lexicon(terms, world); //try these other methods

    for (var i = 0; i < terms.length; i += 1) {
      var term = terms[i]; //or maybe some helpful punctuation

      steps.punctuation(terms, i, world); //mostly prefix checks

      steps.regex(term, world); //maybe we can guess

      steps.suffix(term, world); //emoji and emoticons

      steps.emoji(term, world);
    }

    return doc;
  };

  var _01Init = lookups;

  //markov-like stats about co-occurance, for hints about unknown terms
  //basically, a little-bit better than the noun-fallback
  //just top n-grams from nlp tags, generated from nlp-corpus
  //after this word, here's what happens usually
  var afterThisWord = {
    i: 'Verb',
    //44% //i walk..
    first: 'Noun',
    //50% //first principles..
    it: 'Verb',
    //33%
    there: 'Verb',
    //35%
    not: 'Verb',
    //33%
    because: 'Noun',
    //31%
    "if": 'Noun',
    //32%
    but: 'Noun',
    //26%
    who: 'Verb',
    //40%
    "this": 'Noun',
    //37%
    his: 'Noun',
    //48%
    when: 'Noun',
    //33%
    you: 'Verb',
    //35%
    very: 'Adjective',
    // 39%
    old: 'Noun',
    //51%
    never: 'Verb',
    //42%
    before: 'Noun' //28%

  }; //in advance of this word, this is what happens usually

  var beforeThisWord = {
    there: 'Verb',
    //23% // be there
    me: 'Verb',
    //31% //see me
    man: 'Adjective',
    // 80% //quiet man
    only: 'Verb',
    //27% //sees only
    him: 'Verb',
    //32% //show him
    were: 'Noun',
    //48% //we were
    took: 'Noun',
    //38% //he took
    himself: 'Verb',
    //31% //see himself
    went: 'Noun',
    //43% //he went
    who: 'Noun',
    //47% //person who
    jr: 'Person'
  }; //following this POS, this is likely

  var afterThisPOS = {
    Adjective: 'Noun',
    //36% //blue dress
    Possessive: 'Noun',
    //41% //his song
    Determiner: 'Noun',
    //47%
    Adverb: 'Verb',
    //20%
    Pronoun: 'Verb',
    //40%
    Value: 'Noun',
    //47%
    Ordinal: 'Noun',
    //53%
    Modal: 'Verb',
    //35%
    Superlative: 'Noun',
    //43%
    Demonym: 'Noun',
    //38%
    Honorific: 'Person' //

  }; //in advance of this POS, this is likely

  var beforeThisPOS = {
    Copula: 'Noun',
    //44% //spencer is
    PastTense: 'Noun',
    //33% //spencer walked
    Conjunction: 'Noun',
    //36%
    Modal: 'Noun',
    //38%
    Pluperfect: 'Noun',
    //40%
    PerfectTense: 'Verb' //32%

  };
  var markov = {
    beforeThisWord: beforeThisWord,
    afterThisWord: afterThisWord,
    beforeThisPos: beforeThisPOS,
    afterThisPos: afterThisPOS
  };

  var afterKeys = Object.keys(markov.afterThisPos);
  var beforeKeys = Object.keys(markov.beforeThisPos);

  var checkNeighbours = function checkNeighbours(terms, world) {
    var _loop = function _loop(i) {
      var term = terms[i]; //do we still need a tag?

      if (term.isKnown() === true) {
        return "continue";
      } //ok, this term needs a tag.
      //look at previous word for clues..


      var lastTerm = terms[i - 1];

      if (lastTerm) {
        // 'foobar term'
        if (markov.afterThisWord.hasOwnProperty(lastTerm.clean) === true) {
          var tag = markov.afterThisWord[lastTerm.clean];
          term.tag(tag, 'after-' + lastTerm.clean, world);
          return "continue";
        } // 'Tag term'
        // (look at previous POS tags for clues..)


        var foundTag = afterKeys.find(function (tag) {
          return lastTerm.tags[tag];
        });

        if (foundTag !== undefined) {
          var _tag = markov.afterThisPos[foundTag];
          term.tag(_tag, 'after-' + foundTag, world);
          return "continue";
        }
      } //look at next word for clues..


      var nextTerm = terms[i + 1];

      if (nextTerm) {
        // 'term foobar'
        if (markov.beforeThisWord.hasOwnProperty(nextTerm.clean) === true) {
          var _tag2 = markov.beforeThisWord[nextTerm.clean];
          term.tag(_tag2, 'before-' + nextTerm.clean, world);
          return "continue";
        } // 'term Tag'
        // (look at next POS tags for clues..)


        var _foundTag = beforeKeys.find(function (tag) {
          return nextTerm.tags[tag];
        });

        if (_foundTag !== undefined) {
          var _tag3 = markov.beforeThisPos[_foundTag];
          term.tag(_tag3, 'before-' + _foundTag, world);
          return "continue";
        }
      }
    };

    for (var i = 0; i < terms.length; i += 1) {
      var _ret = _loop(i);

      if (_ret === "continue") continue;
    }
  };

  var _01Neighbours = checkNeighbours;

  var titleCase$3 = /^[A-Z][a-z'\u00C0-\u00FF]/;
  var hasNumber = /[0-9]/;
  /** look for any grammar signals based on capital/lowercase */

  var checkCase = function checkCase(doc) {
    var world = doc.world;
    doc.list.forEach(function (p) {
      var terms = p.terms();

      for (var i = 1; i < terms.length; i++) {
        var term = terms[i];

        if (titleCase$3.test(term.text) === true && hasNumber.test(term.text) === false) {
          term.tag('ProperNoun', 'titlecase-noun', world);
        }
      }
    });
  };

  var _02Case = checkCase;

  var hasPrefix = /^(re|un)-?[a-z\u00C0-\u00FF]/;
  var prefix = /^(re|un)-?/;
  /** check 'rewatch' in lexicon as 'watch' */

  var checkPrefix = function checkPrefix(terms, world) {
    var lex = world.words;
    terms.forEach(function (term) {
      // skip if we have a good tag already
      if (term.isKnown() === true) {
        return;
      } //does it start with 'un|re'


      if (hasPrefix.test(term.clean) === true) {
        // look for the root word in the lexicon:
        var stem = term.clean.replace(prefix, '');

        if (stem && stem.length > 3 && lex[stem] !== undefined && lex.hasOwnProperty(stem) === true) {
          term.tag(lex[stem], 'stem-' + stem, world);
        }
      }
    });
  };

  var _03Stem = checkPrefix;

  //similar to plural/singularize rules, but not the same
  var isPlural = [/(^v)ies$/i, /ises$/i, /ives$/i, /(antenn|formul|nebul|vertebr|vit)ae$/i, /(octop|vir|radi|nucle|fung|cact|stimul)i$/i, /(buffal|tomat|tornad)oes$/i, /(analy|ba|diagno|parenthe|progno|synop|the)ses$/i, /(vert|ind|cort)ices$/i, /(matr|append)ices$/i, /(x|ch|ss|sh|s|z|o)es$/i, /is$/i, /men$/i, /news$/i, /.tia$/i, /(^f)ves$/i, /(lr)ves$/i, /(^aeiouy|qu)ies$/i, /(m|l)ice$/i, /(cris|ax|test)es$/i, /(alias|status)es$/i, /ics$/i]; //similar to plural/singularize rules, but not the same

  var isSingular = [/(ax|test)is$/i, /(octop|vir|radi|nucle|fung|cact|stimul)us$/i, /(octop|vir)i$/i, /(rl)f$/i, /(alias|status)$/i, /(bu)s$/i, /(al|ad|at|er|et|ed|ad)o$/i, /(ti)um$/i, /(ti)a$/i, /sis$/i, /(?:(^f)fe|(lr)f)$/i, /hive$/i, /s[aeiou]+ns$/i, // sans, siens
  /(^aeiouy|qu)y$/i, /(x|ch|ss|sh|z)$/i, /(matr|vert|ind|cort)(ix|ex)$/i, /(m|l)ouse$/i, /(m|l)ice$/i, /(antenn|formul|nebul|vertebr|vit)a$/i, /.sis$/i, /^(?!talis|.*hu)(.*)man$/i];
  var isPlural_1 = {
    isSingular: isSingular,
    isPlural: isPlural
  };

  var noPlurals = ['Uncountable', 'Pronoun', 'Place', 'Value', 'Person', 'Month', 'WeekDay', 'Holiday'];
  var notPlural = [/ss$/, /sis$/, /[^aeiou][uo]s$/, /'s$/];
  var notSingular = [/i$/, /ae$/];
  /** turn nouns into singular/plural */

  var checkPlural = function checkPlural(t, world) {
    if (t.tags.Noun && !t.tags.Acronym) {
      var str = t.clean; //skip existing tags, fast

      if (t.tags.Singular || t.tags.Plural) {
        return;
      } //too short


      if (str.length <= 3) {
        t.tag('Singular', 'short-singular', world);
        return;
      } //is it impossible to be plural?


      if (noPlurals.find(function (tag) {
        return t.tags[tag];
      })) {
        return;
      } // isPlural suffix rules


      if (isPlural_1.isPlural.find(function (reg) {
        return reg.test(str);
      })) {
        t.tag('Plural', 'plural-rules', world);
        return;
      } // isSingular suffix rules


      if (isPlural_1.isSingular.find(function (reg) {
        return reg.test(str);
      })) {
        t.tag('Singular', 'singular-rules', world);
        return;
      } // finally, fallback 'looks plural' rules..


      if (/s$/.test(str) === true) {
        //avoid anything too sketchy to be plural
        if (notPlural.find(function (reg) {
          return reg.test(str);
        })) {
          return;
        }

        t.tag('Plural', 'plural-fallback', world);
        return;
      } //avoid anything too sketchy to be singular


      if (notSingular.find(function (reg) {
        return reg.test(str);
      })) {
        return;
      }

      t.tag('Singular', 'singular-fallback', world);
    }
  };

  var _04Plurals = checkPlural;

  //nouns that also signal the title of an unknown organization
  //todo remove/normalize plural forms
  var orgWords = ['academy', 'administration', 'agence', 'agences', 'agencies', 'agency', 'airlines', 'airways', 'army', 'assoc', 'associates', 'association', 'assurance', 'authority', 'autorite', 'aviation', 'bank', 'banque', 'board', 'boys', 'brands', 'brewery', 'brotherhood', 'brothers', 'building society', 'bureau', 'cafe', 'caisse', 'capital', 'care', 'cathedral', 'center', 'central bank', 'centre', 'chemicals', 'choir', 'chronicle', 'church', 'circus', 'clinic', 'clinique', 'club', 'co', 'coalition', 'coffee', 'collective', 'college', 'commission', 'committee', 'communications', 'community', 'company', 'comprehensive', 'computers', 'confederation', 'conference', 'conseil', 'consulting', 'containers', 'corporation', 'corps', 'corp', 'council', 'crew', 'daily news', 'data', 'departement', 'department', 'department store', 'departments', 'design', 'development', 'directorate', 'division', 'drilling', 'education', 'eglise', 'electric', 'electricity', 'energy', 'ensemble', 'enterprise', 'enterprises', 'entertainment', 'estate', 'etat', 'evening news', 'faculty', 'federation', 'financial', 'fm', 'foundation', 'fund', 'gas', 'gazette', 'girls', 'government', 'group', 'guild', 'health authority', 'herald', 'holdings', 'hospital', 'hotel', 'hotels', 'inc', 'industries', 'institut', 'institute', 'institute of technology', 'institutes', 'insurance', 'international', 'interstate', 'investment', 'investments', 'investors', 'journal', 'laboratory', 'labs', // 'law',
  'liberation army', 'limited', 'local authority', 'local health authority', 'machines', 'magazine', 'management', 'marine', 'marketing', 'markets', 'media', 'memorial', 'mercantile exchange', 'ministere', 'ministry', 'military', 'mobile', 'motor', 'motors', 'musee', 'museum', // 'network',
  'news', 'news service', 'observatory', 'office', 'oil', 'optical', 'orchestra', 'organization', 'partners', 'partnership', // 'party',
  "people's party", 'petrol', 'petroleum', 'pharmacare', 'pharmaceutical', 'pharmaceuticals', 'pizza', 'plc', 'police', 'polytechnic', 'post', 'power', 'press', 'productions', 'quartet', 'radio', 'regional authority', 'regional health authority', 'reserve', 'resources', 'restaurant', 'restaurants', 'savings', 'school', 'securities', 'service', 'services', 'social club', 'societe', 'society', 'sons', 'standard', 'state police', 'state university', 'stock exchange', 'subcommittee', 'syndicat', 'systems', 'telecommunications', 'telegraph', 'television', 'times', 'tribunal', 'tv', 'union', 'university', 'utilities', 'workers'];
  var organizations = orgWords.reduce(function (h, str) {
    h[str] = 'Noun';
    return h;
  }, {});

  var maybeOrg = function maybeOrg(t) {
    //must be a noun
    if (!t.tags.Noun) {
      return false;
    } //can't be these things


    if (t.tags.Pronoun || t.tags.Comma || t.tags.Possessive) {
      return false;
    } //must be one of these


    if (t.tags.Organization || t.tags.Acronym || t.tags.Place || t.titleCase()) {
      return true;
    }

    return false;
  };

  var tagOrgs = function tagOrgs(terms, world) {
    for (var i = 0; i < terms.length; i += 1) {
      var t = terms[i];

      if (organizations[t.clean] !== undefined && organizations.hasOwnProperty(t.clean) === true) {
        // look-backward - eg. 'Toronto University'
        var lastTerm = terms[i - 1];

        if (lastTerm !== undefined && maybeOrg(lastTerm) === true) {
          lastTerm.tagSafe('Organization', 'org-word-1', world);
          t.tagSafe('Organization', 'org-word-2', world);
          continue;
        } //look-forward - eg. University of Toronto


        var nextTerm = terms[i + 1];

        if (nextTerm !== undefined && nextTerm.clean === 'of') {
          if (terms[i + 2] && maybeOrg(terms[i + 2])) {
            t.tagSafe('Organization', 'org-of-word-1', world);
            nextTerm.tagSafe('Organization', 'org-of-word-2', world);
            terms[i + 2].tagSafe('Organization', 'org-of-word-3', world);
            continue;
          }
        }
      }
    }
  };

  var _05Organizations = tagOrgs;

  var oneLetterAcronym$1 = /^[A-Z]('s|,)?$/;
  var periodSeperated = /([A-Z]\.){2}[A-Z]?/i;
  var oneLetterWord = {
    I: true,
    A: true
  };

  var isAcronym$2 = function isAcronym(term, world) {
    var str = term.reduced; // a known acronym like fbi

    if (term.tags.Acronym) {
      return true;
    } // if (term.tags.Adverb || term.tags.Verb || term.tags.Value || term.tags.Plural) {
    //   return false
    // }
    // known-words, like 'PIZZA' is not an acronym.


    if (world.words[str]) {
      return false;
    }

    return term.isAcronym();
  }; // F.B.I., NBC, - but not 'NO COLLUSION'


  var checkAcronym = function checkAcronym(terms, world) {
    terms.forEach(function (term) {
      //these are not acronyms
      if (term.tags.RomanNumeral === true) {
        return;
      } //period-ones F.D.B.


      if (periodSeperated.test(term.text) === true) {
        term.tag('Acronym', 'period-acronym', world);
      } //non-period ones are harder


      if (term.isUpperCase() && isAcronym$2(term, world)) {
        term.tag('Acronym', 'acronym-step', world);
        term.tag('Noun', 'acronym-infer', world);
      } else if (!oneLetterWord.hasOwnProperty(term.text) && oneLetterAcronym$1.test(term.text)) {
        term.tag('Acronym', 'one-letter-acronym', world);
        term.tag('Noun', 'one-letter-infer', world);
      } //if it's a organization,


      if (term.tags.Organization && term.text.length < 4) {
        term.tag('Acronym', 'acronym-org', world);
      }
    });
  };

  var _06Acronyms = checkAcronym;

  var step = {
    neighbours: _01Neighbours,
    "case": _02Case,
    stem: _03Stem,
    plural: _04Plurals,
    organizations: _05Organizations,
    acronyms: _06Acronyms
  }; //

  var fallbacks = function fallbacks(doc, terms) {
    var world = doc.world; // if it's empty, consult it's neighbours, first

    step.neighbours(terms, world); // is there a case-sensitive clue?

    step["case"](doc); // check 'rewatch' as 'watch'

    step.stem(terms, world); // ... fallback to a noun!

    terms.forEach(function (t) {
      if (t.isKnown() === false) {
        t.tag('Noun', 'noun-fallback', doc.world);
      }
    }); // turn 'Foo University' into an Org

    step.organizations(terms, world); //turn 'FBD' into an acronym

    step.acronyms(terms, world); //are the nouns singular or plural?

    terms.forEach(function (t) {
      step.plural(t, doc.world);
    });
    return doc;
  };

  var _02Fallbacks = fallbacks;

  var hasNegative = /n't$/;
  var irregulars$3 = {
    "won't": ['will', 'not'],
    wont: ['will', 'not'],
    "can't": ['can', 'not'],
    cant: ['can', 'not'],
    cannot: ['can', 'not'],
    "shan't": ['should', 'not'],
    dont: ['do', 'not'],
    dun: ['do', 'not'] // "ain't" is ambiguous for is/was

  }; // either 'is not' or 'are not'

  var doAint = function doAint(term, phrase) {
    var terms = phrase.cache.terms || phrase.terms();
    var index = terms.indexOf(term);
    var before = terms.slice(0, index); //look for the preceding noun

    var noun = before.find(function (t) {
      return t.tags.Noun;
    });

    if (noun && noun.tags.Plural) {
      return ['are', 'not'];
    }

    return ['is', 'not'];
  };

  var checkNegative = function checkNegative(term, phrase) {
    //check named-ones
    if (irregulars$3.hasOwnProperty(term.clean) === true) {
      return irregulars$3[term.clean];
    } //this word needs it's own logic:


    if (term.clean === "ain't" || term.clean === 'aint') {
      return doAint(term, phrase);
    } //try it normally


    if (hasNegative.test(term.clean) === true) {
      var main = term.clean.replace(hasNegative, '');
      return [main, 'not'];
    }

    return null;
  };

  var _01Negative = checkNegative;

  var contraction = /([a-z\u00C0-\u00FF]+)[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]([a-z]{1,2})$/i; //these ones don't seem to be ambiguous

  var easy = {
    ll: 'will',
    ve: 'have',
    re: 'are',
    m: 'am',
    "n't": 'not'
  }; //

  var checkApostrophe = function checkApostrophe(term) {
    var parts = term.text.match(contraction);

    if (parts === null) {
      return null;
    }

    if (easy.hasOwnProperty(parts[2])) {
      return [parts[1], easy[parts[2]]];
    }

    return null;
  };

  var _02Simple = checkApostrophe;

  var irregulars$4 = {
    wanna: ['want', 'to'],
    gonna: ['going', 'to'],
    im: ['i', 'am'],
    alot: ['a', 'lot'],
    ive: ['i', 'have'],
    imma: ['I', 'will'],
    "where'd": ['where', 'did'],
    whered: ['where', 'did'],
    "when'd": ['when', 'did'],
    whend: ['when', 'did'],
    // "how'd": ['how', 'did'], //'how would?'
    // "what'd": ['what', 'did'], //'what would?'
    howd: ['how', 'did'],
    whatd: ['what', 'did'],
    // "let's": ['let', 'us'], //too weird
    //multiple word contractions
    dunno: ['do', 'not', 'know'],
    brb: ['be', 'right', 'back'],
    gtg: ['got', 'to', 'go'],
    irl: ['in', 'real', 'life'],
    tbh: ['to', 'be', 'honest'],
    imo: ['in', 'my', 'opinion'],
    til: ['today', 'i', 'learned'],
    rn: ['right', 'now'],
    twas: ['it', 'was'],
    '@': ['at']
  }; //

  var checkIrregulars = function checkIrregulars(term) {
    //check white-list
    if (irregulars$4.hasOwnProperty(term.clean)) {
      return irregulars$4[term.clean];
    }

    return null;
  };

  var _03Irregulars = checkIrregulars;

  var hasApostropheS = /([a-z\u00C0-\u00FF]+)[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]s$/i;
  var blacklist = {
    that: true,
    there: true
  };

  var isPossessive = function isPossessive(term, pool) {
    // if we already know it
    if (term.tags.Possessive) {
      return true;
    } //a pronoun can't be possessive - "he's house"


    if (term.tags.Pronoun || term.tags.QuestionWord) {
      return false;
    }

    if (blacklist.hasOwnProperty(term.clean)) {
      return false;
    } //if end of sentence, it is possessive - "was spencer's"


    var nextTerm = pool.get(term.next);

    if (!nextTerm) {
      return true;
    } //a gerund suggests 'is walking'


    if (nextTerm.tags.Verb) {
      //fix 'jamie's bite'
      if (nextTerm.tags.Infinitive) {
        return true;
      } //fix 'spencer's runs'


      if (nextTerm.tags.PresentTense) {
        return true;
      }

      return false;
    } //spencer's house


    if (nextTerm.tags.Noun) {
      return true;
    } //rocket's red glare


    var twoTerm = pool.get(nextTerm.next);

    if (twoTerm && twoTerm.tags.Noun && !twoTerm.tags.Pronoun) {
      return true;
    } //othwerwise, an adjective suggests 'is good'


    if (nextTerm.tags.Adjective || nextTerm.tags.Adverb || nextTerm.tags.Verb) {
      return false;
    }

    return false;
  };

  var isHas = function isHas(term, phrase) {
    var terms = phrase.cache.terms || phrase.terms();
    var index = terms.indexOf(term);
    var after = terms.slice(index + 1, index + 3); //look for a past-tense verb

    return after.find(function (t) {
      return t.tags.PastTense;
    });
  };

  var checkPossessive = function checkPossessive(term, phrase, world) {
    //the rest of 's
    var found = term.text.match(hasApostropheS);

    if (found !== null) {
      //spencer's thing vs spencer-is
      if (isPossessive(term, phrase.pool) === true) {
        term.tag('#Possessive', 'isPossessive', world);
        return null;
      } //'spencer is'


      if (found !== null) {
        if (isHas(term, phrase)) {
          return [found[1], 'has'];
        }

        return [found[1], 'is'];
      }
    }

    return null;
  };

  var _04Possessive = checkPossessive;

  var hasPerfect = /[a-z\u00C0-\u00FF]'d$/;
  var useDid = {
    how: true,
    what: true
  };
  /** split `i'd` into 'i had',  or 'i would'  */

  var checkPerfect = function checkPerfect(term, phrase) {
    if (hasPerfect.test(term.clean)) {
      var root = term.clean.replace(/'d$/, ''); //look at the next few words

      var terms = phrase.cache.terms || phrase.terms();
      var index = terms.indexOf(term);
      var after = terms.slice(index + 1, index + 4); //is it before a past-tense verb? - 'i'd walked'

      for (var i = 0; i < after.length; i++) {
        var t = after[i];

        if (t.tags.Verb) {
          if (t.tags.PastTense) {
            return [root, 'had'];
          } //what'd you see


          if (useDid[root] === true) {
            return [root, 'did'];
          }

          return [root, 'would'];
        }
      } //otherwise, 'i'd walk'


      return [root, 'would'];
    }

    return null;
  };

  var _05PerfectTense = checkPerfect;

  var isRange = /^([0-9]+)[-–—]([0-9]+)$/i; //split '2-4' into '2 to 4'

  var checkRange = function checkRange(term) {
    if (term.tags.PhoneNumber === true) {
      return null;
    }

    var parts = term.text.match(isRange);

    if (parts !== null) {
      return [parts[1], 'to', parts[2]];
    }

    return null;
  };

  var _06Ranges = checkRange;

  var isNumber = /^[0-9]+$/;

  var createPhrase = function createPhrase(found, doc) {
    //create phrase from ['would', 'not']
    var phrase = _01Tokenizer.fromText(found.join(' '), doc.world, doc.pool())[0]; //tag it

    var terms = phrase.terms();
    _01Lexicon(terms, doc.world); //make these terms implicit

    terms.forEach(function (t) {
      t.implicit = t.text;
      t.text = '';
      t.clean = ''; // remove whitespace for implicit terms

      t.pre = '';
      t.post = ''; // tag number-ranges

      if (isNumber.test(t.implicit)) {
        t.tags.Number = true;
        t.tags.Cardinal = true;
      }
    });
    return phrase;
  };

  var contractions = function contractions(doc) {
    var world = doc.world;
    doc.list.forEach(function (p) {
      var terms = p.cache.terms || p.terms();

      for (var i = 0; i < terms.length; i += 1) {
        var term = terms[i];
        var found = _01Negative(term, p);
        found = found || _02Simple(term);
        found = found || _03Irregulars(term);
        found = found || _04Possessive(term, p, world);
        found = found || _05PerfectTense(term, p);
        found = found || _06Ranges(term); //add them in

        if (found !== null) {
          var newPhrase = createPhrase(found, doc); //set text as contraction

          var firstTerm = newPhrase.terms(0);
          firstTerm.text = term.text; //grab sub-phrase to remove

          var match = p.buildFrom(term.id, 1, doc.pool());
          match.replace(newPhrase, doc, true);
        }
      }
    });
    return doc;
  };

  var _03Contractions = contractions;

  //mostly pos-corections here
  var miscCorrection = function miscCorrection(doc) {
    //misc:
    //foot/feet
    doc.match('(foot|feet)').tag('Noun', 'foot-noun'); // blood, sweat, and tears

    doc.match('(#Noun && @hasComma) #Noun (and|or) [#PresentTense]').tag('#Noun', 'noun-list'); //3 feet

    doc.match('#Value [(foot|feet)]').tag('Unit', 'foot-unit'); //'u' as pronoun

    doc.match('#Conjunction [u]').tag('Pronoun', 'u-pronoun-2'); //6 am

    doc.match('#Holiday (day|eve)').tag('Holiday', 'holiday-day'); // the captain who

    doc.match('#Noun [(who|whom)]').tag('Determiner', 'captain-who'); //timezones

    doc.match('(standard|daylight|summer|eastern|pacific|central|mountain) standard? time').tag('Time', 'timezone'); //Brazilian pesos

    doc.match('#Demonym #Currency').tag('Currency', 'demonym-currency'); //about to go

    doc.match('[about to] #Adverb? #Verb').tag(['Auxiliary', 'Verb'], 'about-to'); //right of way

    doc.match('(right|rights) of .').tag('Noun', 'right-of'); // a bit

    doc.match('[much] #Adjective').tag('Adverb', 'bit-1');
    doc.match('a [bit]').tag('Noun', 'bit-2');
    doc.match('a bit much').tag('Determiner Adverb Adjective', 'bit-3');
    doc.match('too much').tag('Adverb Adjective', 'bit-4'); // u r cool

    doc.match('u r').tag('Pronoun #Copula', 'u r'); // well, ...

    doc.match('^(well|so|okay)').tag('Expression', 'well-'); // had he survived,

    doc.match('had #Noun+ #PastTense').ifNo('@hasComma').firstTerm().tag('Condition', 'had-he'); // were he to survive

    doc.match('were #Noun+ to #Infinitive').ifNo('@hasComma').firstTerm().tag('Condition', 'were-he'); //swear-words as non-expression POS
    //nsfw

    doc.match('holy (shit|fuck|hell)').tag('Expression', 'swears-expression');
    doc.match('#Determiner [(shit|damn|hell)]').tag('Noun', 'swears-noun');
    doc.match('[(shit|damn|fuck)] (#Determiner|#Possessive|them)').tag('Verb', 'swears-verb');
    doc.match('#Copula fucked up?').not('#Copula').tag('Adjective', 'swears-adjective'); //ambig prepositions/conjunctions

    var so = doc["if"]('so');

    if (so.found === true) {
      //so funny
      so.match('[so] #Adjective').tag('Adverb', 'so-adv'); //so the

      so.match('[so] #Noun').tag('Conjunction', 'so-conj'); //do so

      so.match('do [so]').tag('Noun', 'so-noun');
    }

    var all = doc["if"]('all');

    if (all.found === true) {
      //all students
      all.match('[all] #Determiner? #Noun').tag('Adjective', 'all-noun'); //it all fell apart

      all.match('[all] #Verb').tag('Adverb', 'all-verb');
    } //the ambiguous word 'that' and 'which'


    var which = doc["if"]('which');

    if (which.found === true) {
      //remind john that
      which.match('#Verb #Adverb? #Noun [(that|which)]').tag('Preposition', 'that-prep'); //that car goes

      which.match('that #Noun [#Verb]').tag('Determiner', 'that-determiner'); //work, which has been done.

      which.match('@hasComma [which] (#Pronoun|#Verb)').tag('Preposition', 'which-copula');
    } //like


    var like = doc["if"]('like');

    if (like.found === true) {
      like.match('just [like]').tag('Preposition', 'like-preposition'); //folks like her

      like.match('#Noun [like] #Noun').tag('Preposition', 'noun-like'); //look like

      like.match('#Verb [like]').tag('Adverb', 'verb-like'); //exactly like

      like.match('#Adverb like').notIf('(really|generally|typically|usually|sometimes|often) [like]').tag('Adverb', 'adverb-like');
    }

    var title = doc["if"]('@titleCase');

    if (title.found === true) {
      //FitBit Inc
      title.match('@titleCase (ltd|co|inc|dept|assn|bros)').tag('Organization', 'org-abbrv'); //Foo District

      title.match('@titleCase+ (district|region|province|county|prefecture|municipality|territory|burough|reservation)').tag('Region', 'foo-district'); //District of Foo

      title.match('(district|region|province|municipality|territory|burough|state) of @titleCase').tag('Region', 'district-of-Foo');
    }

    var hyph = doc["if"]('@hasHyphen');

    if (hyph.found === true) {
      //air-flow
      hyph.match('@hasHyphen .').match('#Noun #Verb').tag('Noun', 'hyphen-verb'); //connect hyphenated expressions - 'ooh-wee'

      hyph["if"]('#Expression').match('@hasHyphen+').tag('Expression', 'ooh-wee');
    }

    var place = doc["if"]('#Place');

    if (place.found === true) {
      //West Norforlk
      place.match('(west|north|south|east|western|northern|southern|eastern)+ #Place').tag('Region', 'west-norfolk'); //some us-state acronyms (exlude: al, in, la, mo, hi, me, md, ok..)

      place.match('#City [#Acronym]').match('(al|ak|az|ar|ca|ct|dc|fl|ga|id|il|nv|nh|nj|ny|oh|or|pa|sc|tn|tx|ut|vt|pr)').tag('Region', 'us-state');
    }

    return doc;
  };

  var fixMisc = miscCorrection;

  //Determiner-signals
  var fixThe = function fixThe(doc) {
    var det = doc["if"]('#Determiner');

    if (det.found === true) {
      var adj = det["if"]('#Adjective');

      if (adj.found) {
        //the nice swim
        adj.match('(the|this|those|these) #Adjective [#Verb]').tag('Noun', 'the-adj-verb'); // the truly nice swim

        adj.match('(the|this|those|these) #Adverb #Adjective [#Verb]').tag('Noun', 'correction-determiner4'); //the orange is

        adj.match('#Determiner [#Adjective] (#Copula|#PastTense|#Auxiliary)').tag('Noun', 'the-adj-2'); //the orange.

        adj.match('#Determiner #Adjective$').notIf('(#Comparative|#Superlative)').terms(1).tag('Noun', 'the-adj-1');
      }

      var inf = det["if"]('#Infinitive');

      if (inf.found) {
        // a stream runs
        inf.match('(the|this|a|an) [#Infinitive] #Adverb? #Verb').tag('Noun', 'correction-determiner5'); //the test string

        inf.match('#Determiner [#Infinitive] #Noun').tag('Noun', 'correction-determiner7'); //by a bear.

        inf.match('#Determiner #Adjective [#Infinitive]$').tag('Noun', 'a-inf');
      } //the wait to vote


      det.match('(the|this) [#Verb] #Preposition .').tag('Noun', 'correction-determiner1'); //a sense of

      det.match('#Determiner [#Verb] of').tag('Noun', 'the-verb-of'); //the threat of force

      det.match('#Determiner #Noun of [#Verb]').tag('Noun', 'noun-of-noun'); //a close

      det.match('#Determiner #Adverb? [close]').tag('Adjective', 'a-close'); //the western line

      det.match('#Determiner [(western|eastern|northern|southern|central)] #Noun').tag('Noun', 'western-line'); //the swim

      det.match('(the|those|these) #Adjective? [(#Infinitive|#PresentTense|#PastTense)]').tag('Noun', 'correction-determiner2');
    }

    var an = doc["if"]('(a|an)');

    if (an.found === true) {
      //a staggering cost
      an.match('(a|an) [#Gerund]').tag('Adjective', 'correction-a|an'); //did a 900, paid a 20

      an.match('#Verb (a|an) [#Value]').tag('Singular', 'a-value'); //a tv show

      an.match('(a|an) #Noun [#Infinitive]').tag('Noun', 'a-noun-inf'); //a great run

      an.match('(a|an) #Adjective (#Infinitive|#PresentTense)').terms(2).tag('Noun', 'correction-a|an2'); //'a/an' can mean 1 - "a hour"

      an.match('[(a|an)] (#Duration|hundred|thousand|million|billion|trillion)').ifNo('#Plural').tag('Value', 'a-is-one');
    }

    return doc;
  };

  var fixThe_1 = fixThe;

  //
  var fixNouns = function fixNouns(doc) {
    var noun = doc["if"]('#Noun');

    if (noun.found === true) {
      //'more' is not always an adverb
      noun.match('more #Noun').tag('Noun', 'more-noun'); //he quickly foo

      noun.match('#Noun #Adverb [#Noun]').tag('Verb', 'quickly-foo'); //fix for busted-up phrasalVerbs

      noun.match('#Noun [#Particle]').tag('Preposition', 'repair-noPhrasal'); //John & Joe's

      noun.match('#Noun (&|n) #Noun').tag('Organization', 'Noun-&-Noun'); //Aircraft designer

      noun.match('#Noun #Actor').tag('Actor', 'thing-doer'); //j.k Rowling

      doc.match('#Noun van der? #Noun').tagSafe('#Person', 'von der noun'); //king of spain

      doc.match('(king|queen|prince|saint|lady) of? #Noun').tagSafe('#Person', 'king-of-noun'); // addresses

      doc.match('#Value #Noun (st|street|rd|road|crescent|cr|way|tr|terrace|avenue|ave)').tag('Address'); // schools

      doc.match('#Noun+ (public|private) school').tag('School'); //the word 'second'

      noun.match('[second] #Noun').notIf('#Honorific').unTag('Unit').tag('Ordinal', 'second-noun'); //linear algebra

      noun.match('(#Determiner|#Value) [(linear|binary|mobile|lexical|technical|computer|scientific|formal)] #Noun').tag('Noun', 'technical-noun'); //organization

      var org = noun["if"]('#Organization');

      if (org.found === true) {
        org.match('#Organization of the? @titleCase').tagSafe('Organization', 'org-of-place');
        org.match('#Organization #Country').tag('Organization', 'org-country');
        org.match('(world|global|international|national|#Demonym) #Organization').tag('Organization', 'global-org');
        org.match('@titleCase #Organization').ifNo('@hasComma').tag('Organization', 'titlecase-org');
      }

      var plural = noun["if"]('#Plural');

      if (plural.found === true) {
        //some pressing issues
        plural.match('some [#Verb] #Plural').tag('Noun', 'correction-determiner6'); //this rocks

        noun.match('(this|that) [#Plural]').tag('PresentTense', 'this-verbs');
      }
    } //acronyms


    var acronym = doc["if"]('#Acronym');

    if (acronym.found === true) {
      acronym.match('the [#Acronym]').notIf('(iou|fomo|yolo|diy|dui|nimby)').tag('Organization', 'the-acronym');
      acronym.match('#Acronym').match('#Possessive').tag('Organization', 'possessive-acronym');
    } //possessives


    var poss = doc["if"]('#Possessive');

    if (poss.found === true) {
      //my buddy
      poss.match('#Possessive [#FirstName]').unTag('Person', 'possessive-name'); //spencer kelly's

      poss.match('#FirstName #Acronym? #Possessive').ifNo('@hasComma').match('#FirstName #Acronym? #LastName').tag('Possessive'); //Super Corp's fundraiser

      poss.match('#Organization+ #Possessive').ifNo('@hasComma').tag('Possessive'); //Los Angeles's fundraiser

      poss.match('#Place+ #Possessive').ifNo('@hasComma').tag('Possessive'); //her polling

      poss.match('#Possessive [#Gerund]').tag('Noun', 'her-polling'); //her fines

      poss.match('(his|her|its) [#PresentTense]').tag('Noun', 'her-polling'); //'her match' vs 'let her match'

      var m = poss.match('#Possessive [#Infinitive]');

      if (!m.lookBehind('(let|made|make|force|ask)').found) {
        m.tag('Noun', 'her-match');
      }
    } //let him glue


    doc.match('(let|make|made) (him|her|it|#Person|#Place|#Organization)+ #Singular (a|an|the|it)').ifNo('@hasComma').match('[#Singular] (a|an|the|it)').tag('#Infinitive', 'let-him-glue');
    return doc;
  };

  var fixNouns_1 = fixNouns;

  var maybeNoun = '(rose|robin|dawn|ray|holly|bill|joy|viola|penny|sky|violet|daisy|melody|kelvin|hope|mercedes|olive|jewel|faith|van|charity|miles|lily|summer|dolly|rod|dick|cliff|lane|reed|kitty|art|jean|trinity)';
  var maybeVerb = '(pat|wade|ollie|will|rob|buck|bob|mark|jack)';
  var maybeAdj = '(misty|rusty|dusty|rich|randy)';
  var maybeDate = '(april|june|may|jan|august|eve)';
  var maybePlace = '(paris|alexandria|houston|kobe|salvador|sydney)';

  var fixPerson = function fixPerson(doc) {
    // clues from honorifics
    var hon = doc["if"]('#Honorific');

    if (hon.found === true) {
      //mr Putin
      doc.match('(mr|mrs|ms|dr) (@titleCase|#Possessive)+').tag('#Person', 'mr-putin'); //mr X

      hon.match('#Honorific #Acronym').tag('Person', 'Honorific-TitleCase'); //remove single 'mr'

      hon.match('^#Honorific$').unTag('Person', 'single-honorific'); //first general..

      hon.match('[(1st|2nd|first|second)] #Honorific').tag('Honorific', 'ordinal-honorific');
    } //methods requiring a titlecase


    var title = doc["if"]('@titleCase');

    if (title.found === true) {
      title.match('#Acronym @titleCase').tagSafe('#Person', 'acronym-titlecase'); //ludwig van beethovan

      title.match('@titleCase (van|al|bin) @titleCase').tagSafe('Person', 'titlecase-van-titlecase'); //jose de Sucre

      title.match('@titleCase (de|du) la? @titleCase').tagSafe('Person', 'titlecase-van-titlecase'); //Foo U Ford

      title.match('[#ProperNoun] #Person').notIf('@hasComma').tagSafe('Person', 'proper-person'); //pope francis

      title.match('(lady|queen|sister) @titleCase').ifNo('#Date').ifNo('#Honorific').tag('#FemaleName', 'lady-titlecase');
      title.match('(king|pope|father) @titleCase').ifNo('#Date').tag('#MaleName', 'poe'); // jean Foobar

      title.match(maybeNoun + ' #Acronym? @titleCase').tagSafe('Person', 'ray-smith'); // rob Foobar

      title.match(maybeVerb + ' #Acronym? @titleCase').tag('Person', 'rob-smith'); // rusty Foobar

      title.match(maybeAdj + ' #Acronym? @titleCase').tag('Person', 'rusty-smith'); // june Foobar

      title.match(maybeDate + ' #Acronym? (@titleCase && !#Month)').tag('Person', 'june-smith');
    }

    var person = doc["if"]('#Person');

    if (person.found === true) {
      //Frank jr
      person.match('#Person (jr|sr|md)').tag('Person', 'person-honorific'); //peter II

      person.match('#Person #Person the? #RomanNumeral').tag('Person', 'roman-numeral'); //'Professor Fink', 'General McCarthy'

      person.match('#Honorific #Person').tag('Person', 'Honorific-Person'); // 'john E rockefeller'

      person.match('#FirstName [/^[^aiurck]$/]').tag(['Acronym', 'Person'], 'john-e'); //Doctor john smith jr

      person.match('#Honorific #Person').tag('Person', 'honorific-person'); //general pearson

      person.match('[(private|general|major|corporal|lord|lady|secretary|premier)] #Honorific? #Person').tag('Honorific', 'ambg-honorifics'); //Morgan Shlkjsfne

      title.match('#Person @titleCase').match('@titleCase #Noun').tagSafe('Person', 'person-titlecase'); //a bunch of ambiguous first names
      //Nouns: 'viola' or 'sky'

      var ambigNoun = person["if"](maybeNoun);

      if (ambigNoun.found === true) {
        // ambigNoun.match('(#Determiner|#Adverb|#Pronoun|#Possessive) [' + maybeNoun + ']').tag('Noun', 'the-ray')
        ambigNoun.match(maybeNoun + ' #Person').tagSafe('Person', 'ray-smith');
      } //Verbs: 'pat' or 'wade'


      var ambigVerb = person["if"](maybeVerb);

      if (ambigVerb === true) {
        ambigVerb.match('(#Modal|#Adverb) [' + maybeVerb + ']').tag('Verb', 'would-mark');
        ambigVerb.match(maybeVerb + ' #Person').tag('Person', 'rob-smith');
      } //Adjectives: 'rusty' or 'rich'


      var ambigAdj = person["if"](maybeAdj);

      if (ambigAdj.found === true) {
        ambigAdj.match('#Adverb [' + maybeAdj + ']').tag('Adjective', 'really-rich');
        ambigAdj.match(maybeAdj + ' #Person').tag('Person', 'randy-smith');
      } //Dates: 'june' or 'may'


      var ambigDate = person["if"](maybeDate);

      if (ambigDate.found === true) {
        ambigDate.match(maybeDate + ' #ProperNoun').tag(['FirstName', 'Person'], 'june-smith');
        ambigDate.match('(in|during|on|by|before|#Date) [' + maybeDate + ']').tag('Date', 'in-june');
        ambigDate.match(maybeDate + ' (#Date|#Value)').tag('Date', 'june-5th');
      } //Places: paris or syndey


      var ambigPlace = person["if"](maybePlace);

      if (ambigPlace.found === true) {
        ambigPlace.match('(in|near|at|from|to|#Place) [' + maybePlace + ']').tagSafe('Place', 'in-paris');
        ambigPlace.match('[' + maybePlace + '] #Place').tagSafe('Place', 'paris-france'); // ambigPlace.match('[' + maybePlace + '] #Person').tagSafe('Person', 'paris-hilton')
      } //this one is tricky


      var al = person["if"]('al');

      if (al.found === true) {
        al.match('al (#Person|@titleCase)').tagSafe('#Person', 'al-borlen');
        al.match('@titleCase al @titleCase').tagSafe('#Person', 'arabic-al-arabic');
      }

      var firstName = person["if"]('#FirstName');

      if (firstName.found === true) {
        //ferdinand de almar
        firstName.match('#FirstName de #Noun').tag('#Person', 'firstname-de-noun'); //Osama bin Laden

        firstName.match('#FirstName (bin|al) #Noun').tag('#Person', 'firstname-al-noun'); //John L. Foo

        firstName.match('#FirstName #Acronym @titleCase').tag('Person', 'firstname-acronym-titlecase'); //Andrew Lloyd Webber

        firstName.match('#FirstName #FirstName @titleCase').tag('Person', 'firstname-firstname-titlecase'); //Mr Foo

        firstName.match('#Honorific #FirstName? @titleCase').tag('Person', 'Honorific-TitleCase'); //peter the great

        firstName.match('#FirstName the #Adjective').tag('Person', 'determiner5'); //very common-but-ambiguous lastnames

        firstName.match('#FirstName (green|white|brown|hall|young|king|hill|cook|gray|price)').tag('#Person', 'firstname-maybe'); //John Foo

        firstName.match('#FirstName @titleCase @titleCase?').match('#Noun+').tag('Person', 'firstname-titlecase'); //Joe K. Sombrero

        firstName.match('#FirstName #Acronym #Noun').ifNo('#Date').tag('#Person', 'n-acro-noun').lastTerm().tag('#LastName', 'n-acro-noun'); // Dwayne 'the rock' Johnson

        firstName.match('#FirstName [#Determiner #Noun] #LastName').tag('#NickName', 'first-noun-last').tag('#Person', 'first-noun-last'); //john bodego's

        firstName.match('#FirstName (#Singular|#Possessive)').ifNo('(#Date|#Pronoun|#NickName)').tag('#Person', 'first-possessive').lastTerm().tag('#LastName', 'first-possessive'); // Firstname x (dangerous)

        var tmp = firstName.match('#FirstName (#Noun|@titleCase)').ifNo('^#Possessive').ifNo('#ClauseEnd .').ifNo('#Pronoun');
        tmp.lastTerm().tag('#LastName', 'firstname-noun');
      }

      var lastName = person["if"]('#LastName');

      if (lastName.found === true) {
        //is foo Smith
        lastName.match('#Copula [(#Noun|#PresentTense)] #LastName').tag('#FirstName', 'copula-noun-lastname'); // x Lastname

        lastName.match('[#Noun] #LastName').canBe('#FirstName').tag('#FirstName', 'noun-lastname'); //ambiguous-but-common firstnames

        lastName.match('[(will|may|april|june|said|rob|wade|ray|rusty|drew|miles|jack|chuck|randy|jan|pat|cliff|bill)] #LastName').tag('#FirstName', 'maybe-lastname'); //Jani K. Smith

        lastName.match('(@titleCase|#Singular) #Acronym? #LastName').ifNo('#Date').tag('#Person', 'title-acro-noun').lastTerm().tag('#LastName', 'title-acro-noun');
      }
    }

    return doc;
  };

  var fixPerson_1 = fixPerson;

  var advb = '(#Adverb|not)+?'; //

  var fixVerb = function fixVerb(doc) {
    var vb = doc["if"]('#Verb');

    if (vb.found) {
      vb.match('[(do|does|will|have|had)] (not|#Adverb)? #Verb').tag('Auxiliary', 'have-had'); //still make

      vb.match('[still] #Verb').tag('Adverb', 'still-verb'); //'u' as pronoun

      vb.match('[u] #Verb').tag('Pronoun', 'u-pronoun-1'); //is no walk

      vb.match('is no [#Verb]').tag('Noun', 'is-no-verb'); //different views than

      vb.match('[#Verb] than').tag('Noun', 'correction'); // smoked poutine is

      vb.match('[#PastTense] #Singular is').tag('#Adjective', 'smoked-poutine'); // baked onions are

      vb.match('[#PastTense] #Plural are').tag('#Adjective', 'baked-onions'); // goes to sleep

      vb.match('(go|goes|went) to [#Infinitive]').tag('#Noun', 'goes-to-verb'); //there are reasons

      vb.match('there (are|were) #Adjective? [#PresentTense]').tag('Plural', 'there-are'); //jack seems guarded

      vb.match('#Singular (seems|appears) #Adverb? [#PastTense$]').tag('Adjective', 'seems-filled'); //'foo-up'

      vb.match('#Verb (up|off|over|out)').match('@hasHyphen .').tag('#PhrasalVerb'); //fall over

      vb.match('#PhrasalVerb [#PhrasalVerb]').tag('Particle', 'phrasal-particle'); //went to sleep
      // vb.match('#Verb to #Verb').lastTerm().tag('Noun', 'verb-to-verb');
      //been walking

      vb.match("(be|been) ".concat(advb, " #Gerund")).not('#Verb$').tag('Auxiliary', 'be-walking'); // directive verb - 'use reverse'

      vb.match('(try|use|attempt|build|make) #Verb').ifNo('(@hasComma|#Negative|#Copula|will|be)').lastTerm().tag('#Noun', 'do-verb'); //infinitive verbs suggest plural nouns - 'XYZ walk to the store'
      // r.match(`#Singular+ #Infinitive`).match('#Singular+').tag('Plural', 'infinitive-make-plural');

      var modal = vb["if"]('(#Modal|did|had|has)');

      if (modal.found === true) {
        if (!modal.has('#Modal #Verb')) {
          //'the can'
          modal.match('#Determiner [(can|will|may)]').tag('Singular', 'the can'); //'he can'

          modal.match('(can|will|may|must|should|could)').untag('Modal', 'he can');
        } //support a splattering of auxillaries before a verb


        modal.match("(has|had) ".concat(advb, " #PastTense")).not('#Verb$').tag('Auxiliary', 'had-walked'); //would walk

        modal.match("(#Modal|did) ".concat(advb, " #Verb")).not('#Verb$').tag('Auxiliary', 'modal-verb'); //would have had

        modal.match("#Modal ".concat(advb, " have ").concat(advb, " had ").concat(advb, " #Verb")).not('#Verb$').tag('Auxiliary', 'would-have'); //would be walking

        modal.match("#Modal ".concat(advb, " be ").concat(advb, " #Verb")).not('#Verb$').tag('Auxiliary', 'would-be'); //would been walking

        modal.match("(#Modal|had|has) ".concat(advb, " been ").concat(advb, " #Verb")).not('#Verb$').tag('Auxiliary', 'would-be');
      }

      var copula = vb["if"]('#Copula');

      if (copula.found === true) {
        //was walking
        copula.match("#Copula ".concat(advb, " (#Gerund|#PastTense)")).not('#Verb$').tag('Auxiliary', 'copula-walking'); //is mark hughes

        copula.match('#Copula [#Infinitive] #Noun').tag('Noun', 'is-pres-noun'); //

        copula.match('[#Infinitive] #Copula').tag('Noun', 'inf-copula'); //sometimes not-adverbs

        copula.match('#Copula [(just|alone)]$').tag('Adjective', 'not-adverb'); //jack is guarded

        copula.match('#Singular is #Adverb? [#PastTense$]').tag('Adjective', 'is-filled'); //is eager to go

        copula.match('#Copula [#Adjective to] #Verb').tag('Verb', 'adj-to'); //sometimes adverbs - 'pretty good','well above'

        copula.match('#Copula (pretty|dead|full|well) (#Adjective|#Noun)').ifNo('@hasComma').tag('#Copula #Adverb #Adjective', 'sometimes-adverb');
      } //Gerund - 'walking'


      var gerund = vb["if"]('#Gerund');

      if (gerund.found === true) {
        //walking is cool
        gerund.match('[#Gerund] #Adverb? not? #Copula').tag('Activity', 'gerund-copula'); //walking should be fun

        gerund.match('[#Gerund] #Modal').tag('Activity', 'gerund-modal'); //running-a-show

        gerund.match('#Gerund #Determiner [#Infinitive]').tag('Noun', 'running-a-show'); //setting records
        // doc.match('#Gerund [#PresentTense]').tag('Plural', 'setting-records');
      } //'will be'


      var willBe = vb["if"]('will #Adverb? not? #Adverb? be');

      if (willBe.found === true) {
        //will be running (not copula
        if (willBe.has('will #Adverb? not? #Adverb? be #Gerund') === false) {
          //tag it all
          willBe.match('will not? be').tag('Copula', 'will-be-copula'); //for more complex forms, just tag 'be'

          willBe.match('will #Adverb? not? #Adverb? be #Adjective').match('be').tag('Copula', 'be-copula');
        }
      }
    } //question words


    var m = doc["if"]('(who|what|where|why|how|when)');

    if (m.found) {
      //the word 'how'
      m.match('^how').tag('QuestionWord', 'how-question');
      m.match('[how] (#Determiner|#Copula|#Modal|#PastTense)').tag('QuestionWord', 'how-is'); // //the word 'which'

      m.match('^which').tag('QuestionWord', 'which-question');
      m.match('[which] . (#Noun)+ #Pronoun').tag('QuestionWord', 'which-question2');
      m.match('which').tag('QuestionWord', 'which-question3'); //how he is driving

      m.match('[#QuestionWord] #Noun #Copula #Adverb? (#Verb|#Adjective)').unTag('QuestionWord').tag('Conjunction', 'how-he-is-x'); //when i go fishing

      m.match('#QuestionWord #Noun #Adverb? #Infinitive not? #Gerund').unTag('QuestionWord').tag('Conjunction', 'when i go fishing');
    }

    return doc;
  };

  var fixVerb_1 = fixVerb;

  //
  var fixAdjective = function fixAdjective(doc) {
    var adj = doc["if"]('#Adjective');

    if (adj.found) {
      //still good
      adj.match('[still] #Adjective').tag('Adverb', 'still-advb'); //barely even walk

      adj.match('(barely|hardly) even').tag('#Adverb', 'barely-even'); //big dreams, critical thinking

      adj.match('#Adjective [#PresentTense]').tag('Noun', 'adj-presentTense'); //will secure our

      adj.match('will [#Adjective]').tag('Verb', 'will-adj'); //cheering hard - dropped -ly's

      adj.match('#PresentTense [(hard|quick|long|bright|slow)]').tag('Adverb', 'lazy-ly'); //his fine

      adj.match('(his|her|its) [#Adjective]').tag('Noun', 'his-fine'); //he left

      adj.match('#Noun #Adverb? [left]').tag('PastTense', 'left-verb'); //he disguised the thing

      adj.match('#Pronoun [#Adjective] #Determiner #Adjective? #Noun').tag('Verb', 'he-adj-the');
    }

    return doc;
  };

  var fixAdjective_1 = fixAdjective;

  var units = '(hundred|thousand|million|billion|trillion|quadrillion|quintillion|sextillion|septillion)'; //

  var fixValue = function fixValue(doc) {
    var val = doc["if"]('#Value');

    if (val.found === true) {
      //1 800 PhoneNumber
      val.match('1 #Value #PhoneNumber').tag('PhoneNumber', '1-800-Value'); //(454) 232-9873

      val.match('#NumericValue #PhoneNumber').tag('PhoneNumber', '(800) PhoneNumber'); //three trains / one train

      var m = val.match('#Value #PresentTense');

      if (m.found) {
        if (m.has('(one|1)') === true) {
          m.terms(1).tag('Singular', 'one-presentTense');
        } else {
          m.terms(1).tag('Plural', 'value-presentTense');
        }
      } //money


      m = val.match('#Value+ #Currency');
      m.lastTerm().tag('Unit', 'money-unit');
      m.match('#Value+').tag('Money', 'value-currency');
    } //5 kg.


    val.match('#Value #Abbreviation').tag('Value', 'value-abbr'); //seven point five

    val.match('#Value (point|decimal) #Value').tag('Value', 'value-point-value'); //minus 7

    val.match('(minus|negative) #Value').tag('Value', 'minus-value'); // ten grand

    val.match('#Value grand').tag('Value', 'value-grand'); //quarter million

    val.match('(a|the) [(half|quarter)] #Ordinal').tag('Value', 'half-ordinal'); //eg 'trillion'

    var mult = val["if"](units);

    if (mult.found === true) {
      mult.match('a #Value').tag('Value', 'a-value'); //?
      // mult.match('#Ordinal (half|quarter)').tag('Value', 'ordinal-half');//not ready

      mult.match("".concat(units, " and #Value")).tag('Value', 'magnitude-and-value');
    }

    return doc;
  };

  var fixValue_1 = fixValue;

  var preps = '(in|by|before|during|on|until|after|of|within|all)'; //6

  var people = '(january|april|may|june|summer|autumn|jan|sep)'; //ambiguous month-names

  var verbs$1 = '(may|march|sat)'; //ambiguous month-verbs

  var fixDates = function fixDates(doc) {
    //ambiguous month - person forms
    var person = doc["if"](people);

    if (person.found === true) {
      //give to april
      person.match("#Infinitive #Determiner? #Adjective? #Noun? (to|for) [".concat(people, "]")).tag('Person', 'ambig-person'); //remind june

      person.match("#Infinitive [".concat(people, "]")).tag('Person', 'infinitive-person'); //may waits for

      person.match("[".concat(people, "] #PresentTense (to|for)")).tag('Person', 'ambig-active'); //april will

      person.match("[".concat(people, "] #Modal")).tag('Person', 'ambig-modal'); //would april

      person.match("#Modal [".concat(people, "]")).tag('Person', 'modal-ambig'); //with april

      person.match("(that|with|for) [".concat(people, "]")).tag('Person', 'that-month'); //it is may

      person.match("#Copula [".concat(people, "]")).tag('Person', 'is-may'); //may is

      person.match("[".concat(people, "] #Copula")).tag('Person', 'may-is'); //april the 5th

      person.match("[".concat(people, "] the? #Value")).tag('Month', 'person-value'); //wednesday april

      person.match("#Date [".concat(people, "]")).tag('Month', 'correction-may'); //may 5th

      person.match("[".concat(people, "] the? #Value")).tag('Month', 'may-5th'); //5th of may

      person.match("#Value of [".concat(people, "]")).tag('Month', '5th-of-may'); //by april

      person.match("".concat(preps, " [").concat(people, "]")).ifNo('#Holiday').tag('Month', 'preps-month'); //this april

      person.match("(next|this|last) [".concat(people, "]")).tag('Month', 'correction-may'); //maybe not 'this'
    } //ambiguous month - verb-forms


    var verb = doc["if"](verbs$1);

    if (verb.found === true) {
      //quickly march
      verb.match("#Adverb [".concat(verbs$1, "]")).tag('Infinitive', 'ambig-verb');
      verb.match("".concat(verbs$1, " [#Adverb]")).tag('Infinitive', 'ambig-verb'); //all march

      verb.match("".concat(preps, " [").concat(verbs$1, "]")).tag('Month', 'in-month'); //this march

      verb.match("(next|this|last) [".concat(verbs$1, "]")).tag('Month', 'this-month'); //with date

      verb.match("[".concat(verbs$1, "] the? #Value")).tag('Month', 'march-5th');
      verb.match("#Value of? [".concat(verbs$1, "]")).tag('Month', '5th-of-march'); //nearby

      verb.match("[".concat(verbs$1, "] .? #Date")).tag('Month', 'march-and-feb');
      verb.match("#Date .? [".concat(verbs$1, "]")).tag('Month', 'feb-and-march');
      var march = doc["if"]('march');

      if (march.found === true) {
        //march to
        march.match('[march] (up|down|back|to|toward)').tag('Infinitive', 'march-to'); //must march

        march.match('#Modal [march]').tag('Infinitive', 'must-march');
      }
    } //sun 5th


    var sun = doc["if"]('sun');

    if (sun.found === true) {
      //sun feb 2
      sun.match('[sun] #Date').tag('WeekDay', 'sun-feb'); //1pm next sun

      sun.match('#Date (on|this|next|last|during)? [sun]').tag('WeekDay', '1pm-sun'); //sun the 5th

      sun.match('sun the #Ordinal').tag('Date').firstTerm().tag('WeekDay', 'sun-the-5th'); //the sun

      sun.match('#Determiner [sun]').tag('Singular', 'the-sun');
    } //sat, nov 5th


    var sat = doc["if"]('sat');

    if (sat.found) {
      //sat november
      sat.match('[sat] #Date').tag('WeekDay', 'sat-feb'); //this sat

      sat.match("".concat(preps, " [sat]")).tag('WeekDay', 'sat');
    } //months:


    var month = doc["if"]('#Month');

    if (month.found === true) {
      //June 5-7th
      month.match("#Month #DateRange+").tag('Date', 'correction-numberRange'); //5th of March

      month.match('#Value of #Month').tag('Date', 'value-of-month'); //5 March

      month.match('#Cardinal #Month').tag('Date', 'cardinal-month'); //march 5 to 7

      month.match('#Month #Value to #Value').tag('Date', 'value-to-value'); //march the 12th

      month.match('#Month the #Value').tag('Date', 'month-the-value');
    } //months:


    var val = doc["if"]('#Value');

    if (val.found === true) {
      //values
      val.match('#Value #Abbreviation').tag('Value', 'value-abbr'); //seven point five

      val.match('#Value (point|decimal) #Value').tag('Value', 'value-point-value'); //minus 7

      val.match('(minus|negative) #Value').tag('Value', 'minus-value'); // ten grand

      val.match('#Value grand').tag('Value', 'value-grand'); //quarter million

      val.match('(a|the) [(half|quarter)] #Ordinal').tag('Value', 'half-ordinal'); //june 7

      val.match('(#WeekDay|#Month) #Value').ifNo('#Money').tag('Date', 'date-value'); //7 june

      val.match('#Value (#WeekDay|#Month)').ifNo('#Money').tag('Date', 'value-date'); //may twenty five

      val.match('#TextValue #TextValue')["if"]('#Date').tag('#Date', 'textvalue-date');
    }

    return doc;
  };

  var fixDates_1 = fixDates;

  // verb: 100.828ms
  // dates: 80.874ms
  // person: 66.054ms
  // nouns: 51.340ms
  // adj: 19.760ms
  // value: 12.950ms
  // misc: 43.359ms
  //sequence of match-tag statements to correct mis-tags

  var corrections = function corrections(doc) {
    // console.time('det')
    fixThe_1(doc); //27
    // console.timeEnd('det')
    // console.time('nouns')

    fixNouns_1(doc); //30
    // // console.timeEnd('nouns')
    // // console.time('person')

    fixPerson_1(doc); //58
    // // console.timeEnd('person')
    // // console.time('verb')

    fixVerb_1(doc); //50
    // // console.timeEnd('verb')
    // // console.time('adj')

    fixAdjective_1(doc); //8
    // // console.timeEnd('adj')
    // // console.time('value')

    fixValue_1(doc); //12
    // // console.timeEnd('value')
    // // console.time('dates')

    fixDates_1(doc); //92
    // // console.timeEnd('dates')
    // // console.time('misc')

    fixMisc(doc); //43
    // console.timeEnd('misc')

    return doc;
  };

  var _04Correction = corrections;

  /** POS-tag all terms in this document */

  var tagger = function tagger(doc) {
    var terms = doc.termList(); // check against any known-words

    doc = _01Init(doc, terms); // everything has gotta be something. ¯\_(:/)_/¯

    doc = _02Fallbacks(doc, terms); // support "didn't" & "spencer's"

    doc = _03Contractions(doc); //set our cache, to speed things up

    doc.cache(); // wiggle-around the results, so they make more sense

    doc = _04Correction(doc); //remove our cache
    // doc.uncache()
    // run any user-given tagger functions

    doc.world.taggers.forEach(function (fn) {
      fn(doc);
    });
    return doc;
  };

  var _02Tagger = tagger;

  var addMethod = function addMethod(Doc) {
    /**  */
    var Abbreviations =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Abbreviations, _Doc);

      function Abbreviations() {
        _classCallCheck(this, Abbreviations);

        return _possibleConstructorReturn(this, _getPrototypeOf(Abbreviations).apply(this, arguments));
      }

      _createClass(Abbreviations, [{
        key: "stripPeriods",
        value: function stripPeriods() {
          this.termList().forEach(function (t) {
            if (t.tags.Abbreviation === true && t.next) {
              t.post = t.post.replace(/^\./, '');
            }

            var str = t.text.replace(/\./, '');
            t.set(str);
          });
          return this;
        }
      }, {
        key: "addPeriods",
        value: function addPeriods() {
          this.termList().forEach(function (t) {
            t.post = t.post.replace(/^\./, '');
            t.post = '.' + t.post;
          });
          return this;
        }
      }]);

      return Abbreviations;
    }(Doc);

    Abbreviations.prototype.unwrap = Abbreviations.prototype.stripPeriods;

    Doc.prototype.abbreviations = function (n) {
      var match = this.match('#Abbreviation');

      if (typeof n === 'number') {
        match = match.get(n);
      }

      return new Abbreviations(match.list, this, this.world);
    };

    return Doc;
  };

  var Abbreviations = addMethod;

  var hasPeriod = /\./;

  var addMethod$1 = function addMethod(Doc) {
    /**  */
    var Acronyms =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Acronyms, _Doc);

      function Acronyms() {
        _classCallCheck(this, Acronyms);

        return _possibleConstructorReturn(this, _getPrototypeOf(Acronyms).apply(this, arguments));
      }

      _createClass(Acronyms, [{
        key: "stripPeriods",
        value: function stripPeriods() {
          this.termList().forEach(function (t) {
            var str = t.text.replace(/\./g, '');
            t.set(str);
          });
          return this;
        }
      }, {
        key: "addPeriods",
        value: function addPeriods() {
          this.termList().forEach(function (t) {
            var str = t.text.replace(/\./g, '');
            str = str.split('').join('.'); // don't add a end-period if there's a sentence-end one

            if (hasPeriod.test(t.post) === false) {
              str += '.';
            }

            t.set(str);
          });
          return this;
        }
      }]);

      return Acronyms;
    }(Doc);

    Acronyms.prototype.unwrap = Acronyms.prototype.stripPeriods;
    Acronyms.prototype.strip = Acronyms.prototype.stripPeriods;

    Doc.prototype.acronyms = function (n) {
      var match = this.match('#Acronym');

      if (typeof n === 'number') {
        match = match.get(n);
      }

      return new Acronyms(match.list, this, this.world);
    };

    return Doc;
  };

  var Acronyms = addMethod$1;

  var addMethod$2 = function addMethod(Doc) {
    /** split into approximate sub-sentence phrases */
    Doc.prototype.clauses = function (n) {
      // an awkward way to disambiguate a comma use
      var commas = this["if"]('@hasComma').notIf('@hasComma @hasComma') //fun, cool...
      .notIf('@hasComma . .? (and|or) .') //cool, and fun
      .notIf('(#City && @hasComma) #Country') //'toronto, canada'
      .notIf('(#Date && @hasComma) #Year') //'july 6, 1992'
      .notIf('@hasComma (too|also)$') //at end of sentence
      .match('@hasComma');
      var found = this.splitAfter(commas);
      var quotes = found.quotations();
      found = found.splitOn(quotes);
      var parentheses = found.parentheses();
      found = found.splitOn(parentheses); // it is cool and it is ..

      var conjunctions = found["if"]('#Copula #Adjective #Conjunction (#Pronoun|#Determiner) #Verb').match('#Conjunction');
      found = found.splitBefore(conjunctions); // if it is this then that

      var condition = found["if"]('if .{2,9} then .').match('then');
      found = found.splitBefore(condition); // misc clause partitions

      found = found.splitBefore('as well as .');
      found = found.splitBefore('such as .');
      found = found.splitBefore('in addition to .'); // semicolons, dashes

      found = found.splitAfter('@hasSemicolon');
      found = found.splitAfter('@hasDash'); // passive voice verb - '.. which was robbed is empty'
      // let passive = found.match('#Noun (which|that) (was|is) #Adverb? #PastTense #Adverb?')
      // if (passive.found) {
      //   found = found.splitAfter(passive)
      // }
      // //which the boy robbed
      // passive = found.match('#Noun (which|that) the? #Noun+ #Adverb? #PastTense #Adverb?')
      // if (passive.found) {
      //   found = found.splitAfter(passive)
      // }
      // does there appear to have relative/subordinate clause still?

      var tooLong = found.filter(function (d) {
        return d.wordCount() > 5 && d.match('#Verb+').length >= 2;
      });

      if (tooLong.found) {
        var m = tooLong.splitAfter('#Noun .* #Verb .* #Noun+');
        found = found.splitOn(m.eq(0));
      }

      if (typeof n === 'number') {
        found = found.get(n);
      }

      return new Doc(found.list, this, this.world);
    };

    return Doc;
  };

  var Clauses = addMethod$2;

  var addMethod$3 = function addMethod(Doc) {
    /**  */
    var Contractions =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Contractions, _Doc);

      function Contractions(list, from, world) {
        var _this;

        _classCallCheck(this, Contractions);

        _this = _possibleConstructorReturn(this, _getPrototypeOf(Contractions).call(this, list, from, world));
        _this.contracted = null;
        return _this;
      }
      /** turn didn't into 'did not' */


      _createClass(Contractions, [{
        key: "expand",
        value: function expand() {
          this.list.forEach(function (p) {
            var terms = p.terms(); //change the case?

            var isTitlecase = terms[0].isTitleCase();
            terms.forEach(function (t, i) {
              //use the implicit text
              t.set(t.implicit || t.text);
              t.implicit = undefined; //add whitespace

              if (i < terms.length - 1 && t.post === '') {
                t.post += ' ';
              }
            }); //set titlecase

            if (isTitlecase) {
              terms[0].toTitleCase();
            }
          });
          return this;
        }
      }]);

      return Contractions;
    }(Doc); //find contractable, expanded-contractions
    // const findExpanded = r => {
    //   let remain = r.not('#Contraction')
    //   let m = remain.match('(#Noun|#QuestionWord) (#Copula|did|do|have|had|could|would|will)')
    //   m.concat(remain.match('(they|we|you|i) have'))
    //   m.concat(remain.match('i am'))
    //   m.concat(remain.match('(#Copula|#Modal|do|does|have|has|can|will) not'))
    //   return m
    // }


    Doc.prototype.contractions = function (n) {
      //find currently-contracted
      var found = this.match('@hasContraction+'); //(may want to split these up)
      //todo: split consecutive contractions

      if (typeof n === 'number') {
        found = found.get(n);
      }

      return new Contractions(found.list, this, this.world);
    }; //aliases


    Doc.prototype.expanded = Doc.prototype.isExpanded;
    Doc.prototype.contracted = Doc.prototype.isContracted;
    return Doc;
  };

  var Contractions = addMethod$3;

  var addMethod$4 = function addMethod(Doc) {
    //pull it apart..
    var parse = function parse(doc) {
      var things = doc.splitAfter('@hasComma').not('(and|or) not?');
      var beforeLast = doc.match('[.] (and|or)');
      return {
        things: things,
        conjunction: doc.match('(and|or) not?'),
        beforeLast: beforeLast,
        hasOxford: beforeLast.has('@hasComma')
      };
    };
    /** cool, fun, and nice */


    var Lists =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Lists, _Doc);

      function Lists() {
        _classCallCheck(this, Lists);

        return _possibleConstructorReturn(this, _getPrototypeOf(Lists).apply(this, arguments));
      }

      _createClass(Lists, [{
        key: "conjunctions",

        /** coordinating conjunction */
        value: function conjunctions() {
          return this.match('(and|or)');
        }
        /** split-up by list object */

      }, {
        key: "parts",
        value: function parts() {
          return this.splitAfter('(@hasComma|#Conjunction)');
        }
        /** remove the conjunction */

      }, {
        key: "items",
        value: function items() {
          return this.parts().notIf('#Conjunction');
        }
        /** add a new unit to the list */

      }, {
        key: "add",
        value: function add(str) {
          this.forEach(function (p) {
            var beforeLast = parse(p).beforeLast;
            beforeLast.append(str); //add a comma to it

            beforeLast.termList(0).addPunctuation(',');
          });
          return this;
        }
        /** remove any matching unit from the list */

      }, {
        key: "remove",
        value: function remove() {
          return this;
        }
        /** return only lists that use a serial comma */

      }, {
        key: "hasOxfordComma",
        value: function hasOxfordComma() {
          return this.filter(function (doc) {
            return parse(doc).hasOxford;
          });
        }
      }, {
        key: "addOxfordComma",
        value: function addOxfordComma() {
          return this;
        }
      }, {
        key: "removeOxfordComma",
        value: function removeOxfordComma() {
          return this;
        }
      }]);

      return Lists;
    }(Doc); // aliases


    Lists.prototype.things = Lists.prototype.items;

    Doc.prototype.lists = function (n) {
      var m = this["if"]('@hasComma+ .? (and|or) not? .'); // person-list

      var nounList = m.match('(#Noun|#Adjective)+ #Conjunction not? #Adjective? #Noun+');
      var adjList = m.match('(#Adjective|#Adverb)+ #Conjunction not? #Adverb? #Adjective+');
      var verbList = m.match('(#Verb|#Adverb)+ #Conjunction not? #Adverb? #Verb+');
      var result = nounList.concat(adjList);
      result = result.concat(verbList);
      result = result["if"]('@hasComma');

      if (typeof n === 'number') {
        result = m.get(n);
      }

      return new Lists(result.list, this, this.world);
    };

    return Doc;
  };

  var Lists = addMethod$4;

  var noPlural = '(#Pronoun|#Place|#Value|#Person|#Uncountable|#Month|#WeekDay|#Holiday|#Possessive)'; //certain words can't be plural, like 'peace'

  var hasPlural = function hasPlural(doc) {
    if (doc.has('#Plural') === true) {
      return true;
    } // these can't be plural


    if (doc.has(noPlural) === true) {
      return false;
    }

    return true;
  };

  var hasPlural_1 = hasPlural;

  var irregulars$5 = {
    hour: 'an',
    heir: 'an',
    heirloom: 'an',
    honest: 'an',
    honour: 'an',
    honor: 'an',
    uber: 'an' //german u

  }; //pronounced letters of acronyms that get a 'an'

  var an_acronyms = {
    a: true,
    e: true,
    f: true,
    h: true,
    i: true,
    l: true,
    m: true,
    n: true,
    o: true,
    r: true,
    s: true,
    x: true
  }; //'a' regexes

  var a_regexs = [/^onc?e/i, //'wu' sound of 'o'
  /^u[bcfhjkqrstn][aeiou]/i, // 'yu' sound for hard 'u'
  /^eul/i];

  var makeArticle = function makeArticle(doc) {
    //no 'the john smith', but 'a london hotel'
    if (doc.has('#Person') || doc.has('#Place')) {
      return '';
    } //no a/an if it's plural


    if (doc.has('#Plural')) {
      return 'the';
    }

    var str = doc.text('normal').trim(); //explicit irregular forms

    if (irregulars$5.hasOwnProperty(str)) {
      return irregulars$5[str];
    } //spelled-out acronyms


    var firstLetter = str.substr(0, 1);

    if (doc.has('^@isAcronym') && an_acronyms.hasOwnProperty(firstLetter)) {
      return 'an';
    } //'a' regexes


    for (var i = 0; i < a_regexs.length; i++) {
      if (a_regexs[i].test(str)) {
        return 'a';
      }
    } //basic vowel-startings


    if (/^[aeiou]/i.test(str)) {
      return 'an';
    }

    return 'a';
  };

  var getArticle = makeArticle;

  //similar to plural/singularize rules, but not the same
  var isPlural$1 = [/(antenn|formul|nebul|vertebr|vit)ae$/i, /(octop|vir|radi|nucle|fung|cact|stimul)i$/i, /men$/i, /.tia$/i, /(m|l)ice$/i]; //similar to plural/singularize rules, but not the same

  var isSingular$1 = [/(ax|test)is$/i, /(octop|vir|radi|nucle|fung|cact|stimul)us$/i, /(octop|vir)i$/i, /(rl)f$/i, /(alias|status)$/i, /(bu)s$/i, /(al|ad|at|er|et|ed|ad)o$/i, /(ti)um$/i, /(ti)a$/i, /sis$/i, /(?:(^f)fe|(lr)f)$/i, /hive$/i, /(^aeiouy|qu)y$/i, /(x|ch|ss|sh|z)$/i, /(matr|vert|ind|cort)(ix|ex)$/i, /(m|l)ouse$/i, /(m|l)ice$/i, /(antenn|formul|nebul|vertebr|vit)a$/i, /.sis$/i, /^(?!talis|.*hu)(.*)man$/i];
  var _rules$2 = {
    isSingular: isSingular$1,
    isPlural: isPlural$1
  };

  var endS = /s$/; // double-check this term, if it is not plural, or singular.
  // (this is a partial copy of ./tagger/fallbacks/plural)
  // fallback plural if it ends in an 's'.

  var isPlural$2 = function isPlural(str) {
    // isSingular suffix rules
    if (_rules$2.isSingular.find(function (reg) {
      return reg.test(str);
    })) {
      return false;
    } // does it end in an s?


    if (endS.test(str) === true) {
      return true;
    } // is it a plural like 'fungi'?


    if (_rules$2.isPlural.find(function (reg) {
      return reg.test(str);
    })) {
      return true;
    }

    return null;
  };

  var isPlural_1$1 = isPlural$2;

  var exceptions = {
    he: 'his',
    she: 'hers',
    they: 'theirs',
    we: 'ours',
    i: 'mine',
    you: 'yours',
    her: 'hers',
    their: 'theirs',
    our: 'ours',
    my: 'mine',
    your: 'yours'
  }; // turn "David" to "David's"

  var toPossessive = function toPossessive(doc) {
    var str = doc.text('text').trim(); // exceptions

    if (exceptions.hasOwnProperty(str)) {
      doc.replaceWith(exceptions[str], true);
      doc.tag('Possessive', 'toPossessive');
      return;
    } // flanders'


    if (/s$/.test(str)) {
      str += "'";
      doc.replaceWith(str, true);
      doc.tag('Possessive', 'toPossessive');
      return;
    } //normal form:


    str += "'s";
    doc.replaceWith(str, true);
    doc.tag('Possessive', 'toPossessive');
    return;
  };

  var toPossessive_1 = toPossessive;

  // .nouns() supports some noun-phrase-ish groupings
  // pull these apart, if necessary
  var parse$1 = function parse(doc) {
    var res = {
      main: doc
    }; //support 'mayor of chicago' as one noun-phrase

    if (doc.has('#Noun (of|by|for) .')) {
      var m = doc.splitAfter('[#Noun+]');
      res.main = m.eq(0);
      res.post = m.eq(1);
    }

    return res;
  };

  var parse_1 = parse$1;

  var methods$6 = {
    /** overload the original json with noun information */
    json: function json(options) {
      var n = null;

      if (typeof options === 'number') {
        n = options;
        options = null;
      }

      options = options || {
        text: true,
        normal: true,
        trim: true,
        terms: true
      };
      var res = [];
      this.forEach(function (doc) {
        var json = doc.json(options)[0];
        json.article = getArticle(doc);
        res.push(json);
      });

      if (n !== null) {
        return res[n];
      }

      return res;
    },

    /** get all adjectives describing this noun*/
    adjectives: function adjectives() {
      var list = this.lookAhead('^(that|who|which)? (was|is|will)? be? #Adverb? #Adjective+');
      list = list.concat(this.lookBehind('#Adjective+ #Adverb?$'));
      list = list.match('#Adjective');
      return list.sort('index');
    },
    isPlural: function isPlural() {
      return this["if"]('#Plural'); //assume tagger has run?
    },
    hasPlural: function hasPlural() {
      return this.filter(function (d) {
        return hasPlural_1(d);
      });
    },
    toPlural: function toPlural(agree) {
      var _this = this;

      var toPlural = this.world.transforms.toPlural;
      this.forEach(function (doc) {
        if (doc.has('#Plural') || hasPlural_1(doc) === false) {
          return;
        } // double-check it isn't an un-tagged plural


        var main = parse_1(doc).main;
        var str = main.text('reduced');

        if (!main.has('#Singular') && isPlural_1$1(str) === true) {
          return;
        }

        str = toPlural(str, _this.world);
        main.replace(str).tag('#Plural'); // 'an apple' -> 'apples'

        if (agree) {
          var an = main.lookBefore('(an|a) #Adjective?$').not('#Adjective');

          if (an.found === true) {
            an.remove();
          }
        }
      });
      return this;
    },
    toSingular: function toSingular(agree) {
      var _this2 = this;

      var toSingular = this.world.transforms.toSingular;
      this.forEach(function (doc) {
        if (doc.has('#Singular') || hasPlural_1(doc) === false) {
          return;
        } // double-check it isn't an un-tagged plural


        var main = parse_1(doc).main;
        var str = main.text('reduced');

        if (!main.has('#Plural') && isPlural_1$1(str) !== true) {
          return;
        }

        str = toSingular(str, _this2.world);
        main.replace(str).tag('#Singular'); // add an article

        if (agree) {
          // 'apples' -> 'an apple'
          var start = doc;
          var adj = doc.lookBefore('#Adjective');

          if (adj.found) {
            start = adj;
          }

          var article = getArticle(start);
          start.insertBefore(article);
        }
      });
      return this;
    },
    toPossessive: function toPossessive() {
      this.forEach(function (d) {
        toPossessive_1(d);
      });
      return this;
    }
  };
  var methods_1 = methods$6;

  var addMethod$5 = function addMethod(Doc) {
    /**  */
    var Nouns =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Nouns, _Doc);

      function Nouns() {
        _classCallCheck(this, Nouns);

        return _possibleConstructorReturn(this, _getPrototypeOf(Nouns).apply(this, arguments));
      }

      return Nouns;
    }(Doc); // add-in our methods


    Object.assign(Nouns.prototype, methods_1);

    Doc.prototype.nouns = function (n) {
      // don't split 'paris, france'
      var keep = this.match('(#City && @hasComma) (#Region|#Country)'); // but split the other commas

      var m = this.not(keep).splitAfter('@hasComma'); // combine them back together

      m = m.concat(keep);
      m = m.match('#Noun+ (of|by)? the? #Noun+?'); //nouns that we don't want in these results, for weird reasons

      m = m.not('#Pronoun');
      m = m.not('(there|these)');
      m = m.not('(#Month|#WeekDay)'); //allow Durations, Holidays
      // //allow possessives like "spencer's", but not generic ones like,

      m = m.not('(my|our|your|their|her|his)');
      m = m.not('(of|for|by|the)$');

      if (typeof n === 'number') {
        m = m.get(n);
      }

      return new Nouns(m.list, this, this.world);
    };

    return Doc;
  };

  var Nouns = addMethod$5;

  var open = /\(/;
  var close = /\)/;

  var addMethod$6 = function addMethod(Doc) {
    /** anything between (these things) */
    var Parentheses =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Parentheses, _Doc);

      function Parentheses() {
        _classCallCheck(this, Parentheses);

        return _possibleConstructorReturn(this, _getPrototypeOf(Parentheses).apply(this, arguments));
      }

      _createClass(Parentheses, [{
        key: "unwrap",

        /** remove the parentheses characters */
        value: function unwrap() {
          this.list.forEach(function (p) {
            var first = p.terms(0);
            first.pre = first.pre.replace(open, '');
            var last = p.lastTerm();
            last.post = last.post.replace(close, '');
          });
          return this;
        }
      }]);

      return Parentheses;
    }(Doc);

    Doc.prototype.parentheses = function (n) {
      var list = [];
      this.list.forEach(function (p) {
        var terms = p.terms(); //look for opening brackets

        for (var i = 0; i < terms.length; i += 1) {
          var t = terms[i];

          if (open.test(t.pre)) {
            //look for the closing bracket..
            for (var o = i; o < terms.length; o += 1) {
              if (close.test(terms[o].post)) {
                var len = o - i + 1;
                list.push(p.buildFrom(t.id, len));
                i = o;
                break;
              }
            }
          }
        }
      }); //support nth result

      if (typeof n === 'number') {
        if (list[n]) {
          list = [list[n]];
        } else {
          list = [];
        }

        return new Parentheses(list, this, this.world);
      }

      return new Parentheses(list, this, this.world);
    };

    return Doc;
  };

  var Parentheses = addMethod$6;

  var addMethod$7 = function addMethod(Doc) {
    /**  */
    var Possessives =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Possessives, _Doc);

      function Possessives(list, from, world) {
        var _this;

        _classCallCheck(this, Possessives);

        _this = _possibleConstructorReturn(this, _getPrototypeOf(Possessives).call(this, list, from, world));
        _this.contracted = null;
        return _this;
      }
      /** turn didn't into 'did not' */


      _createClass(Possessives, [{
        key: "strip",
        value: function strip() {
          this.list.forEach(function (p) {
            var terms = p.terms();
            terms.forEach(function (t) {
              var str = t.text.replace(/'s$/, '');
              t.set(str || t.text);
            });
          });
          return this;
        }
      }]);

      return Possessives;
    }(Doc); //find contractable, expanded-contractions
    // const findExpanded = r => {
    //   let remain = r.not('#Contraction')
    //   let m = remain.match('(#Noun|#QuestionWord) (#Copula|did|do|have|had|could|would|will)')
    //   m.concat(remain.match('(they|we|you|i) have'))
    //   m.concat(remain.match('i am'))
    //   m.concat(remain.match('(#Copula|#Modal|do|does|have|has|can|will) not'))
    //   return m
    // }


    Doc.prototype.possessives = function (n) {
      //find currently-contracted
      var found = this.match('#Noun+? #Possessive'); //todo: split consecutive contractions

      if (typeof n === 'number') {
        found = found.get(n);
      }

      return new Possessives(found.list, this, this.world);
    };

    return Doc;
  };

  var Possessives = addMethod$7;

  var pairs = {
    "\"": "\"",
    // 'StraightDoubleQuotes'
    "\uFF02": "\uFF02",
    // 'StraightDoubleQuotesWide'
    "'": "'",
    // 'StraightSingleQuotes'
    "\u201C": "\u201D",
    // 'CommaDoubleQuotes'
    "\u2018": "\u2019",
    // 'CommaSingleQuotes'
    "\u201F": "\u201D",
    // 'CurlyDoubleQuotesReversed'
    "\u201B": "\u2019",
    // 'CurlySingleQuotesReversed'
    "\u201E": "\u201D",
    // 'LowCurlyDoubleQuotes'
    "\u2E42": "\u201D",
    // 'LowCurlyDoubleQuotesReversed'
    "\u201A": "\u2019",
    // 'LowCurlySingleQuotes'
    "\xAB": "\xBB",
    // 'AngleDoubleQuotes'
    "\u2039": "\u203A",
    // 'AngleSingleQuotes'
    // Prime 'non quotation'
    "\u2035": "\u2032",
    // 'PrimeSingleQuotes'
    "\u2036": "\u2033",
    // 'PrimeDoubleQuotes'
    "\u2037": "\u2034",
    // 'PrimeTripleQuotes'
    // Prime 'quotation' variation
    "\u301D": "\u301E",
    // 'PrimeDoubleQuotes'
    "`": "\xB4",
    // 'PrimeSingleQuotes'
    "\u301F": "\u301E" // 'LowPrimeDoubleQuotesReversed'

  };
  var hasOpen = RegExp('(' + Object.keys(pairs).join('|') + ')');

  var addMethod$8 = function addMethod(Doc) {
    /** "these things" */
    var Quotations =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Quotations, _Doc);

      function Quotations() {
        _classCallCheck(this, Quotations);

        return _possibleConstructorReturn(this, _getPrototypeOf(Quotations).apply(this, arguments));
      }

      _createClass(Quotations, [{
        key: "unwrap",

        /** remove the quote characters */
        value: function unwrap() {
          return this;
        }
      }]);

      return Quotations;
    }(Doc);

    Doc.prototype.quotations = function (n) {
      var list = [];
      this.list.forEach(function (p) {
        var terms = p.terms(); //look for opening quotes

        for (var i = 0; i < terms.length; i += 1) {
          var t = terms[i];

          if (hasOpen.test(t.pre)) {
            var _char = (t.pre.match(hasOpen) || [])[0];
            var want = pairs[_char]; // if (!want) {
            //   console.warn('missing quote char ' + char)
            // }
            //look for the closing bracket..

            for (var o = i; o < terms.length; o += 1) {
              if (terms[o].post.indexOf(want) !== -1) {
                var len = o - i + 1;
                list.push(p.buildFrom(t.id, len));
                i = o;
                break;
              }
            }
          }
        }
      }); //support nth result

      if (typeof n === 'number') {
        if (list[n]) {
          list = [list[n]];
        } else {
          list = [];
        }

        return new Quotations(list, this, this.world);
      }

      return new Quotations(list, this, this.world);
    }; // alias


    Doc.prototype.quotes = Doc.prototype.quotations;
    return Doc;
  };

  var Quotations = addMethod$8;

  // walked => walk  - turn a verb into it's root form
  var toInfinitive$1 = function toInfinitive(parsed, world) {
    var verb = parsed.verb; //1. if it's already infinitive

    var str = verb.text('normal');

    if (verb.has('#Infinitive')) {
      return str;
    } // 2. world transform does the heavy-lifting


    var tense = null;

    if (verb.has('#PastTense')) {
      tense = 'PastTense';
    } else if (verb.has('#Gerund')) {
      tense = 'Gerund';
    } else if (verb.has('#PresentTense')) {
      tense = 'PresentTense';
    } else if (verb.has('#Participle')) {
      tense = 'Participle';
    } else if (verb.has('#Actor')) {
      tense = 'Actor';
    }

    return world.transforms.toInfinitive(str, world, tense);
  };

  var toInfinitive_1$1 = toInfinitive$1;

  // spencer walks -> singular
  // we walk -> plural
  // the most-recent noun-phrase, before this verb.
  var findNoun = function findNoun(vb) {
    var noun = vb.lookBehind('#Noun+').last();
    return noun;
  }; //sometimes you can tell if a verb is plural/singular, just by the verb
  // i am / we were
  // othertimes you need its subject 'we walk' vs 'i walk'


  var isPlural$3 = function isPlural(parsed) {
    var vb = parsed.verb;

    if (vb.has('(are|were|does)') || parsed.auxiliary.has('(are|were|does)')) {
      return true;
    }

    if (vb.has('(is|am|do|was)') || parsed.auxiliary.has('(is|am|do|was)')) {
      return false;
    } //consider its prior noun


    var noun = findNoun(vb);

    if (noun.has('(we|they|you)')) {
      return true;
    }

    if (noun.has('#Plural')) {
      return true;
    }

    if (noun.has('#Singular')) {
      return false;
    }

    return null;
  };

  var isPlural_1$2 = isPlural$3;

  // #Copula : is           -> 'is not'
  // #PastTense : walked    -> did not walk
  // #PresentTense : walks  -> does not walk
  // #Gerund : walking:     -> not walking
  // #Infinitive : walk     -> do not walk

  var toNegative = function toNegative(parsed, world) {
    var vb = parsed.verb; // if it's already negative...

    if (parsed.negative.found) {
      return;
    } // would walk -> would not walk


    if (parsed.auxiliary.found) {
      parsed.auxiliary.eq(0).append('not');
      return;
    } // is walking -> is not walking


    if (vb.has('(#Copula|will|has|had|do)')) {
      vb.append('not');
      return;
    } // walked -> did not walk


    if (vb.has('#PastTense')) {
      var inf = toInfinitive_1$1(parsed, world);
      vb.replaceWith(inf, true);
      vb.prepend('did not');
      return;
    } // walks -> does not walk


    if (vb.has('#PresentTense')) {
      var _inf = toInfinitive_1$1(parsed, world);

      vb.replaceWith(_inf, true);

      if (isPlural_1$2(parsed)) {
        vb.prepend('do not');
      } else {
        vb.prepend('does not');
      }

      return;
    } //walking -> not walking


    if (vb.has('#Gerund')) {
      var _inf2 = toInfinitive_1$1(parsed, world);

      vb.replaceWith(_inf2, true);
      vb.prepend('not');
      return;
    } //fallback 1:  walk -> does not walk


    if (isPlural_1$2(parsed)) {
      vb.prepend('does not');
      return;
    } //fallback 2:  walk -> do not walk


    vb.prepend('do not');
    return;
  };

  var toNegative_1 = toNegative;

  // turn 'would not really walk up' into parts
  var parseVerb = function parseVerb(vb) {
    var parsed = {
      adverb: vb.match('#Adverb+'),
      // 'really'
      negative: vb.match('#Negative'),
      // 'not'
      auxiliary: vb.match('#Auxiliary').not('(#Negative|#Adverb)'),
      // 'will' of 'will go'
      particle: vb.match('#Particle'),
      // 'up' of 'pull up'
      verb: vb.match('#Verb').not('(#Adverb|#Negative|#Auxiliary|#Particle)')
    }; // fallback, if no verb found

    if (!parsed.verb.found) {
      // blank-everything
      Object.keys(parsed).forEach(function (k) {
        parsed[k] = parsed[k].not('.');
      }); // it's all the verb

      parsed.verb = vb;
      return parsed;
    } //


    if (parsed.adverb && parsed.adverb.found) {
      var match = parsed.adverb.text('reduced') + '$';

      if (vb.has(match)) {
        parsed.adverbAfter = true;
      }
    }

    return parsed;
  };

  var parse$2 = parseVerb;

  /** too many special cases for is/was/will be*/

  var toBe = function toBe(parsed) {
    var isI = false;
    var plural = isPlural_1$2(parsed);
    var isNegative = parsed.negative.found; //account for 'i is' -> 'i am' irregular
    // if (vb.parent && vb.parent.has('i #Adverb? #Copula')) {
    //   isI = true;
    // }
    // 'i look', not 'i looks'

    if (parsed.verb.lookBehind('(i|we) (#Adverb|#Verb)?$').found) {
      isI = true;
    }

    var obj = {
      PastTense: 'was',
      PresentTense: 'is',
      FutureTense: 'will be',
      Infinitive: 'is',
      Gerund: 'being',
      Actor: '',
      PerfectTense: 'been',
      Pluperfect: 'been'
    }; //"i is" -> "i am"

    if (isI === true) {
      obj.PresentTense = 'am';
      obj.Infinitive = 'am';
    }

    if (plural) {
      obj.PastTense = 'were';
      obj.PresentTense = 'are';
      obj.Infinitive = 'are';
    }

    if (isNegative) {
      obj.PastTense += ' not';
      obj.PresentTense += ' not';
      obj.FutureTense = 'will not be';
      obj.Infinitive += ' not';
      obj.PerfectTense = 'not ' + obj.PerfectTense;
      obj.Pluperfect = 'not ' + obj.Pluperfect;
      obj.Gerund = 'not ' + obj.Gerund;
    }

    return obj;
  };

  var toBe_1 = toBe;

  var conjugate$2 = function conjugate(parsed, world) {
    var verb = parsed.verb; //special handling of 'is', 'will be', etc.

    if (verb.has('#Copula') || verb.out('normal') === 'be' && parsed.auxiliary.has('will')) {
      return toBe_1(parsed);
    }

    var hasHyphen = parsed.verb.termList(0).hasHyphen();
    var infinitive = toInfinitive_1$1(parsed, world);

    if (!infinitive) {
      return {};
    }

    var forms = world.transforms.conjugate(infinitive, world);
    forms.Infinitive = infinitive; // add particle to phrasal verbs ('fall over')

    if (parsed.particle.found) {
      var particle = parsed.particle.text();
      var space = hasHyphen === true ? '-' : ' ';
      Object.keys(forms).forEach(function (k) {
        return forms[k] += space + particle;
      });
    } //put the adverb at the end?


    if (parsed.adverb.found) {
      var adverb = parsed.adverb.text();

      var _space = hasHyphen === true ? '-' : ' ';

      if (parsed.adverbAfter === true) {
        Object.keys(forms).forEach(function (k) {
          return forms[k] += _space + adverb;
        });
      } else {
        Object.keys(forms).forEach(function (k) {
          return forms[k] = adverb + _space + forms[k];
        });
      }
    } //apply negative


    var isNegative = parsed.negative.found;

    if (isNegative) {
      forms.PastTense = 'did not ' + forms.Infinitive;
      forms.PresentTense = 'does not ' + forms.Infinitive;
      forms.Gerund = 'not ' + forms.Gerund;
    } //future Tense is pretty straightforward


    if (!forms.FutureTense) {
      if (isNegative) {
        forms.FutureTense = 'will not ' + forms.Infinitive;
      } else {
        forms.FutureTense = 'will ' + forms.Infinitive;
      }
    }

    if (isNegative) {
      forms.Infinitive = 'not ' + forms.Infinitive;
    }

    return forms;
  };

  var conjugate_1$1 = conjugate$2;

  var methods$7 = {
    /** overload the original json with verb information */
    json: function json(options) {
      var _this = this;

      var n = null;

      if (typeof options === 'number') {
        n = options;
        options = null;
      }

      options = options || {
        text: true,
        normal: true,
        trim: true,
        terms: true
      };
      var res = [];
      this.forEach(function (p) {
        var json = p.json(options)[0];
        var parsed = parse$2(p);
        json.parts = {};
        Object.keys(parsed).forEach(function (k) {
          json.parts[k] = parsed[k].text('normal');
        });
        json.isNegative = p.has('#Negative');
        json.conjugations = conjugate_1$1(parsed, _this.world);
        res.push(json);
      });

      if (n !== null) {
        return res[n];
      }

      return res;
    },

    /** grab the adverbs describing these verbs */
    adverbs: function adverbs() {
      var list = []; // look at internal adverbs

      this.forEach(function (vb) {
        var advb = parse$2(vb).adverb;

        if (advb.found) {
          list = list.concat(advb.list);
        }
      }); // look for leading adverbs

      var m = this.lookBehind('#Adverb+$');

      if (m.found) {
        list = m.list.concat(list);
      } // look for trailing adverbs


      m = this.lookAhead('^#Adverb+');

      if (m.found) {
        list = list.concat(m.list);
      }

      return this.buildFrom(list);
    },

    /**return verbs like 'we walk' and not 'spencer walks' */
    isPlural: function isPlural() {
      var _this2 = this;

      var list = [];
      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        if (isPlural_1$2(parsed, _this2.world) === true) {
          list.push(vb.list[0]);
        }
      });
      return this.buildFrom(list);
    },

    /** return verbs like 'spencer walks' and not 'we walk' */
    isSingular: function isSingular() {
      var _this3 = this;

      var list = [];
      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        if (isPlural_1$2(parsed, _this3.world) === false) {
          list.push(vb.list[0]);
        }
      });
      return this.buildFrom(list);
    },

    /**  */
    conjugate: function conjugate() {
      var _this4 = this;

      var result = [];
      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        var forms = conjugate_1$1(parsed, _this4.world);

        result.push(forms);
      });
      return result;
    },

    /** */
    toPastTense: function toPastTense() {
      var _this5 = this;

      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        var str = conjugate_1$1(parsed, _this5.world).PastTense;

        if (str) {
          vb.replaceWith(str, false); // vb.tag('PastTense')
        }
      });
      return this;
    },

    /** */
    toPresentTense: function toPresentTense() {
      var _this6 = this;

      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        var obj = conjugate_1$1(parsed, _this6.world);

        var str = obj.PresentTense; // 'i look', not 'i looks'

        if (vb.lookBehind('(i|we) (#Adverb|#Verb)?$').found) {
          str = obj.Infinitive;
        }

        if (str) {
          vb.replaceWith(str, false);
          vb.tag('PresentTense');
        }
      });
      return this;
    },

    /** */
    toFutureTense: function toFutureTense() {
      var _this7 = this;

      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        var str = conjugate_1$1(parsed, _this7.world).FutureTense;

        if (str) {
          vb.replaceWith(str, false);
          vb.tag('FutureTense');
        }
      });
      return this;
    },

    /** */
    toInfinitive: function toInfinitive() {
      var _this8 = this;

      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        var str = conjugate_1$1(parsed, _this8.world).Infinitive;

        if (str) {
          vb.replaceWith(str, false);
          vb.tag('Infinitive');
        }
      });
      return this;
    },

    /** */
    toGerund: function toGerund() {
      var _this9 = this;

      this.forEach(function (vb) {
        var parsed = parse$2(vb);

        var str = conjugate_1$1(parsed, _this9.world).Gerund;

        if (str) {
          vb.replaceWith(str, false);
          vb.tag('Gerund');
        }
      });
      return this;
    },

    /** return only verbs with 'not'*/
    isNegative: function isNegative() {
      return this["if"]('#Negative');
    },

    /**  return only verbs without 'not'*/
    isPositive: function isPositive() {
      return this.ifNo('#Negative');
    },

    /** add a 'not' to these verbs */
    toNegative: function toNegative() {
      var _this10 = this;

      this.list.forEach(function (p) {
        var doc = _this10.buildFrom([p]);

        var parsed = parse$2(doc);

        toNegative_1(parsed, doc.world);
      });
      return this;
    },

    /** remove 'not' from these verbs */
    toPositive: function toPositive() {
      var m = this.match('do not #Verb');

      if (m.found) {
        m.remove('do not');
      }

      return this.remove('#Negative');
    }
  };

  var addMethod$9 = function addMethod(Doc) {
    /**  */
    var Verbs =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(Verbs, _Doc);

      function Verbs() {
        _classCallCheck(this, Verbs);

        return _possibleConstructorReturn(this, _getPrototypeOf(Verbs).apply(this, arguments));
      }

      return Verbs;
    }(Doc); // add-in our methods


    Object.assign(Verbs.prototype, methods$7); // aliases

    Verbs.prototype.negate = Verbs.prototype.toNegative;

    Doc.prototype.verbs = function (n) {
      var match = this.match('(#Adverb|#Auxiliary|#Verb|#Negative|#Particle)+'); // try to ignore leading and trailing adverbs

      match = match.not('^#Adverb+');
      match = match.not('#Adverb+$'); // handle commas:
      // don't split 'really, really'

      var keep = match.match('(#Adverb && @hasComma) #Adverb'); // // but split the other commas

      var m = match.not(keep).splitAfter('@hasComma'); // // combine them back together

      m = m.concat(keep);
      m.sort('index'); //handle slashes?
      //ensure there's actually a verb

      m = m["if"]('#Verb'); //grab (n)th result

      if (typeof n === 'number') {
        m = m.get(n);
      }

      var vb = new Verbs(m.list, this, this.world);
      return vb;
    };

    return Doc;
  };

  var Verbs = addMethod$9;

  var addMethod$a = function addMethod(Doc) {
    /**  */
    var People =
    /*#__PURE__*/
    function (_Doc) {
      _inherits(People, _Doc);

      function People() {
        _classCallCheck(this, People);

        return _possibleConstructorReturn(this, _getPrototypeOf(People).apply(this, arguments));
      }

      return People;
    }(Doc);

    Doc.prototype.people = function (n) {
      var match = this.splitAfter('@hasComma');
      match = match.match('#Person+'); //grab (n)th result

      if (typeof n === 'number') {
        match = match.get(n);
      }

      return new People(match.list, this, this.world);
    };

    return Doc;
  };

  var People = addMethod$a;

  var subclass = [Abbreviations, Acronyms, Clauses, Contractions, Lists, Nouns, Parentheses, Possessives, Quotations, Verbs, People];

  var extend = function extend(Doc) {
    // add basic methods
    Object.keys(_simple).forEach(function (k) {
      return Doc.prototype[k] = _simple[k];
    }); // add subclassed methods

    subclass.forEach(function (addFn) {
      return addFn(Doc);
    });
    return Doc;
  };

  var Subset = extend;

  var methods$8 = {
    misc: methods$4,
    selections: _simple
  };
  /** a parsed text object */

  var Doc =
  /*#__PURE__*/
  function () {
    function Doc(list, from, world) {
      var _this = this;

      _classCallCheck(this, Doc);

      this.list = list; //quiet these properties in console.logs

      Object.defineProperty(this, 'from', {
        enumerable: false,
        value: from,
        writable: true
      }); //borrow some missing data from parent

      if (world === undefined && from !== undefined) {
        world = from.world;
      } //'world' getter


      Object.defineProperty(this, 'world', {
        enumerable: false,
        value: world,
        writable: true
      }); //fast-scans for our data
      //'found' getter

      Object.defineProperty(this, 'found', {
        get: function get() {
          return _this.list.length > 0;
        }
      }); //'length' getter

      Object.defineProperty(this, 'length', {
        get: function get() {
          return _this.list.length;
        }
      }); // this is way easier than .constructor.name...

      Object.defineProperty(this, 'isA', {
        get: function get() {
          return 'Doc';
        }
      });
    }
    /** run part-of-speech tagger on all results*/


    _createClass(Doc, [{
      key: "tagger",
      value: function tagger() {
        return _02Tagger(this);
      }
      /** pool is stored on phrase objects */

    }, {
      key: "pool",
      value: function pool() {
        if (this.list.length > 0) {
          return this.list[0].pool;
        }

        return this.all().list[0].pool;
      }
    }]);

    return Doc;
  }();
  /** create a new Document object */


  Doc.prototype.buildFrom = function (list) {
    list = list.map(function (p) {
      return p.clone(true);
    }); // new this.constructor()

    var doc = new Doc(list, this, this.world);
    return doc;
  };
  /** create a new Document from plaintext. */


  Doc.prototype.fromText = function (str) {
    var list = _01Tokenizer.fromText(str, this.world, this.pool());
    return this.buildFrom(list);
  };

  Object.assign(Doc.prototype, methods$8.misc);
  Object.assign(Doc.prototype, methods$8.selections); //add sub-classes

  Subset(Doc); //aliases

  var aliases$1 = {
    untag: 'unTag',
    and: 'match',
    notIf: 'ifNo',
    only: 'if',
    onlyIf: 'if'
  };
  Object.keys(aliases$1).forEach(function (k) {
    return Doc.prototype[k] = Doc.prototype[aliases$1[k]];
  });
  var Doc_1 = Doc;

  var world = new World_1();
  /** parse and tag text into a compromise object  */

  var nlp = function nlp() {
    var text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var lexicon = arguments.length > 1 ? arguments[1] : undefined;

    if (lexicon) {
      world.addWords(lexicon);
    }

    var list = _01Tokenizer.fromText(text, world);
    var doc = new Doc_1(list, null, world);
    doc.tagger();
    return doc;
  };
  /** parse text into a compromise object, without running POS-tagging */


  nlp.tokenize = function () {
    var text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var lexicon = arguments.length > 1 ? arguments[1] : undefined;

    if (lexicon) {
      world.addWords(lexicon);
    }

    var list = _01Tokenizer.fromText(text, world);
    var doc = new Doc_1(list, null, world);
    return doc;
  };
  /** mix in a compromise-plugin */


  nlp.extend = function (fn) {
    fn(Doc_1, world);
    return this;
  };
  /** make a deep-copy of the library state */


  nlp.clone = function () {
    world = world.clone();
    return this;
  };
  /** re-generate a Doc object from .json() results */


  nlp.load = function (json) {
    var list = _01Tokenizer.fromJSON(json, world);
    return new Doc_1(list, null, world);
  };
  /** log our decision-making for debugging */


  nlp.verbose = function () {
    var bool = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
    world.verbose(bool);
    return this;
  };
  /** current version of the library */


  nlp.version = _version; // alias

  nlp["import"] = nlp.load;
  var src = nlp;

  return src;

})));


},{}],4:[function(_dereq_,module,exports){
"use strict";

var nlp = _dereq_('compromise');

var highlight = function highlight(editor, patterns) {
  editor.on('change', function (doc) {
    var str = doc.getValue();
    var d = nlp(str);
    Object.keys(patterns).forEach(function (k) {
      var m = d.match(k);

      if (m.found) {
        var json = m.json({
          offset: true
        });
        json.forEach(function (o) {
          var start = doc.posFromIndex(o.offset.start);
          var end = doc.posFromIndex(o.offset.start + o.offset.length);
          editor.markText(start, end, {
            className: patterns[k] // css: 'background:yellow;font-weight:bold;',

          });
        });
      }
    }); // let parts = d.segment(patterns)
    // parts.forEach(obj => {
    //   if (obj.segment) {
    //   }
    // })
  });
};

module.exports = highlight;

},{"compromise":3}]},{},[2]);
