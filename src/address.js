var base58check = require('bs58check')
var networks = require('./networks')
var scripts = require('./scripts')
var typeforce = require('typeforce')
var types = require('./types')

function fromBase58Check (address) {
  var payload = base58check.decode(address)
  if (payload.length < 21) throw new TypeError(address + ' is too short')
  if (payload.length > 21) throw new TypeError(address + ' is too long')

  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  return { hash: hash, version: version }
}

function fromOutputScript (script, network) {
  network = network || networks.bitcoin

  var chunks = scripts.decompile(script)
  if (scripts.isPubKeyHashOutput(chunks)) return toBase58Check(chunks[2], network.pubKeyHash)
  if (scripts.isScriptHashOutput(chunks)) return toBase58Check(chunks[1], network.scriptHash)

  throw new Error(scripts.toASM(chunks) + ' has no matching Address')
}

function toBase58Check (hash, version) {
  typeforce(types.tuple(types.Hash160bit, types.UInt8), arguments)

  var payload = new Buffer(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return base58check.encode(payload)
}

function toOutputScript (address, network) {
  network = network || networks.bitcoin

  var payload = base58check.decode(address)
  if (payload.length < 21) throw new TypeError(address + ' is too short')
  if (payload.length > 21) throw new TypeError(address + ' is too long')

  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  if (version === network.pubKeyHash) return scripts.pubKeyHashOutput(hash)
  if (version === network.scriptHash) return scripts.scriptHashOutput(hash)

  throw new Error(address + ' has no matching Script')
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toOutputScript: toOutputScript
}
