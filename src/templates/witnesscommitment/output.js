// OP_RETURN {aa21a9ed} {commitment}

var Buffer = require('safe-buffer').Buffer
var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')
var OPS = require('bitcoin-ops')

var HEADER = Buffer.from('aa21a9ed', 'hex')

function check (script) {
  var buffer = bscript.compile(script)

  return buffer.length > 37 &&
    buffer[0] === OPS.OP_RETURN &&
    buffer[1] === 0x24 &&
    buffer.slice(2, 6).equals(HEADER)
}

check.toJSON = function () { return 'Witness commitment output' }

function encode (commitment) {
  typeforce(types.Hash256bit, commitment)

  var buffer = Buffer.allocUnsafe(36)
  HEADER.copy(buffer, 0)
  commitment.copy(buffer, 4)

  return bscript.compile([OPS.OP_RETURN, buffer])
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
