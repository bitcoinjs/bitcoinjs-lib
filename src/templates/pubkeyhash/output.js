// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG

const bscript = require('../../script')
const OPS = require('bitcoin-ops')

function check (script) {
  const buffer = bscript.compile(script)

  return buffer.length === 25 &&
    buffer[0] === OPS.OP_DUP &&
    buffer[1] === OPS.OP_HASH160 &&
    buffer[2] === 0x14 &&
    buffer[23] === OPS.OP_EQUALVERIFY &&
    buffer[24] === OPS.OP_CHECKSIG
}
check.toJSON = function () { return 'pubKeyHash output' }

module.exports = { check }
