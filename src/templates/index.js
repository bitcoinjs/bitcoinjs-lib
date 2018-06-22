var decompile = require('../script').decompile
var multisig = require('./multisig')
var nullData = require('./nulldata')
var pubKey = require('./pubkey')
var pubKeyHash = require('./pubkeyhash')
var scriptHash = require('./scripthash')
var witnessPubKeyHash = require('./witnesspubkeyhash')
var witnessScriptHash = require('./witnessscripthash')
var witnessCommitment = require('./witnesscommitment')

var types = {
  MULTISIG: 'multisig',
  NONSTANDARD: 'nonstandard',
  NULLDATA: 'nulldata',
  P2PK: 'pubkey',
  P2PKH: 'pubkeyhash',
  P2SH: 'scripthash',
  P2WPKH: 'witnesspubkeyhash',
  P2WSH: 'witnessscripthash',
  WITNESS_COMMITMENT: 'witnesscommitment'
}

function classifyOutput (script) {
  if (witnessPubKeyHash.output.check(script)) return types.P2WPKH
  if (witnessScriptHash.output.check(script)) return types.P2WSH
  if (pubKeyHash.output.check(script)) return types.P2PKH
  if (scriptHash.output.check(script)) return types.P2SH

  // XXX: optimization, below functions .decompile before use
  var chunks = decompile(script)
  if (!chunks) throw new TypeError('Invalid script')

  if (multisig.output.check(chunks)) return types.MULTISIG
  if (pubKey.output.check(chunks)) return types.P2PK
  if (witnessCommitment.output.check(chunks)) return types.WITNESS_COMMITMENT
  if (nullData.output.check(chunks)) return types.NULLDATA

  return types.NONSTANDARD
}

function classifyInput (script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  var chunks = decompile(script)
  if (!chunks) throw new TypeError('Invalid script')

  if (pubKeyHash.input.check(chunks)) return types.P2PKH
  if (scriptHash.input.check(chunks, allowIncomplete)) return types.P2SH
  if (multisig.input.check(chunks, allowIncomplete)) return types.MULTISIG
  if (pubKey.input.check(chunks)) return types.P2PK

  return types.NONSTANDARD
}

function classifyWitness (script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  var chunks = decompile(script)
  if (!chunks) throw new TypeError('Invalid script')

  if (witnessPubKeyHash.input.check(chunks)) return types.P2WPKH
  if (witnessScriptHash.input.check(chunks, allowIncomplete)) return types.P2WSH

  return types.NONSTANDARD
}

function solveOutput (scriptCode) {
  if (!(scriptCode instanceof Buffer)) {
    throw new Error('Argument 0 for solveScript must be a Buffer')
  }

  var outputType = classifyOutput(scriptCode)
  var solvedBy = null
  var requiredSigs = null

  switch (outputType) {
    // We can only determine the relevant hash from these, not if it's signable
    case types.P2SH:
      solvedBy = scriptHash.output.decode(scriptCode)
      break
    case types.P2WSH:
      solvedBy = witnessScriptHash.output.decode(scriptCode)
      break

    // P2WPKH is separate from other signable types, it's best viewed as a special case for P2PKH
    // Not included in canSign.
    case types.P2WPKH:
      solvedBy = witnessPubKeyHash.output.decode(scriptCode)
      requiredSigs = 1
      break

    // We can immediately solve signatures for these
    // When adding a new script type, edit here
    case types.P2PK:
      solvedBy = pubKey.output.decode(scriptCode)
      requiredSigs = 1
      break
    case types.P2PKH:
      solvedBy = pubKeyHash.output.decode(scriptCode)
      requiredSigs = 1
      break
    case types.MULTISIG:
      solvedBy = multisig.output.decode(scriptCode)
      requiredSigs = solvedBy.m
      break
  }

  return {
    type: outputType,
    script: scriptCode,
    solvedBy: solvedBy,
    requiredSigs: requiredSigs
  }
}

module.exports = {
  classifyInput: classifyInput,
  classifyOutput: classifyOutput,
  classifyWitness: classifyWitness,
  solveOutput: solveOutput,
  multisig: multisig,
  nullData: nullData,
  pubKey: pubKey,
  pubKeyHash: pubKeyHash,
  scriptHash: scriptHash,
  witnessPubKeyHash: witnessPubKeyHash,
  witnessScriptHash: witnessScriptHash,
  witnessCommitment: witnessCommitment,
  types: types
}
