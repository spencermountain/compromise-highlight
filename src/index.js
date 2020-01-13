const nlp = require('compromise')

const highlight = function(editor, patterns) {
  editor.on('change', doc => {
    let str = doc.getValue()
    let d = nlp(str)
    Object.keys(patterns).forEach(k => {
      let m = d.match(k)
      if (m.found) {
        let json = m.json({ offset: true })
        json.forEach(o => {
          let start = doc.posFromIndex(o.offset.start)
          let end = doc.posFromIndex(o.offset.start + o.offset.length)
          editor.markText(start, end, {
            className: patterns[k]
            // css: 'background:yellow;font-weight:bold;',
          })
        })
      }
    })
    // let parts = d.segment(patterns)
    // parts.forEach(obj => {
    //   if (obj.segment) {
    //   }
    // })
  })
}

module.exports = highlight
