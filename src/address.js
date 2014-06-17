var assert = require('assert')
var base58check = require('./base58check')
var networks = require('./networks')
var scripts = require('./scripts')

function findScriptTypeByVersion(version) {
  for (var networkName in networks) {
    var network = networks[networkName]

    if (version === network.pubKeyHash) return 'pubkeyhash'
    if (version === network.scriptHash) return 'scripthash'
  }
}

function Address(hash, version) {
  assert(Buffer.isBuffer(hash), 'Expected Buffer, got ' + hash)
  assert.strictEqual(hash.length, 20, 'Invalid hash length')
  assert.strictEqual(version & 0xff, version, 'Invalid version byte')

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

Address.fromOutputScript = function(script, network) {
  network = network || networks.bitcoin

  var type = scripts.classifyOutput(script)

  if (type === 'pubkeyhash') return new Address(script.chunks[2], network.pubKeyHash)
  if (type === 'scripthash') return new Address(script.chunks[1], network.scriptHash)

  assert(false, type + ' has no matching Address')
}

// Export functions
Address.prototype.toBase58Check = function () {
  var payload = new Buffer(21)
  payload.writeUInt8(this.version, 0)
  this.hash.copy(payload, 1)

  return base58check.encode(payload)
}

Address.prototype.toOutputScript = function() {
  var scriptType = findScriptTypeByVersion(this.version)

  if (scriptType === 'pubkeyhash') return scripts.pubKeyHashOutput(this.hash)
  if (scriptType === 'scripthash') return scripts.scriptHashOutput(this.hash)

  assert(false, this.toString() + ' has no matching Script')
}

Address.prototype.toString = Address.prototype.toBase58Check

module.exports = Address
