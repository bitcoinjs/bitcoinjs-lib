// {signature} {pubKey}

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')

function checkRaw (chunks) {
  typeforce(types.Array, chunks)
  return chunks.length === 2 &&
    bscript.isCanonicalSignature(chunks[0]) &&
    bscript.isCanonicalPubKey(chunks[1])
}
checkRaw.toJSON = function () { return 'pubKeyHash input' }

function encodeRaw (signature, pubKey) {
  typeforce({
    signature: bscript.isCanonicalSignature,
    pubKey: bscript.isCanonicalPubKey
  }, {
    signature: signature,
    pubKey: pubKey
  })

  return [signature, pubKey]
}

function decodeRaw (chunks, allowIncomplete) {
  typeforce(checkRaw, chunks, allowIncomplete)
  return {
    signature: chunks[0],
    pubKey: chunks[1]
  }
}

module.exports = {
  checkRaw: checkRaw,
  decodeRaw: decodeRaw,
  encodeRaw: encodeRaw,
  rawWitness: true
}
