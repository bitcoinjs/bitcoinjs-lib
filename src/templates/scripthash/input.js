// <scriptSig> {serialized scriptPubKey script}

var bscript = require('../../script')
var typeforce = require('typeforce')

function check (script, allowIncomplete) {
  var chunks = bscript.decompile(script)
  if (chunks.length < 1) return false

  var lastChunk = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSigChunks = bscript.decompile(bscript.compile(chunks.slice(0, -1)))
  var redeemScriptChunks = bscript.decompile(lastChunk)

  // is redeemScript a valid script?
  if (redeemScriptChunks.length === 0) return false

  // is redeemScriptSig push only?
  if (!bscript.isPushOnly(scriptSigChunks)) return false

  var inputType = bscript.classifyInput(scriptSigChunks, allowIncomplete)
  var outputType = bscript.classifyOutput(redeemScriptChunks)
  if (chunks.length === 1) {
    return outputType === bscript.types.P2WSH || outputType === bscript.types.P2WPKH
  }
  return inputType === outputType
}
check.toJSON = function () { return 'scriptHash input' }

function encodeStack (redeemScriptStack, redeemScript) {
  var serializedScriptPubKey = bscript.compile(redeemScript)

  return [].concat(redeemScriptStack, serializedScriptPubKey)
}

function encode (redeemScriptSig, redeemScript) {
  var redeemScriptStack = bscript.decompile(redeemScriptSig)

  return bscript.compile(encodeStack(redeemScriptStack, redeemScript))
}

function decodeStack (stack) {
  typeforce(check, stack)

  return {
    redeemScriptStack: stack.slice(0, -1),
    redeemScript: stack[stack.length - 1]
  }
}

function decode (buffer) {
  var stack = bscript.decompile(buffer)
  var result = decodeStack(stack)
  result.redeemScriptSig = bscript.compile(result.redeemScriptStack)
  delete result.redeemScriptStack
  return result
}

module.exports = {
  check: check,
  decode: decode,
  decodeStack: decodeStack,
  encode: encode,
  encodeStack: encodeStack
}
