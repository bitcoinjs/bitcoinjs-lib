// {signature} {pubKey}

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')

function isCompressedCanonicalPubKey (pubKey) {
  return bscript.isCanonicalPubKey(pubKey) && pubKey.length === 33
}

function checkRaw (chunks) {
  typeforce(types.Array, chunks)
  return chunks.length === 2 &&
    bscript.isCanonicalSignature(chunks[0]) &&
    isCompressedCanonicalPubKey(chunks[1])
}
checkRaw.toJSON = function () { return 'witnessPubKeyHash input' }

function encodeRaw (signature, pubKey) {
  typeforce({
    signature: bscript.isCanonicalSignature,
    pubKey: isCompressedCanonicalPubKey
  }, {
    signature: signature,
    pubKey: pubKey
  })

  return [signature, pubKey]
}

function decodeRaw (chunks) {
  typeforce(checkRaw, chunks)
  return {
    signature: chunks[0],
    pubKey: chunks[1]
  }
}

module.exports = {
  checkRaw: checkRaw,
  decodeRaw: decodeRaw,
  encodeRaw: encodeRaw,
  noScript: true
}
