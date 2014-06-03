var assert = require('assert')
var base58check = require('./base58check')
var ecdsa = require('./ecdsa')
var networks = require('./networks')
var secureRandom = require('secure-random')

var BigInteger = require('bigi')
var ECPubKey = require('./ecpubkey')

var sec = require('./sec')
var ecparams = sec('secp256k1')

function ECKey(D, compressed) {
  assert(D.signum() > 0, 'Private key must be greater than 0')
  assert(D.compareTo(ecparams.getN()) < 0, 'Private key must be less than the curve order')

  var Q = ecparams.getG().multiply(D)

  this.D = D
  this.pub = new ECPubKey(Q, compressed)
}

// Static constructors
ECKey.fromWIF = function(string) {
  var payload = base58check.decode(string)
  var compressed = false

  // Ignore the version byte
  payload = payload.slice(1)

  if (payload.length === 33) {
    assert.strictEqual(payload[32], 0x01, 'Invalid compression flag')

    // Truncate the compression flag
    payload = payload.slice(0, -1)
    compressed = true
  }

  assert.equal(payload.length, 32, 'Invalid WIF payload length')

  var D = BigInteger.fromBuffer(payload)
  return new ECKey(D, compressed)
}

ECKey.makeRandom = function(compressed, rng) {
  rng = rng || secureRandom

  var buffer = new Buffer(rng(32))
  var D = BigInteger.fromBuffer(buffer)
  D = D.mod(ecparams.getN())

  return new ECKey(D, compressed)
}

// Export functions
ECKey.prototype.toWIF = function(version) {
  version = version || networks.bitcoin.wif

  var bufferLen = this.pub.compressed ? 34 : 33
  var buffer = new Buffer(bufferLen)

  buffer.writeUInt8(version, 0)
  this.D.toBuffer(32).copy(buffer, 1)

  if (this.pub.compressed) {
    buffer.writeUInt8(0x01, 33)
  }

  return base58check.encode(buffer)
}

// Operations
ECKey.prototype.sign = function(hash) {
  return ecdsa.sign(ecparams, hash, this.D)
}

module.exports = ECKey
