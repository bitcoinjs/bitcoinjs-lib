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
ECKey.fromBuffer = function(buffer, compressed) {
  assert(Buffer.isBuffer(buffer), 'First argument must be a Buffer')
  assert.strictEqual(buffer.length, 32, 'Invalid buffer length')

  var D = BigInteger.fromBuffer(buffer)
  return new ECKey(D, compressed)
}

ECKey.fromHex = function(hex, compressed) {
  return ECKey.fromBuffer(new Buffer(hex, 'hex'), compressed)
}

ECKey.fromWIF = function(string) {
  var decode = base58check.decode(string)

  var payload = decode.payload
  if (payload.length === 33) {
    assert.strictEqual(payload[32], 0x01, 'Invalid WIF string')

    return ECKey.fromBuffer(payload.slice(0, 32), true)
  }

  return ECKey.fromBuffer(payload, false)
}

ECKey.makeRandom = function(compressed, rng) {
  rng = rng || secureRandom

  var buffer = new Buffer(rng(32))
  var D = BigInteger.fromBuffer(buffer)
  D = D.mod(ecparams.getN())

  return new ECKey(D, compressed)
}

// Operations
ECKey.prototype.sign = function(hash) {
  return ecdsa.sign(hash, this.D)
}

// Export functions
ECKey.prototype.toBuffer = function() {
  return this.D.toBuffer(32)
}

ECKey.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

ECKey.prototype.toWIF = function(version) {
  version = version || networks.bitcoin.wif

  var buffer = this.toBuffer()
  if (this.pub.compressed) {
    buffer = Buffer.concat([buffer, new Buffer([0x01])])
  }

  return base58check.encode(buffer, version)
}

module.exports = ECKey
