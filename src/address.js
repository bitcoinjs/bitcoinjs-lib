var assert = require('assert')
var base58check = require('./base58check')
var crypto = require('./crypto')
var network = require('./network')

function Address(hash, version) {
  assert(Buffer.isBuffer(hash))
  assert(hash.length === 20)
  assert(typeof version === 'number')

  this.hash = hash
  this.version = version
}

// Static constructors
Address.fromBase58Check = function(string) {
  var decode = base58check.decode(string)

  return new Address(decode.payload, decode.version)
}

Address.fromPubKey = function(pubKey, version) {
  version = version || network.bitcoin.pubKeyHash

  var hash = crypto.hash160(pubKey.toBuffer())
  return new Address(hash, version)
}

// Export functions
Address.prototype.toBase58Check = function () {
  return base58check.encode(this.hash, this.version)
}
Address.prototype.toString = Address.prototype.toBase58Check

module.exports = Address
