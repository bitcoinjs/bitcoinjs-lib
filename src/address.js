var assert = require('assert')
var base58check = require('./base58check')
var networks = require('./networks')

function findScriptTypeByVersion(queryVersion) {
  for (var networkName in networks) {
    var network = networks[networkName]

    for (var versionName in network) {
      var version = network[versionName]

      if (version === queryVersion) {
        return versionName
      }
    }
  }
}

function Address(hash, version) {
  assert(Buffer.isBuffer(hash), 'First argument must be a Buffer')
  assert.strictEqual(hash.length, 20, 'Invalid hash length')
  assert.strictEqual(version & 0xFF, version, 'Invalid version byte')

  this.hash = hash
  this.version = version
}

Address.Error = function(message) {
  this.name = 'AddressError'
  this.message = message
}
Address.Error.prototype = new Error()
Address.Error.prototype.constructor = Address.Error

// Import functions
Address.fromBase58Check = function(string) {
  var decode = base58check.decode(string)

  return new Address(decode.payload, decode.version)
}

Address.fromScriptPubKey = function(script, network) {
  network = network || networks.bitcoin

  var type = script.getOutType()

  // Pay-to-pubKeyHash
  if (type === 'pubkeyhash') {
    return new Address(new Buffer(script.chunks[2]), network.pubKeyHash)
  }

  // Pay-to-scriptHash
  else if (type === 'scripthash') {
    return new Address(new Buffer(script.chunks[1]), network.scriptHash)
  }

  throw new Address.Error(type + ' has no matching Address')
}

// Export functions
Address.prototype.toBase58Check = function () {
  return base58check.encode(this.hash, this.version)
}

Address.prototype.toScriptPubKey = function() {
  var scriptType = findScriptTypeByVersion(this.version)

  // Pay-to-pubKeyHash
  if (scriptType === 'pubKeyHash') {
    return Script.createPubKeyHashScriptPubKey(this.hash)
  }

  // Pay-to-scriptHash
  else if (scriptType === 'scriptHash') {
    return Script.createP2SHScriptPubKey(this.hash)
  }

  throw new Address.Error(this + ' has no matching script')
}

Address.prototype.toString = Address.prototype.toBase58Check

module.exports = Address

// http://stackoverflow.com/a/14098262
var Script = require('./script')
