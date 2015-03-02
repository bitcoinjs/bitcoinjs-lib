var assert = require('assert')
var base58check = require('bs58check')
var crypto = require('crypto')
var typeForce = require('typeforce')
var networks = require('./networks')

var BigInteger = require('bigi')
var ECPubKey = require('./ecpubkey')
var ECSignature = require('./ecsignature')

var ecurve = require('ecurve')
var ecdsa = require('./ecdsa')

try {
  var secp256k1 = require('secp256k1')
} catch (e) {
  secp256k1 = null
}

function ECKey (d, compressed) {
  assert(d.signum() > 0, 'Private key must be greater than 0')
  assert(d.compareTo(ECKey.curve.n) < 0, 'Private key must be less than the curve order')

  var Q = ECKey.curve.G.multiply(d)

  this.d = d
  this.pub = new ECPubKey(Q, compressed)
}

// Constants
ECKey.curve = ecurve.getCurveByName('secp256k1')

// Static constructors
ECKey.fromWIF = function (string) {
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

  var d = BigInteger.fromBuffer(payload)
  return new ECKey(d, compressed)
}

ECKey.makeRandom = function (compressed, rng) {
  rng = rng || crypto.randomBytes

  var buffer = rng(32)
  typeForce('Buffer', buffer)
  assert.equal(buffer.length, 32, 'Expected 256-bit Buffer from RNG')

  var d = BigInteger.fromBuffer(buffer)
  d = d.mod(ECKey.curve.n)

  return new ECKey(d, compressed)
}

// Export functions
ECKey.prototype.toWIF = function (network) {
  network = network || networks.bitcoin

  var bufferLen = this.pub.compressed ? 34 : 33
  var buffer = new Buffer(bufferLen)

  buffer.writeUInt8(network.wif, 0)
  this.d.toBuffer(32).copy(buffer, 1)

  if (this.pub.compressed) {
    buffer.writeUInt8(0x01, 33)
  }

  return base58check.encode(buffer)
}

// Operations
ECKey.prototype.sign = function (hash) {
  if (secp256k1) {
    return ECSignature.fromDER(secp256k1.sign(this.d.toBuffer(32), hash))
  } else {
    return ecdsa.sign(ECKey.curve, hash, this.d)
  }
}

module.exports = ECKey
