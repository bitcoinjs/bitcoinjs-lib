// OP_RETURN {data}

const bscript = require('../script')
const types = require('../types')
const typeforce = require('typeforce')
const OPS = require('bitcoin-ops')

function check (script) {
  const buffer = bscript.compile(script)

  return buffer.length > 1 &&
    buffer[0] === OPS.OP_RETURN
}
check.toJSON = function () { return 'null data output' }

function encode (data) {
  typeforce([types.Buffer], data)

  return bscript.compile([OPS.OP_RETURN].concat(data))
}

function decode (buffer) {
  typeforce(check, buffer)

  return bscript.decompile(buffer).slice(1)
}

module.exports = {
  output: {
    check: check,
    decode: decode,
    encode: encode
  }
}
