var assert = require('assert')
var base58check = require('bs58check')
var networks = require('./networks')
var scripts = require('./scripts')

function fromOutputScript(script, network) {
  network = network || networks.bitcoin

  var type = scripts.classifyOutput(script)
  var version
  var hash

  if (type === 'pubkeyhash') {
    version = network.pubKeyHash
    hash = script.chunks[2]

  } else if (type === 'scripthash') {
    version = network.scriptHash
    hash = script.chunks[1]

  } else {
    assert(false, type + ' has no matching Address')
  }

  var payload = new Buffer(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return base58check.encode(payload)
}

function toOutputScript(address) {
  var payload = base58check.decode(address)
  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  for (var networkName in networks) {
    var network = networks[networkName]

    if (version === network.pubKeyHash) {
      return scripts.pubKeyHashOutput(hash)

    } else if (version === network.scriptHash) {
      return scripts.scriptHashOutput(hash)
    }
  }

  assert(false, address + ' has no matching Script')
}

module.exports = {
  fromOutputScript: fromOutputScript,
  toOutputScript: toOutputScript
}
