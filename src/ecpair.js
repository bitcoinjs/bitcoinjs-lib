var bcrypto = require('./crypto')
var bs58check = require('bs58check')
var ecdsa = require('./ecdsa')
var ecurve = require('ecurve')
var randomBytes = require('randombytes')
var typeforce = require('typeforce')
var types = require('./types')

var NETWORKS = require('./networks')
var BigInteger = require('bigi')

var secp256k1 = ecurve.getCurveByName('secp256k1')

function ECPair (d, Q, options) {
  if (options) {
    typeforce({
      compressed: types.maybe(types.Boolean),
      network: types.maybe(types.Network)
    }, options)
  }

  options = options || {}

  if (d) {
    if (d.signum() <= 0) throw new Error('Private key must be greater than 0')
    if (d.compareTo(secp256k1.n) >= 0) throw new Error('Private key must be less than the curve order')
    if (Q) throw new TypeError('Unexpected publicKey parameter')

    this.d = d

  } else {
    typeforce(types.ECPoint, Q)

    this.__Q = Q
  }

  this.compressed = options.compressed === undefined ? true : options.compressed
  this.network = options.network || NETWORKS.bitcoin
}

Object.defineProperty(ECPair.prototype, 'Q', {
  get: function () {
    if (!this.__Q && this.d) {
      this.__Q = secp256k1.G.multiply(this.d)
    }

    return this.__Q
  }
})

ECPair.fromPublicKeyBuffer = function (buffer, network) {
  var Q = ecurve.Point.decodeFrom(secp256k1, buffer)

  return new ECPair(null, Q, {
    compressed: Q.compressed,
    network: network
  })
}

ECPair.fromWIF = function (string, networks) {
  var payload = bs58check.decode(string)
  var version = payload.readUInt8(0)
  var compressed

  if (payload.length === 34) {
    if (payload[33] !== 0x01) throw new Error('Invalid compression flag')

    // truncate the version/compression bytes
    payload = payload.slice(1, -1)
    compressed = true

  // no compression flag
  } else {
    if (payload.length !== 33) throw new Error('Invalid WIF payload length')

    // Truncate the version byte
    payload = payload.slice(1)
    compressed = false
  }

  var network

  // list of networks?
  if (Array.isArray(networks)) {
    network = networks.filter(function (network) {
      return version === network.wif
    }).pop() || {}

  // otherwise, assume a network object (or default to bitcoin)
  } else {
    network = networks || NETWORKS.bitcoin
  }

  if (version !== network.wif) throw new Error('Invalid network')

  var d = BigInteger.fromBuffer(payload)

  return new ECPair(d, null, {
    compressed: compressed,
    network: network
  })
}

ECPair.makeRandom = function (options) {
  options = options || {}

  var rng = options.rng || randomBytes

  var d
  do {
    var buffer = rng(32)
    typeforce(types.Buffer256bit, buffer)

    d = BigInteger.fromBuffer(buffer)
  } while (d.compareTo(secp256k1.n) >= 0)

  return new ECPair(d, null, options)
}

ECPair.prototype.toWIF = function () {
  if (!this.d) throw new Error('Missing private key')

  var bufferLen = this.compressed ? 34 : 33
  var buffer = new Buffer(bufferLen)

  buffer.writeUInt8(this.network.wif, 0)
  this.d.toBuffer(32).copy(buffer, 1)

  if (this.compressed) {
    buffer.writeUInt8(0x01, 33)
  }

  return bs58check.encode(buffer)
}

ECPair.prototype.getAddress = function () {
  var pubKey = this.getPublicKeyBuffer()
  var pubKeyHash = bcrypto.hash160(pubKey)

  var payload = new Buffer(21)
  payload.writeUInt8(this.network.pubKeyHash, 0)
  pubKeyHash.copy(payload, 1)

  return bs58check.encode(payload)
}

ECPair.prototype.getPublicKeyBuffer = function () {
  return this.Q.getEncoded(this.compressed)
}

ECPair.prototype.sign = function (hash) {
  if (!this.d) throw new Error('Missing private key')

  return ecdsa.sign(secp256k1, hash, this.d)
}

ECPair.prototype.verify = function (hash, signature) {
  return ecdsa.verify(secp256k1, hash, signature, this.Q)
}

module.exports = ECPair
