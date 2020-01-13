<div align="center">
  <div>compromise-highlight</div>
  <img src="https://cloud.githubusercontent.com/assets/399657/23590290/ede73772-01aa-11e7-8915-181ef21027bc.png" />
  <div><a href="https://spencermounta.in/compromise-highlight/">demo</a></div>
  <a href="https://npmjs.org/package/compromise-highlight">
    <img src="https://img.shields.io/npm/v/compromise-highlight.svg?style=flat-square" />
  </a>
  <a href="https://unpkg.com/compromise-highlight">
    <img src="https://badge-size.herokuapp.com/spencermountain/somehow-ticks/master/builds/compromise-highlight.min.js" />
  </a>
</div>

**work in progress**

this is an attempt to get custom syntax-highlighting for grammatical templates, using [compromise](https://github.com/spencermountain/compromise/) and [codemirror](https://codemirror.net).

`npm i compromise-highlight codemirror`

### Setup

this function accepts a codemirror editor object, that you've already setup.
read the [codemirror docs](https://codemirror.net/) on how to do this.

briefly:

```html
<html>
  <head>
    <link rel="stylesheet" href="./path/to/codemirror.css" />
    <style>
      .person {
        color: steelblue;
      }
    </style>
  </head>
  <body>
    <textarea id="text"></textarea>
  </body>
  <script src="./setup.js"></script>
</html>
```

then in `setup.js`:

```js
const CodeMirror = require('codemirror')
const highlight = require('compromise-highlight')

//setup codemirror instance
const el = document.getElementById('text')
var editor = CodeMirror.fromTextArea(el)

//pass it over, with your patterns
highlight(editor, { '#Person+': 'person' })

//run highlighting on init
CodeMirror.signal(editor, 'change', editor)
```

MIT
