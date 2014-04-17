var assert = require('assert')
var base58check = require('./base58check')
var ecdsa = require('./ecdsa')
var network = require('./network')
var secureRandom = require('secure-random')

var Address = require('./address')
var crypto = require('./crypto')

var sec = require('./jsbn/sec')
var ecparams = sec("secp256k1")

var BigInteger = require('./jsbn/jsbn')
var ECPointFp = require('./jsbn/ec').ECPointFp

function ECKey(D, compressed) {
  assert(D instanceof BigInteger)
  assert(D.compareTo(BigInteger.ZERO) > 0)
  assert(D.compareTo(ecparams.getN()) < 0)

  var Q = ecparams.getG().multiply(D)

  this.D = D
  this.pub = new ECPubKey(Q, compressed)
}

// Static constructors
ECKey.fromBuffer = function(buffer, compressed) {
  assert(Buffer.isBuffer(buffer))
  var D = BigInteger.fromByteArrayUnsigned(buffer)

  return new ECKey(D, compressed)
}
ECKey.fromHex = function(hex, compressed) {
  return ECKey.fromBuffer(new Buffer(hex, 'hex'), compressed)
}

ECKey.fromWIF = function(string) {
  var decode = base58check.decode(string)

  var payload = decode.payload
  if (payload.length === 33) {
    assert(payload[32] === 0x01)

    return ECKey.fromBuffer(payload.slice(0, 32), true)
  }

  assert(payload.length === 32)
  return ECKey.fromBuffer(payload, false)
}

ECKey.makeRandom = function(compressed, rng) {
  rng = rng || secureRandom

  var buffer = new Buffer(rng(32))
  var D = BigInteger.fromByteArrayUnsigned(buffer)
  D = D.mod(ecparams.getN())

  return new ECKey(D, compressed)
}

// Operations
ECKey.prototype.sign = function(hash) {
  return ecdsa.sign(hash, this.D)
}

// Export functions
ECKey.prototype.toBuffer = function() {
  var buffer = new Buffer(this.D.toByteArrayUnsigned())

  // pad out the zero bytes
  if (buffer.length < 32) {
    var padded = new Buffer(32)

    padded.fill(0)
    buffer.copy(padded, 32 - buffer.length)

    return padded
  }

  assert(buffer.length === 32)

  return buffer
}
ECKey.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

ECKey.prototype.toWIF = function(version) {
  version = version || network.bitcoin.wif

  var buffer
  if (this.pub.compressed) {
    buffer = Buffer.concat([this.toBuffer(), new Buffer([0x01])])
  } else {
    buffer = this.toBuffer()
  }

  return base58check.encode(buffer, version)
}

//////////////////////////////////////////////////////

function ECPubKey(Q, compressed) {
  if (compressed == undefined) compressed = true
  assert(typeof compressed === 'boolean')
  assert(Q instanceof ECPointFp)

  this.compressed = compressed
  this.Q = Q
}

// Static constructors
ECPubKey.fromBuffer = function(buffer) {
  assert(Buffer.isBuffer(buffer))

  var Q = ECPointFp.decodeFrom(ecparams.getCurve(), buffer)

  var type = buffer.readUInt8(0)
  assert(type >= 0x02 || type <= 0x04)

  var compressed = (type !== 0x04)
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
  return new Address(crypto.hash160(this.toBuffer()), version)
}

// Export functions
ECPubKey.prototype.toBuffer = function() {
  var buffer = new Buffer(this.Q.getEncoded(this.compressed))
  assert(buffer.length === (this.compressed ? 33 : 65))

  return buffer
}
ECPubKey.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

module.exports = {
  ECKey: ECKey,
  ECPubKey: ECPubKey
}
