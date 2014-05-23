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
  assert(D.compareTo(BigInteger.ZERO) > 0, 'Private key must be greater than 0')
  assert(D.compareTo(ecparams.getN()) < 0, 'Private key must be less than the curve order')

  var Q = ecparams.getG().multiply(D)

  this.D = D
  this.pub = new ECPubKey(Q, compressed)
}

// Static constructors
ECKey.fromWIF = function(string) {
  var decode = base58check.decode(string)
  var payload = decode.payload
  var compressed = false

  if (payload.length === 33) {
    assert.strictEqual(payload[32], 0x01, 'Invalid WIF string')

    payload = payload.slice(0, -1)
    compressed = true
  }

  assert.equal(payload.length, 32, 'Invalid WIF payload length')

  var D = BigInteger.fromBuffer(payload.slice(0, 32))
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

  var buffer = this.D.toBuffer(32)
  if (this.pub.compressed) {
    buffer = Buffer.concat([buffer, new Buffer([0x01])])
  }

  return base58check.encode(buffer, version)
}

// Operations
ECKey.prototype.sign = function(hash) {
  return ecdsa.sign(ecparams, hash, this.D)
}

module.exports = ECKey
