// {signature}

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')

function checkRaw (chunks) {
  typeforce(types.Array, chunks)
  return chunks.length === 1 &&
    bscript.isCanonicalSignature(chunks[0])
}
checkRaw.toJSON = function () { return 'pubKey input' }

function encodeRaw (signature) {
  typeforce(bscript.isCanonicalSignature, signature)
  return [signature]
}

function decodeRaw (chunks) {
  typeforce(checkRaw, chunks)
  return chunks[0]
}

module.exports = {
  checkRaw: checkRaw,
  decodeRaw: decodeRaw,
  encodeRaw: encodeRaw,
  rawWitness: true
}
