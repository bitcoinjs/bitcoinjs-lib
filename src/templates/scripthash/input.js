// <scriptSig> {serialized scriptPubKey script}

var bscript = require('../../script')
var typeforce = require('typeforce')

function check (script, allowIncomplete) {
  var chunks = bscript.decompile(script)
  if (chunks.length < 1) return false

  var lastChunk = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSigChunks = chunks.slice(0, -1)
  var redeemScriptChunks = bscript.decompile(lastChunk)

  var outputType = bscript.classifyOutput(redeemScriptChunks)
  if (outputType === bscript.types.P2WSH || outputType === bscript.types.P2WPKH) {
    return true
  }

  var inputType = bscript.classifyInput(scriptSigChunks, allowIncomplete)
  return inputType === outputType
}
check.toJSON = function () { return 'scriptHash input' }

function encode (redeemScriptSig, redeemScript) {
  var scriptSigChunks = bscript.decompile(redeemScriptSig)
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
    redeemScriptSig: bscript.compile(chunks.slice(0, -1)),
    redeemScript: chunks[chunks.length - 1]
  }
}

module.exports = {
  check: check,
  decode: decode,
  encode: encode
}
