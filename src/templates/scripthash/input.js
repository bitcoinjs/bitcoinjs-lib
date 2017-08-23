// <scriptSig> {serialized scriptPubKey script}

var Buffer = require('safe-buffer').Buffer
var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')

// check
function checkRaw (chunks, allowIncomplete) {
  typeforce(types.Array, chunks)
  if (chunks.length < 1) return false

  var lastChunk = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSig = bscript.compile(chunks.slice(0, -1))
  var redeemScriptChunks = bscript.decompile(lastChunk)

  // is redeemScript a valid script?
  if (redeemScriptChunks.length === 0) return false

  // is redeemScriptSig push only?
  var scriptSigChunks = bscript.decompile(scriptSig)
  if (!bscript.isPushOnly(scriptSigChunks)) return false

  var inputType = bscript.classifyInput(scriptSig, allowIncomplete)
  var outputType = bscript.classifyOutput(lastChunk)
  if (chunks.length === 1) {
    return outputType === bscript.types.P2WSH || outputType === bscript.types.P2WPKH
  }
  return inputType === outputType
}
checkRaw.toJSON = function () { return 'scriptHash input' }

function encodeRaw (redeemScriptSig, redeemScript) {
  typeforce({
    redeemScriptSig: types.Buffer,
    redeemScript: types.Buffer
  }, {
    redeemScriptSig: redeemScriptSig,
    redeemScript: redeemScript
  })

  redeemScriptSig = bscript.decompile(redeemScriptSig)
  if (!bscript.isPushOnly(redeemScriptSig)) throw new TypeError('P2SH scriptSigs are PUSH only')
  return [].concat(redeemScriptSig, redeemScript)
}

function decodeRaw (chunks) {
  typeforce(checkRaw, chunks)
  return {
    redeemScriptSig: bscript.compile(chunks.slice(0, -1)),
    redeemScript: chunks[chunks.length - 1]
  }
}

module.exports = {
  checkRaw: checkRaw,
  decodeRaw: decodeRaw,
  encodeRaw: encodeRaw
}
