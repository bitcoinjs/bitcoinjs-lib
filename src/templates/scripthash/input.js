// <scriptSig> {serialized scriptPubKey script}

var bscript = require('../../script')
var typeforce = require('typeforce')

function check (script, allowIncomplete) {
  var chunks = bscript.decompile(script)
  if (chunks.length < 2) return false

  var lastChunk = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSigChunks = chunks.slice(0, -1)
  var redeemScriptChunks = bscript.decompile(lastChunk)

  // is redeemScript a valid script?
  if (redeemScriptChunks.length === 0) return false

  var inputType = bscript.classifyInput(scriptSigChunks, allowIncomplete)
  var outputType = bscript.classifyOutput(redeemScriptChunks)
  return inputType === outputType
}
check.toJSON = function () { return 'scriptHash input' }

function encode (redeemScriptSig, redeemScript) {
  var scriptSigChunks = bscript.decompilePushOnly(redeemScriptSig)
  var serializedScriptPubKey = bscript.compile(redeemScript)

  return bscript.compile([].concat(
    scriptSigChunks,
    serializedScriptPubKey
  ))
}

function decode (buffer) {
  var chunks = bscript.decompile(buffer)
  typeforce(check, chunks)

  return {
    redeemScriptSig: bscript.compilePushOnly(chunks.slice(0, -1)),
    redeemScript: chunks[chunks.length - 1]
  }
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}
