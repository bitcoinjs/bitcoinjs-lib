// OP_0 [signatures ...]

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')
var OPS = require('bitcoin-ops')

function partialSignature (value) {
  return value === OPS.OP_0 || bscript.isCanonicalSignature(value)
}

// check
function checkRaw (chunks, allowIncomplete) {
  typeforce(types.Array, chunks)
  if (chunks.length < 2) return false
  if (chunks[0] !== OPS.OP_0) return false

  if (allowIncomplete) {
    return chunks.slice(1).every(partialSignature)
  }

  return chunks.slice(1).every(bscript.isCanonicalSignature)
}
checkRaw.toJSON = function () { return 'multisig input' }

function encodeRaw (signatures, scriptPubKey) {
  typeforce([partialSignature], signatures)

  if (scriptPubKey) {
    var scriptData = bscript.multisig.output.decode(scriptPubKey)

    if (signatures.length < scriptData.m) {
      throw new TypeError('Not enough signatures provided')
    }

    if (signatures.length > scriptData.pubKeys.length) {
      throw new TypeError('Too many signatures provided')
    }
  }

  return [].concat(OPS.OP_0, signatures)
}

function decodeRaw (chunks, allowIncomplete) {
  typeforce(checkRaw, chunks, allowIncomplete)
  return chunks.slice(1)
}

module.exports = {
  checkRaw: checkRaw,
  decodeRaw: decodeRaw,
  encodeRaw: encodeRaw
}
