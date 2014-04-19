var assert = require('assert')
var base58check = require('./base58check')

function Address(hash, version) {
  assert(Buffer.isBuffer(hash), 'First argument must be a Buffer')
  assert.strictEqual(hash.length, 20, 'Invalid hash length')
  assert.strictEqual(version & 0xFF, version, 'Invalid version byte')

  this.hash = hash
  this.version = version
}

// Import functions
Address.fromBase58Check = function(string) {
  var decode = base58check.decode(string)

  return new Address(decode.payload, decode.version)
}
Address.prototype.fromString = Address.prototype.fromBase58Check

// Export functions
Address.prototype.toBase58Check = function () {
  return base58check.encode(this.hash, this.version)
}
Address.prototype.toString = Address.prototype.toBase58Check

module.exports = Address
