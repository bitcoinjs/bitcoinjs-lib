// {scriptSig} {serialized scriptPubKey script}

var bscript = require('../../script')
var types = require('../../types')
var typeforce = require('typeforce')

function checkRaw (chunks, allowIncomplete) {
  typeforce(types.Array, chunks)
  if (chunks.length < 1) return false

  var witnessScript = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(witnessScript)) return false

  var witnessScriptChunks = bscript.decompile(witnessScript)

  // is witnessScript a valid script?
  if (witnessScriptChunks.length === 0) return false

  var witnessRawScript = bscript.compile(chunks.slice(0, -1))
  var inputType = bscript.classifyInput(witnessRawScript, allowIncomplete)
  var outputType = bscript.classifyOutput(witnessScript)
  return inputType === outputType
}
checkRaw.toJSON = function () { return 'witnessScriptHash input' }

function encodeRaw (witness, witnessScript) {
  typeforce({
    witness: types.Witness,
    witnessScript: types.Buffer
  }, {
    witness: witness,
    witnessScript: witnessScript
  })

  return [].concat(witness, witnessScript)
}

function decodeRaw (chunks) {
  typeforce(checkRaw, chunks)
  return {
    witness: chunks[0],
    witnessScript: chunks[1]
  }
}

module.exports = {
  checkRaw: checkRaw,
  decodeRaw: decodeRaw,
  encodeRaw: encodeRaw
}
