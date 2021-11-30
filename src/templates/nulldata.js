// OP_RETURN {data}

const bscript = require('../script')
const OPS = require('bitcoin-ops')

function check (script) {
  const buffer = bscript.compile(script)

  return buffer.length > 1 &&
    buffer[0] === OPS.OP_RETURN
}
check.toJSON = function () { return 'null data output' }

module.exports = { output: { check: check } }
