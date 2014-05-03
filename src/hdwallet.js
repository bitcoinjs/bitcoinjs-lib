var assert = require('assert')
var base58 = require('./base58')
var convert = require('./convert')

var Address = require('./address')
var BigInteger = require('bigi')
var CJS = require('crypto-js')
var crypto = require('./crypto')
var ECKey = require('./eckey').ECKey
var ECPubKey = require('./eckey').ECPubKey
var Network = require('./network')

var sec = require('./sec')
var ecparams = sec("secp256k1")

function HmacSHA512(buffer, secret) {
  var words = convert.bytesToWordArray(buffer)
  var hash = CJS.HmacSHA512(words, secret)

  return new Buffer(convert.wordArrayToBytes(hash))
}

function HDWallet(seed, networkString) {
  if (seed == undefined) return; // FIXME: Boo, should be stricter

  var I = HmacSHA512(seed, 'Bitcoin seed')
  this.chaincode = I.slice(32)
  this.network = networkString || 'bitcoin'

  if(!Network.hasOwnProperty(this.network)) {
    throw new Error("Unknown network: " + this.network)
  }

  this.priv = ECKey.fromBuffer(I.slice(0, 32), true)
  this.pub = this.priv.pub
  this.index = 0
  this.depth = 0
}

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

  assert.deepEqual(newChecksum, checksum)
  assert.equal(payload.length, HDWallet.LENGTH)

  return HDWallet.fromBuffer(payload)
}

HDWallet.fromHex = function(input) {
  return HDWallet.fromBuffer(new Buffer(input, 'hex'))
}

HDWallet.fromBuffer = function(input) {
  assert.strictEqual(input.length, HDWallet.LENGTH, 'Invalid buffer length')

  var hd = new HDWallet()

  // 4 byte: version bytes
  var version = input.readUInt32BE(0)

  var type
  for(var name in Network) {
    var network = Network[name]

    for(var t in network.bip32) {
      if (version != network.bip32[t]) continue

      type = t
      hd.network = name
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
    hd.priv = ECKey.fromBuffer(input.slice(46, 78), true)
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
  var version = Network[this.network].bip32[priv ? 'priv' : 'pub']
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
    this.priv.toBuffer().copy(buffer, 46)
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
  var buffer = new Buffer(this.toBuffer(priv))
  var checksum = crypto.hash256(buffer).slice(0, 4)

  return base58.encode(Buffer.concat([
    buffer,
    checksum
  ]))
}

HDWallet.prototype.derive = function(i) {
  var iBytes = convert.numToBytes(i, 4).reverse()
    , cPar = this.chaincode
    , usePriv = i >= HDWallet.HIGHEST_BIT
    , SHA512 = CJS.algo.SHA512

  var I
  if (usePriv) {
    assert(this.priv, 'Missing private key')

    // If 1, private derivation is used:
    // let I = HMAC-SHA512(Key = cpar, Data = 0x00 || kpar || i) [Note:]
    var kPar = this.priv.toBuffer().slice(0, 32)
    kPar = Array.prototype.slice.call(kPar)

    // FIXME: Dislikes buffers
    I = HmacFromBytesToBytes(SHA512, [0].concat(kPar, iBytes), cPar)
  } else {
    // If 0, public derivation is used:
    // let I = HMAC-SHA512(Key = cpar, Data = χ(kpar*G) || i)
    var KPar = this.pub.toBuffer()
    KPar = Array.prototype.slice.call(KPar)

    // FIXME: Dislikes buffers
    I = HmacFromBytesToBytes(SHA512, KPar.concat(iBytes), cPar)
  }

  // FIXME: Boo, CSJ.algo.SHA512 uses byte arrays
  I = new Buffer(I)

  // Split I = IL || IR into two 32-byte sequences, IL and IR.
  var ILb = I.slice(0, 32)
    , IRb = I.slice(32)

  var hd = new HDWallet()
  hd.network = this.network

  var IL = BigInteger.fromBuffer(ILb)

  if (this.priv) {
    // ki = IL + kpar (mod n).
    var ki = IL.add(this.priv.D).mod(ecparams.getN())

    hd.priv = new ECKey(ki, true)
    hd.pub = hd.priv.pub
  } else {
    // Ki = (IL + kpar)*G = IL*G + Kpar
    var Ki = IL.multiply(ecparams.getG()).add(this.pub.Q)

    hd.pub = new ECPubKey(Ki, true)
  }

  // ci = IR.
  hd.chaincode = IRb
  hd.parentFingerprint = this.getFingerprint().readUInt32BE(0)
  hd.depth = this.depth + 1
  hd.index = i
  hd.pub.compressed = true
  return hd
}

HDWallet.prototype.derivePrivate = function(index) {
  return this.derive(index + HDWallet.HIGHEST_BIT)
}

HDWallet.prototype.getKeyVersion = function() {
  return Network[this.network].pubKeyHash
}

HDWallet.prototype.toString = HDWallet.prototype.toBase58

function HmacFromBytesToBytes(hasher, message, key) {
  var hmac = CJS.algo.HMAC.create(hasher, convert.bytesToWordArray(key))
  hmac.update(convert.bytesToWordArray(message))
  return convert.wordArrayToBytes(hmac.finalize())
}

module.exports = HDWallet
