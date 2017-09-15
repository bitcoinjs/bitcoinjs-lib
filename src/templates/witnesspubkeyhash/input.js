// {signature} {pubKey}

var bscript = require('../../script')
var pkh = require('../pubkeyhash')
var typeforce = require('typeforce')

function checkRaw (chunks) {
  return pkh.checkRaw(chunks, true)
}
checkRaw.toJSON = function () { return 'witness pubKeyHash input' }

function encodeRaw (signature) {
  typeforce(bscript.isCanonicalSignature, signature, true)
  return pkh.encodeWitness(signature)
}

module.exports = {
  checkRaw: checkRaw,
  decodeRaw: pkh.decodeRaw,
  encodeRaw: encodeRaw,
  noScript: true
}
