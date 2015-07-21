var base58check = require('bs58check')
var typeForce = require('typeforce')
var networks = require('./networks')
var scripts = require('./scripts')

function findScriptTypeByVersion (version) {
  for (var networkName in networks) {
    var network = networks[networkName]

    if (version === network.pubKeyHash) return 'pubkeyhash'
    if (version === network.scriptHash) return 'scripthash'
  }
}

function fromBase58Check (string) {
  var payload = base58check.decode(string)
  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  if (hash.length !== 20) throw new TypeError('Invalid hash length')
  if (version & ~0xff) throw new TypeError('Invalid version byte')

  return { hash: hash, version: version }
}

function fromOutputScript (script, network) {
  network = network || networks.bitcoin

  if (scripts.isPubKeyHashOutput(script)) return toBase58Check(script.chunks[2], network.pubKeyHash)
  if (scripts.isScriptHashOutput(script)) return toBase58Check(script.chunks[1], network.scriptHash)

  throw new Error(script.toASM() + ' has no matching Address')
}

function toBase58Check (hash, version) {
  typeForce('Buffer', hash)

  if (hash.length !== 20) throw new TypeError('Invalid hash length')
  if (version & ~0xff) throw new TypeError('Invalid version byte')

  var payload = new Buffer(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return base58check.encode(payload)
}

function toOutputScript (address) {
  var decode = fromBase58Check(address)
  var scriptType = findScriptTypeByVersion(decode.version)

  if (scriptType === 'pubkeyhash') return scripts.pubKeyHashOutput(decode.hash)
  if (scriptType === 'scripthash') return scripts.scriptHashOutput(decode.hash)

  throw new Error(address + ' has no matching Script')
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toOutputScript: toOutputScript
}
