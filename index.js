const CodeMirror = require('./assets/codemirror')
const keyPress = require('./src')
// require('./assets/somehowscript')(CodeMirror)

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
console.log(patterns)
patterns = JSON.parse(patterns)

keyPress(editor, patterns)

//run highlighting on init
CodeMirror.signal(editor, 'change', editor)
