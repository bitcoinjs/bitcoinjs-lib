var assert = require('assert')
var base58check = require('./base58check')
var networks = require('./networks')
var templates = require('./templates')

function findScriptTypeByVersion(queryVersion) {
  for (var networkName in networks) {
    var network = networks[networkName]

    for (var versionName in network) {
      var version = network[versionName]

      if (version === queryVersion) {
        return versionName.toLowerCase()
      }
    }
  }
}

function Address(hash, version) {
  assert(Buffer.isBuffer(hash), 'Expected Buffer, got ' + hash)
  assert.strictEqual(hash.length, 20, 'Invalid hash length')
  assert.strictEqual(version & 0xFF, version, 'Invalid version byte')

  this.hash = hash
  this.version = version
}

// Import functions
Address.fromBase58Check = function(string) {
  var payload = base58check.decode(string)
  var version = payload.readUInt8(0)
  var hash = payload.slice(1)

  return new Address(hash, version)
}

Address.fromScriptPubKey = function(script, network) {
  network = network || networks.bitcoin

  var type = templates.classifyScriptPubKey(script)

  if (type === 'pubkeyhash') {
    return new Address(script.chunks[2], network.pubKeyHash)

  } else if (type === 'scripthash') {
    return new Address(script.chunks[1], network.scriptHash)
  }

  assert(false, type + ' has no matching Address')
}

// Export functions
Address.prototype.toBase58Check = function () {
  var payload = new Buffer(21)
  payload.writeUInt8(this.version, 0)
  this.hash.copy(payload, 1)

  return base58check.encode(payload)
}

Address.prototype.toScriptPubKey = function() {
  var scriptType = findScriptTypeByVersion(this.version)

  if (scriptType === 'pubkeyhash') {
    return templates.createPubKeyHashScriptPubKey(this.hash)

  } else if (scriptType === 'scripthash') {
    return templates.createP2SHScriptPubKey(this.hash)
  }

  assert(false, this.toString() + ' has no matching Script')
}

Address.prototype.toString = Address.prototype.toBase58Check

module.exports = Address
