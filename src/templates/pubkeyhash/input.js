// {signature} {pubKey}

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')

function checkRaw (chunks, compressed) {
  typeforce(types.Array, chunks)
  return chunks.length === 2 &&
    bscript.isCanonicalSignature(chunks[0]) &&
    bscript.isCanonicalPubKey(chunks[1], compressed)
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

function decodeRaw (chunks) {
  typeforce(checkRaw, chunks)
  return {
    signature: chunks[0],
    pubKey: chunks[1]
  }
}

// specializations
function checkWitness (witness) {
  typeforce(types.Witness, witness)
  return checkRaw(witness, true)
}

function encodeWitness (signature, pubKey) {
  typeforce(bscript.isCanonicalPubKey, pubKey, true)
  return encodeRaw(signature, pubKey)
}

module.exports = {
  checkRaw: checkRaw,
  checkWitness: checkWitness,
  decodeRaw: decodeRaw,
  encodeRaw: encodeRaw,
  encodeWitness: encodeWitness,
  rawWitness: true
}
