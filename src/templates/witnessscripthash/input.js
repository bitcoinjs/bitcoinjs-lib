// <scriptSig> {serialized scriptPubKey script}

const bscript = require('../../script')
const types = require('../../types')
const typeforce = require('typeforce')

const p2ms = require('../multisig/')
const p2pk = require('../pubkey/')
const p2pkh = require('../pubkeyhash/')

function check (chunks, allowIncomplete) {
  typeforce(types.Array, chunks)
  if (chunks.length < 1) return false

  const witnessScript = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(witnessScript)) return false

  const witnessScriptChunks = bscript.decompile(witnessScript)

  // is witnessScript a valid script?
  if (!witnessScriptChunks || witnessScriptChunks.length === 0) return false

  const witnessRawScriptSig = bscript.compile(chunks.slice(0, -1))

  // match types
  if (p2pkh.input.check(witnessRawScriptSig) &&
    p2pkh.output.check(witnessScriptChunks)) return true

  if (p2ms.input.check(witnessRawScriptSig, allowIncomplete) &&
    p2ms.output.check(witnessScriptChunks)) return true

  if (p2pk.input.check(witnessRawScriptSig) &&
    p2pk.output.check(witnessScriptChunks)) return true

  return false
}
check.toJSON = function () { return 'witnessScriptHash input' }

module.exports = { check }
