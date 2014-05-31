var assert = require('assert')
var base58 = require('./base58')

var BigInteger = require('bigi')
var crypto = require('./crypto')
var ECKey = require('./eckey')
var ECPubKey = require('./ecpubkey')
var networks = require('./networks')

var sec = require('./sec')
var ecparams = sec("secp256k1")

function HDWallet(seed, network) {
  if (seed == undefined) return; // FIXME: Boo, should be stricter

  network = network || networks.bitcoin
  assert(network.bip32, 'Unknown BIP32 constants for network')

  var I = crypto.HmacSHA512(seed, HDWallet.MASTER_SECRET)
  var IL = I.slice(0, 32)
  var IR = I.slice(32)

  // In case IL is 0 or >= n, the master key is invalid (handled by ECKey.fromBuffer)
  var pIL = BigInteger.fromBuffer(IL)

  this.network = network
  this.priv = new ECKey(pIL, true)
  this.pub = this.priv.pub

  this.chaincode = IR
  this.depth = 0
  this.index = 0
}

HDWallet.MASTER_SECRET = new Buffer('Bitcoin seed')
HDWallet.HIGHEST_BIT = 0x80000000
HDWallet.LENGTH = 78

HDWallet.fromSeedHex = function(hex, network) {
  return new HDWallet(new Buffer(hex, 'hex'), network)
}

HDWallet.fromBase58 = function(string) {
  var buffer = base58.decode(string)

  var payload = buffer.slice(0, -4)
  var checksum = buffer.slice(-4)
  var newChecksum = crypto.hash256(payload).slice(0, 4)

  assert.deepEqual(newChecksum, checksum, 'Invalid checksum')
  assert.equal(payload.length, HDWallet.LENGTH, 'Invalid BIP32 string')

  return HDWallet.fromBuffer(payload)
}

HDWallet.fromBuffer = function(input) {
  assert.strictEqual(input.length, HDWallet.LENGTH, 'Invalid buffer length')

  var hd = new HDWallet()

  // 4 byte: version bytes
  var version = input.readUInt32BE(0)

  var type
  for (var name in networks) {
    var network = networks[name]

    for (var t in network.bip32) {
      if (version != network.bip32[t]) continue

      type = t
      hd.network = network
    }
  }

  if (!hd.network) {
    throw new Error('Could not find version ' + version.toString(16))
  }

  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ...
  hd.depth = input.readUInt8(4)

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  hd.parentFingerprint = input.readUInt32BE(5)
  if (hd.depth === 0) {
    assert.strictEqual(hd.parentFingerprint, 0x00000000, 'Invalid parent fingerprint')
  }

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in MSB order. (0x00000000 if master key)
  hd.index = input.readUInt32BE(9)
  assert(hd.depth > 0 || hd.index === 0, 'Invalid index')

  // 32 bytes: the chain code
  hd.chaincode = input.slice(13, 45)

  // 33 bytes: the public key or private key data (0x02 + X or 0x03 + X for
  // public keys, 0x00 + k for private keys)
  if (type == 'priv') {
    assert.equal(input.readUInt8(45), 0, 'Invalid private key')
    var D = BigInteger.fromBuffer(input.slice(46, 78))

    hd.priv = new ECKey(D, true)
    hd.pub = hd.priv.pub
  } else {
    hd.pub = ECPubKey.fromBuffer(input.slice(45, 78), true)
  }

  return hd
}

HDWallet.prototype.getIdentifier = function() {
  return crypto.hash160(this.pub.toBuffer())
}

HDWallet.prototype.getFingerprint = function() {
  return this.getIdentifier().slice(0, 4)
}

HDWallet.prototype.getAddress = function() {
  return this.pub.getAddress(this.getKeyVersion())
}

HDWallet.prototype.toBuffer = function(priv) {
  // Version
  var version = this.network.bip32[priv ? 'priv' : 'pub']
  var buffer = new Buffer(HDWallet.LENGTH)

  // 4 bytes: version bytes
  buffer.writeUInt32BE(version, 0)

  // Depth
  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ....
  buffer.writeUInt8(this.depth, 4)

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  var fingerprint = this.depth ? this.parentFingerprint : 0x00000000
  buffer.writeUInt32BE(fingerprint, 5)

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in Big endian. (0x00000000 if master key)
  buffer.writeUInt32BE(this.index, 9)

  // 32 bytes: the chain code
  this.chaincode.copy(buffer, 13)

  // 33 bytes: the public key or private key data
  if (priv) {
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
HDWallet.prototype.toHex = function(priv) {
  return this.toBuffer(priv).toString('hex')
}

HDWallet.prototype.toBase58 = function(priv) {
  var buffer = this.toBuffer(priv)
  var checksum = crypto.hash256(buffer).slice(0, 4)

  return base58.encode(Buffer.concat([
    buffer,
    checksum
  ]))
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

  var I = crypto.HmacSHA512(data, this.chaincode)
  var IL = I.slice(0, 32)
  var IR = I.slice(32)

  var hd = new HDWallet()
  var pIL = BigInteger.fromBuffer(IL)

  // Private parent key -> private child key
  if (this.priv) {
    // ki = parse256(IL) + kpar (mod n)
    var ki = pIL.add(this.priv.D).mod(ecparams.getN())

    // In case parse256(IL) >= n or ki == 0, one should proceed with the next value for i
    if (pIL.compareTo(ecparams.getN()) >= 0 || ki.signum() === 0) {
      return this.derive(index + 1)
    }

    hd.priv = new ECKey(ki, true)
    hd.pub = hd.priv.pub

  // Public parent key -> public child key
  } else {
    // Ki = point(parse256(IL)) + Kpar
    //    = G*IL + Kpar
    var Ki = ecparams.getG().multiply(pIL).add(this.pub.Q)

    // In case parse256(IL) >= n or Ki is the point at infinity, one should proceed with the next value for i
    if (pIL.compareTo(ecparams.getN()) >= 0 || Ki.isInfinity()) {
      return this.derive(index + 1)
    }

    hd.pub = new ECPubKey(Ki, true)
  }

  hd.chaincode = IR
  hd.depth = this.depth + 1
  hd.network = this.network
  hd.parentFingerprint = this.getFingerprint().readUInt32BE(0)
  hd.index = index

  return hd
}

HDWallet.prototype.derivePrivate = function(index) {
  // Only derives hardened private keys by default
  return this.derive(index + HDWallet.HIGHEST_BIT)
}

HDWallet.prototype.getKeyVersion = function() {
  return this.network.pubKeyHash
}

HDWallet.prototype.toString = HDWallet.prototype.toBase58

module.exports = HDWallet
