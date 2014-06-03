var assert = require('assert')
var base58 = require('./base58')

var BigInteger = require('bigi')
var crypto = require('./crypto')
var ECKey = require('./eckey')
var ECPubKey = require('./ecpubkey')
var ECPointFp = require('./ec').ECPointFp
var networks = require('./networks')

var sec = require('./sec')
var ecparams = sec("secp256k1")

function findBIP32ParamsByVersion(version) {
  for (var name in networks) {
    var network = networks[name]

    for (var type in network.bip32) {
      if (version != network.bip32[type]) continue

      return {
        isPrivate: (type === 'private'),
        network: network
      }
    }
  }

  assert(false, 'Could not find version ' + version.toString(16))
}

function HDWallet(K, chainCode, network) {
  network = network || networks.bitcoin

  assert(Buffer.isBuffer(chainCode), 'Expected Buffer, got ' + chainCode)
  assert(network.bip32, 'Unknown BIP32 constants for network')

  this.chainCode = chainCode
  this.depth = 0
  this.index = 0
  this.network = network

  if (K instanceof BigInteger) {
    this.priv = new ECKey(K, true)
    this.pub = this.priv.pub
  } else {
    this.pub = new ECPubKey(K, true)
  }
}

HDWallet.MASTER_SECRET = new Buffer('Bitcoin seed')
HDWallet.HIGHEST_BIT = 0x80000000
HDWallet.LENGTH = 78

HDWallet.fromSeedBuffer = function(seed, network) {
  var I = crypto.HmacSHA512(seed, HDWallet.MASTER_SECRET)
  var IL = I.slice(0, 32)
  var IR = I.slice(32)

  // In case IL is 0 or >= n, the master key is invalid
  // This is handled by `new ECKey` in the HDWallet constructor
  var pIL = BigInteger.fromBuffer(IL)

  return new HDWallet(pIL, IR, network)
}

HDWallet.fromSeedHex = function(hex, network) {
  return HDWallet.fromSeedBuffer(new Buffer(hex, 'hex'), network)
}

HDWallet.fromBase58 = function(string) {
  var buffer = base58.decode(string)

  var payload = buffer.slice(0, -4)
  var checksum = buffer.slice(-4)

  var newChecksum = crypto.hash256(payload).slice(0, 4)
  assert.deepEqual(newChecksum, checksum, 'Invalid checksum')

  return HDWallet.fromBuffer(payload)
}

HDWallet.fromBuffer = function(buffer) {
  assert.strictEqual(buffer.length, HDWallet.LENGTH, 'Invalid buffer length')

  // 4 byte: version bytes
  var version = buffer.readUInt32BE(0)
  var params = findBIP32ParamsByVersion(version)

  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ...
  var depth = buffer.readUInt8(4)

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  var parentFingerprint = buffer.readUInt32BE(5)
  if (depth === 0) {
    assert.strictEqual(parentFingerprint, 0x00000000, 'Invalid parent fingerprint')
  }

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in MSB order. (0x00000000 if master key)
  var index = buffer.readUInt32BE(9)
  assert(depth > 0 || index === 0, 'Invalid index')

  // 32 bytes: the chain code
  var chainCode = buffer.slice(13, 45)

  // 33 bytes: the public key or private key data (0x02 + X or 0x03 + X for
  // public keys, 0x00 + k for private keys)
  var data = buffer.slice(45, 78)

  var hd
  if (params.isPrivate) {
    assert.strictEqual(data.readUInt8(0), 0x00, 'Invalid private key')
    data = data.slice(1)

    var D = BigInteger.fromBuffer(data)
    hd = new HDWallet(D, chainCode, params.network)
  } else {

    var decode = ECPointFp.decodeFrom(ecparams.getCurve(), data)
    assert.equal(decode.compressed, true, 'Invalid public key')

    // When importing a serialized extended public key, implementations must verify whether the X coordinate in the public key data corresponds to a point on the curve. If not, the extended public key is invalid.
    decode.Q.validate()

    hd = new HDWallet(decode.Q, chainCode, params.network)
  }

  hd.depth = depth
  hd.index = index
  hd.parentFingerprint = parentFingerprint

  return hd
}

HDWallet.fromHex = function(hex, isPrivate) {
  return HDWallet.fromBuffer(new Buffer(hex, 'hex'))
}

