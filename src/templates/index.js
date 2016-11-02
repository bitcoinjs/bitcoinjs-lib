var decompile = require('../script').decompile
var multisig = require('./multisig')
var nullData = require('./nulldata')
var pubKey = require('./pubkey')
var pubKeyHash = require('./pubkeyhash')
var scriptHash = require('./scripthash')
var witnessPubKeyHash = require('./witnesspubkeyhash')
var witnessScriptHash = require('./witnessscripthash')

function classifyOutput (script) {
  if (witnessPubKeyHash.output.check(script)) return 'witnesspubkeyhash'
  if (witnessScriptHash.output.check(script)) return 'witnessscripthash'
  if (pubKeyHash.output.check(script)) return 'pubkeyhash'
  if (scriptHash.output.check(script)) return 'scripthash'

  // XXX: optimization, below functions .decompile before use
  var chunks = decompile(script)
  if (multisig.output.check(chunks)) return 'multisig'
  if (pubKey.output.check(chunks)) return 'pubkey'
  if (nullData.output.check(chunks)) return 'nulldata'

  return 'nonstandard'
}

function classifyInput (script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  var chunks = decompile(script)

  if (pubKeyHash.input.check(chunks)) return 'pubkeyhash'
  if (scriptHash.input.check(chunks, allowIncomplete)) return 'scripthash'
  if (multisig.input.check(chunks, allowIncomplete)) return 'multisig'
  if (pubKey.input.check(chunks)) return 'pubkey'

  return 'nonstandard'
}

function classifyWitness (script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  var chunks = decompile(script)

  if (pubKeyHash.input.check(chunks)) return 'witnesspubkeyhash'
  if (scriptHash.input.check(chunks)) return 'witnessscripthash'
  return 'nonstandard'
}

module.exports = {
  classifyInput: classifyInput,
  classifyOutput: classifyOutput,
  classifyWitness: classifyWitness,
  multisig: multisig,
  nullData: nullData,
  pubKey: pubKey,
  pubKeyHash: pubKeyHash,
  scriptHash: scriptHash,
  witnessPubKeyHash: witnessPubKeyHash,
  witnessScriptHash: witnessScriptHash
}
