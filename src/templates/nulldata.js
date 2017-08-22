// OP_RETURN {data}

var bscript = require('../script')
var types = require('../types')
var typeforce = require('typeforce')
var OPS = require('bitcoin-ops')

function check (script) {
  var buffer = bscript.compile(script)

  return buffer.length > 1 &&
    buffer[0] === OPS.OP_RETURN
}
check.toJSON = function () { return 'null data output' }

function encode (data) {
  typeforce(typeforce.oneOf(types.Buffer, types.Array), data)

  if (!types.Array(data)) {
    data = [ data ]
  }

  return bscript.compile([OPS.OP_RETURN].concat(data))
}

function decode (buffer) {
  typeforce(check, buffer)

  var chunks = bscript.decompile(buffer)

  chunks.shift()

  return chunks.length === 1 ? chunks[0] : chunks
}

module.exports = {
  output: {
    check: check,
    decode: decode,
    encode: encode
  }
}
