var assert = require('assert')
var crypto = require('./crypto')
var ecdsa = require('./ecdsa')
var networks = require('./networks')

var Address = require('./address')
var ECPointFp = require('./ec').ECPointFp

var sec = require('./sec')
var ecparams = sec('secp256k1')

function ECPubKey(Q, compressed) {
  assert(Q instanceof ECPointFp, 'Q must be an ECPointFP')

  if (compressed == undefined) compressed = true
  assert.strictEqual(typeof compressed, 'boolean', 'Invalid compression flag')

  this.compressed = compressed
  this.Q = Q
}

// Static constructors
ECPubKey.fromBuffer = function(buffer) {
  var decode = ECPointFp.decodeFrom(ecparams.getCurve(), buffer)
  return new ECPubKey(decode.Q, decode.compressed)
}

ECPubKey.fromHex = function(hex) {
  return ECPubKey.fromBuffer(new Buffer(hex, 'hex'))
}

// Operations
ECPubKey.prototype.getAddress = function(version) {
  version = version || networks.bitcoin.pubKeyHash

  return new Address(crypto.hash160(this.toBuffer()), version)
}

ECPubKey.prototype.verify = function(hash, sig) {
  return ecdsa.verify(hash, sig, this.Q)
}

// Export functions
ECPubKey.prototype.toBuffer = function() {
  return this.Q.getEncoded(this.compressed)
}

ECPubKey.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

module.exports = ECPubKey
