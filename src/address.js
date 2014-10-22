var assert = require('assert')
var base58check = require('bs58check')
var networks = require('./networks')
var scripts = require('./scripts')

function encode(version, hash) {
  var payload = new Buffer(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return base58check.encode(payload)
}

function decode(address) {
  var payload = base58check.decode(address)
  var version = payload.readUInt8(0)
  var network

  for (var networkName in networks) {
    var network2 = networks[networkName]

    if (version === network2.pubKeyHash || version === network2.scriptHash) {
      network = network2
      break
    }
  }

  return {
    hash: payload.slice(1),
    network: network,
    version: version
  }
}

function fromOutputScript(script, network) {
  network = network || networks.bitcoin

  var type = scripts.classifyOutput(script)

  switch (type) {
    case 'pubkeyhash':
      return encode(network.pubKeyHash, script.chunks[2])

    case 'scripthash':
      return encode(network.scriptHash, script.chunks[1])
  }

  assert(false, type + ' has no matching Address')
}

function toOutputScript(address) {
  var decoded = decode(address)
  var network = decoded.network || {}

  switch (decoded.version) {
    case network.pubKeyHash:
      return scripts.pubKeyHashOutput(decoded.hash)

    case network.scriptHash:
      return scripts.scriptHashOutput(decoded.hash)
  }

  assert(false, address + ' has no matching Script')
}

module.exports = {
  decode: decode,
  encode: encode,
  fromOutputScript: fromOutputScript,
  toOutputScript: toOutputScript
}
