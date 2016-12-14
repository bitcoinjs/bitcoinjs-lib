// {signature} {pubKey}

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')

function check (script) {
  var chunks = bscript.decompile(script)

  return chunks.length === 2 &&
    bscript.isCanonicalSignature(chunks[0]) &&
    bscript.isCanonicalPubKey(chunks[1])
}
check.toJSON = function () { return 'pubKeyHash input' }

function encode (signature, pubKey) {
  typeforce({
    signature: types.Buffer, pubKey: types.Buffer
  }, {
    signature: signature, pubKey: pubKey
  })

  return bscript.compile([signature, pubKey])
}

function decode (buffer) {
  var chunks = bscript.decompile(buffer)
  typeforce(check, chunks)

  return {
    signature: chunks[0],
    pubKey: chunks[1]
  }
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}
