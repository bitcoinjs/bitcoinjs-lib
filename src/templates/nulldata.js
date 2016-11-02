// OP_RETURN {data}

var bscript = require('../script')
var types = require('../types')
var typeforce = require('typeforce')
var OPS = require('../opcodes.json')

function check (script) {
  var buffer = bscript.compile(script)

  return buffer.length > 1 &&
    buffer[0] === OPS.OP_RETURN
}

function encode (data) {
  typeforce(types.Buffer, data)

  return bscript.compile([OPS.OP_RETURN, data])
}

function decode (buffer) {
  typeforce(check, buffer)

  return buffer.slice(2)
}

module.exports = {
  output: {
    check: check,
    decode: decode,
    encode: encode
  }
}

