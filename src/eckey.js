var assert = require('assert')
var base58check = require('./base58check')
var ecdsa = require('./ecdsa')
var network = require('./network')
var secureRandom = require('secure-random')

var Address = require('./address')
var crypto = require('./crypto')

var sec = require('./sec')
var ecparams = sec('secp256k1')

var BigInteger = require('bigi')
var ECPointFp = require('./ec').ECPointFp

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
  version = version || network.bitcoin.wif

  var buffer = this.toBuffer()
  if (this.pub.compressed) {
    buffer = Buffer.concat([buffer, new Buffer([0x01])])
  }

  return base58check.encode(buffer, version)
}

//////////////////////////////////////////////////////

function ECPubKey(Q, compressed) {
  assert(Q instanceof ECPointFp, 'Q must be an ECPointFP')

  if (compressed == undefined) compressed = true
  assert.strictEqual(typeof compressed, 'boolean', 'Invalid compression flag')

  this.compressed = compressed
  this.Q = Q
}

// Static constructors
ECPubKey.fromBuffer = function(buffer) {
  var type = buffer.readUInt8(0)
  assert(type >= 0x02 || type <= 0x04, 'Invalid public key')

  var compressed = (type !== 0x04)
  assert.strictEqual(buffer.length, compressed ? 33 : 65, 'Invalid public key')

  var Q = ECPointFp.decodeFrom(ecparams.getCurve(), buffer)
  return new ECPubKey(Q, compressed)
}
ECPubKey.fromHex = function(hex) {
  return ECPubKey.fromBuffer(new Buffer(hex, 'hex'))
}

// Operations
ECPubKey.prototype.verify = function(hash, sig) {
  return ecdsa.verify(hash, sig, this.Q)
}

ECPubKey.prototype.getAddress = function(version) {
  version = version || network.bitcoin.pubKeyHash

  return new Address(crypto.hash160(this.toBuffer()), version)
}

// Export functions
ECPubKey.prototype.toBuffer = function() {
  return new Buffer(this.Q.getEncoded(this.compressed))
}
ECPubKey.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

module.exports = {
  ECKey: ECKey,
  ECPubKey: ECPubKey
}
