var assert = require('assert')
var bs58check = require('bs58check')
var networks = require('./networks')
var scripts = require('./scripts')

function fromOutputScript(script, network) {
  var payload = new Buffer(21)
  var hash, version

  if (scripts.isPubKeyHashOutput(script)) {
    version = network.pubKeyHash
    hash = script.chunks[2]

  } else if (scripts.isScriptHashOutput(script)) {
    version = network.scriptHash
    hash = script.chunks[1]

  } else {
    assert(false, script.toASM() + ' has no matching Address')
  }

  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return bs58check.encode(payload)
}

// FIXME: remove network search
function toOutputScript(address) {
  var payload = bs58check.decode(address)
  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  for (var networkStr in networks) {
    var network = networks[networkStr]

    if (version === network.pubKeyHash) {
      return scripts.pubKeyHashOutput(hash)

    } else if (version === network.scriptHash) {
      return scripts.scriptHashOutput(hash)
    }
  }

  assert(false, address + ' has no matching Script')
}

function validate(address, network) {
  if (typeof network === 'string') network = networks[network]

  try { var payload = bs58check.decode(address)
    assert.equal(payload.length, 21)

    var version = payload.readUInt8(0)

    assert(version === network.pubKeyHash || version === network.scriptHash)

  } catch (e) {
    throw new Error(address + ' is not a valid ' + network + ' address')
  }
}

module.exports = {
  fromOutputScript: fromOutputScript,
  toOutputScript: toOutputScript,
  validate: validate
}
