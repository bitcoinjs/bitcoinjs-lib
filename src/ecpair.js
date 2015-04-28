var assert = require('assert')
var base58check = require('bs58check')
var bcrypto = require('./crypto')
var ecdsa = require('./ecdsa')
var ecurve = require('ecurve')
var networks = require('./networks')
var randomBytes = require('randombytes')
var typeForce = require('typeforce')

var Address = require('./address')
var BigInteger = require('bigi')

function findNetworkByWIFVersion (version) {
  for (var networkName in networks) {
    var network = networks[networkName]

    if (network.wif === version) return network
  }

  assert(false, 'Unknown network')
}

function ECPair (d, Q, options) {
  options = options || {}

  var compressed = options.compressed === undefined ? true : options.compressed
  var network = options.network === undefined ? networks.bitcoin : options.network

  typeForce('Boolean', compressed)
  assert('pubKeyHash' in network, 'Unknown pubKeyHash constants for network')

  if (d) {
    assert(d.signum() > 0, 'Private key must be greater than 0')
    assert(d.compareTo(ECPair.curve.n) < 0, 'Private key must be less than the curve order')

    assert(!Q, 'Unexpected publicKey parameter')
    this.d = d

  // enforce Q is a public key if no private key given
  } else {
    typeForce('Point', Q)
    this.__Q = Q
  }

  this.compressed = compressed
  this.network = network
}

Object.defineProperty(ECPair.prototype, 'Q', {
  get: function () {
    if (!this.__Q && this.d) {
      this.__Q = ECPair.curve.G.multiply(this.d)
    }

    return this.__Q
  }
})

// Public access to secp256k1 curve
ECPair.curve = ecurve.getCurveByName('secp256k1')

ECPair.fromPublicKeyBuffer = function (buffer, network) {
  var Q = ecurve.Point.decodeFrom(ECPair.curve, buffer)

  return new ECPair(null, Q, {
    compressed: Q.compressed,
    network: network
  })
}

ECPair.fromWIF = function (string) {
  var payload = base58check.decode(string)
  var version = payload.readUInt8(0)
  var compressed

  if (payload.length === 34) {
    assert.strictEqual(payload[33], 0x01, 'Invalid compression flag')

    // truncate the version/compression bytes
    payload = payload.slice(1, -1)
    compressed = true

  // no compression flag
  } else {
    assert.equal(payload.length, 33, 'Invalid WIF payload length')

    // Truncate the version byte
    payload = payload.slice(1)
    compressed = false
  }

  var network = findNetworkByWIFVersion(version)
  var d = BigInteger.fromBuffer(payload)

  return new ECPair(d, null, {
    compressed: compressed,
    network: network
  })
}

ECPair.makeRandom = function (options) {
  options = options || {}

  var rng = options.rng || randomBytes
  var buffer = rng(32)
  typeForce('Buffer', buffer)
  assert.equal(buffer.length, 32, 'Expected 256-bit Buffer from RNG')

  var d = BigInteger.fromBuffer(buffer)
  d = d.mod(ECPair.curve.n)

  return new ECPair(d, null, options)
}

ECPair.prototype.toWIF = function () {
  assert(this.d, 'Missing private key')

  var bufferLen = this.compressed ? 34 : 33
  var buffer = new Buffer(bufferLen)

  buffer.writeUInt8(this.network.wif, 0)
  this.d.toBuffer(32).copy(buffer, 1)

  if (this.compressed) {
    buffer.writeUInt8(0x01, 33)
  }

  return base58check.encode(buffer)
}

ECPair.prototype.getAddress = function () {
  var pubKey = this.getPublicKeyBuffer()

  return new Address(bcrypto.hash160(pubKey), this.network.pubKeyHash)
}

ECPair.prototype.getPublicKeyBuffer = function () {
  return this.Q.getEncoded(this.compressed)
}

ECPair.prototype.sign = function (hash) {
  assert(this.d, 'Missing private key')

  return ecdsa.sign(ECPair.curve, hash, this.d)
}

ECPair.prototype.verify = function (hash, signature) {
  return ecdsa.verify(ECPair.curve, hash, signature, this.Q)
}

module.exports = ECPair
