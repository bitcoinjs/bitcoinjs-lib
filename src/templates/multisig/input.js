// OP_0 [signatures ...]

const bscript = require('../../script')
const OPS = require('bitcoin-ops')

function partialSignature (value) {
  return value === OPS.OP_0 || bscript.isCanonicalScriptSignature(value)
}

function check (script, allowIncomplete) {
  const chunks = bscript.decompile(script)
  if (chunks.length < 2) return false
  if (chunks[0] !== OPS.OP_0) return false

  if (allowIncomplete) {
    return chunks.slice(1).every(partialSignature)
  }

  return chunks.slice(1).every(bscript.isCanonicalScriptSignature)
}
check.toJSON = function () { return 'multisig input' }

module.exports = { check }