HDWallet.prototype.getIdentifier = function() {
  return crypto.hash160(this.pub.toBuffer())
}

HDWallet.prototype.getFingerprint = function() {
  return this.getIdentifier().slice(0, 4)
}

HDWallet.prototype.getAddress = function() {
  return this.pub.getAddress(this.network.pubKeyHash)
}

HDWallet.prototype.toBase58 = function(isPrivate) {
  var buffer = this.toBuffer(isPrivate)
  var checksum = crypto.hash256(buffer).slice(0, 4)

  return base58.encode(Buffer.concat([
    buffer,
    checksum
  ]))
}

HDWallet.prototype.toBuffer = function(isPrivate) {
  if (isPrivate == undefined) isPrivate = !!this.priv

  // Version
  var version = isPrivate ? this.network.bip32.private : this.network.bip32.public
  var buffer = new Buffer(HDWallet.LENGTH)

  // 4 bytes: version bytes
  buffer.writeUInt32BE(version, 0)

  // Depth
  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ....
  buffer.writeUInt8(this.depth, 4)

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  var fingerprint = (this.depth === 0) ? 0x00000000 : this.parentFingerprint
  buffer.writeUInt32BE(fingerprint, 5)

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in Big endian. (0x00000000 if master key)
  buffer.writeUInt32BE(this.index, 9)

  // 32 bytes: the chain code
  this.chainCode.copy(buffer, 13)

  // 33 bytes: the public key or private key data
  if (isPrivate) {
    assert(this.priv, 'Missing private key')

    // 0x00 + k for private keys
    buffer.writeUInt8(0, 45)
    this.priv.D.toBuffer(32).copy(buffer, 46)
  } else {

    // X9.62 encoding for public keys
    this.pub.toBuffer().copy(buffer, 45)
  }

  return buffer
}

HDWallet.prototype.toHex = function(isPrivate) {
  return this.toBuffer(isPrivate).toString('hex')
}

// https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#child-key-derivation-ckd-functions
HDWallet.prototype.derive = function(index) {
  var isHardened = index >= HDWallet.HIGHEST_BIT
  var indexBuffer = new Buffer(4)
  indexBuffer.writeUInt32BE(index, 0)

  var data

  // Hardened child
  if (isHardened) {
    assert(this.priv, 'Could not derive hardened child key')

    // data = 0x00 || ser256(kpar) || ser32(index)
    data = Buffer.concat([
      this.priv.D.toBuffer(33),
      indexBuffer
    ])

  // Normal child
  } else {
    // data = serP(point(kpar)) || ser32(index)
    //      = serP(Kpar) || ser32(index)
    data = Buffer.concat([
      this.pub.toBuffer(),
      indexBuffer
    ])
  }

  var I = crypto.HmacSHA512(data, this.chainCode)
  var IL = I.slice(0, 32)
  var IR = I.slice(32)

  var pIL = BigInteger.fromBuffer(IL)

  // In case parse256(IL) >= n, proceed with the next value for i
  if (pIL.compareTo(ecparams.getN()) >= 0) {
    return this.derive(index + 1)
  }

  // Private parent key -> private child key
  if (this.priv) {
    // ki = parse256(IL) + kpar (mod n)
    var ki = pIL.add(this.priv.D).mod(ecparams.getN())

    // In case ki == 0, proceed with the next value for i
    if (ki.signum() === 0) {
      return this.derive(index + 1)
    }

    hd = new HDWallet(ki, IR, this.network)

  // Public parent key -> public child key
  } else {
    // Ki = point(parse256(IL)) + Kpar
    //    = G*IL + Kpar
    var Ki = ecparams.getG().multiply(pIL).add(this.pub.Q)

    // In case Ki is the point at infinity, proceed with the next value for i
    if (Ki.isInfinity()) {
      return this.derive(index + 1)
    }

    hd = new HDWallet(Ki, IR, this.network)
  }

  hd.depth = this.depth + 1
  hd.index = index
  hd.parentFingerprint = this.getFingerprint().readUInt32BE(0)

  return hd
}

HDWallet.prototype.deriveHardened = function(index) {
  // Only derives hardened private keys by default
  return this.derive(index + HDWallet.HIGHEST_BIT)
}

HDWallet.prototype.toString = HDWallet.prototype.toBase58

module.exports = HDWallet
