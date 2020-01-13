const CodeMirror = require('./assets/codemirror')
const highlight = require('./src')
// const highlight = require('./builds/compromise-highlight')

var editor = CodeMirror.fromTextArea(document.getElementById('text'), {
  viewportMargin: Infinity,
  mode: 'fancy',
  height: 'auto',
  width: 'auto',
  lineNumbers: false,
  theme: 'material',
  autofocus: true
})

let patterns = document.querySelector('#patterns').innerHTML
patterns = JSON.parse(patterns)

highlight(editor, patterns)

//run highlighting on init
CodeMirror.signal(editor, 'change', editor)
