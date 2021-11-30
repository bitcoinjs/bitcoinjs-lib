// OP_HASH160 {scriptHash} OP_EQUAL

const bscript = require('../../script')
const OPS = require('bitcoin-ops')

function check (script) {
  const buffer = bscript.compile(script)

  return buffer.length === 23 &&
    buffer[0] === OPS.OP_HASH160 &&
    buffer[1] === 0x14 &&
    buffer[22] === OPS.OP_EQUAL
}
check.toJSON = function () { return 'scriptHash output' }

module.exports = { check }
