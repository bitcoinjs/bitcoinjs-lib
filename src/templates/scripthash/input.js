// <scriptSig> {serialized scriptPubKey script}

const Buffer = require('safe-buffer').Buffer
const bscript = require('../../script')

const p2ms = require('../multisig/')
const p2pk = require('../pubkey/')
const p2pkh = require('../pubkeyhash/')
const p2wpkho = require('../witnesspubkeyhash/output')
const p2wsho = require('../witnessscripthash/output')

function check (script, allowIncomplete) {
  const chunks = bscript.decompile(script)
  if (chunks.length < 1) return false

  const lastChunk = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  const scriptSigChunks = bscript.decompile(bscript.compile(chunks.slice(0, -1)))
  const redeemScriptChunks = bscript.decompile(lastChunk)

  // is redeemScript a valid script?
  if (!redeemScriptChunks) return false

  // is redeemScriptSig push only?
  if (!bscript.isPushOnly(scriptSigChunks)) return false

  // is witness?
  if (chunks.length === 1) {
    return p2wsho.check(redeemScriptChunks) ||
      p2wpkho.check(redeemScriptChunks)
  }

  // match types
  if (p2pkh.input.check(scriptSigChunks) &&
    p2pkh.output.check(redeemScriptChunks)) return true

  if (p2ms.input.check(scriptSigChunks, allowIncomplete) &&
    p2ms.output.check(redeemScriptChunks)) return true

  if (p2pk.input.check(scriptSigChunks) &&
    p2pk.output.check(redeemScriptChunks)) return true

  return false
}
check.toJSON = function () { return 'scriptHash input' }

module.exports = { check }
