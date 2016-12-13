// OP_RETURN 36bytes:[0xaa21a9ed, Hash256(witnessRoot )]

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')
var OPS = require('bitcoin-ops')

function check (script) {
  var buffer = bscript.compile(script)

  return buffer.length > 37 &&
    buffer[0] === OPS.OP_RETURN &&
    buffer[1] === 0x24 &&
    buffer.slice(2, 6).toString('hex') === 'aa21a9ed'
}

check.toJSON = function () { return 'Witness commitment output' }

function encode (commitment) {
  // hash256 0x21 hash160 0xed
  typeforce(types.Hash256bit, commitment)

  return bscript.compile([OPS.OP_RETURN, new Buffer('aa21a9ed' + commitment.toString('hex'), 'hex')])
}

function decode (buffer) {
  typeforce(check, buffer)

  return bscript.decompile(buffer)[1].slice(4, 36)
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}
