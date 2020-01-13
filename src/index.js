const nlp = require('compromise')

const highlight = function(editor, patterns) {
  // each keypress
  editor.on('change', doc => {
    // get text
    let str = doc.getValue()
    // parse it
    let d = nlp(str)
    // run each pattern
    Object.keys(patterns).forEach(k => {
      let m = d.match(k)
      if (m.found) {
        // get the char-offset for each match
        let json = m.json({ offset: true })
        // highlight each segment
        json.forEach(o => {
          let start = doc.posFromIndex(o.offset.start)
          let end = doc.posFromIndex(o.offset.start + o.offset.length)
          editor.markText(start, end, {
            className: patterns[k]
          })
        })
      }
    })
  })
}

module.exports = highlight
