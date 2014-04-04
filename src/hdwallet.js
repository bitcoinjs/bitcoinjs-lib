var convert = require('./convert.js')
var base58 = require('./base58.js')
var assert = require('assert')
var format = require('util').format
var util = require('./util.js')
var Crypto = require('crypto-js')
var HmacSHA512 = Crypto.HmacSHA512
var HMAC= Crypto.algo.HMAC
var ECKey = require('./eckey.js').ECKey
var ECPubKey = require('./eckey.js').ECPubKey
var Address = require('./address.js')
var Network = require('./network')

var crypto = require('crypto')

function sha256(buf) {
  var hash = crypto.createHash('sha256')
  hash.update(buf)

  return hash.digest()
}

function HDWallet(seed, network) {
  if (seed === undefined) return;

  var seedWords = convert.bytesToWordArray(seed)
  var I = convert.wordArrayToBytes(HmacSHA512(seedWords, 'Bitcoin seed'))
  this.chaincode = I.slice(32)
  this.network = network || 'mainnet'
  if(!Network.hasOwnProperty(this.network)) {
    throw new Error("Unknown network: " + this.network)
  }

  this.priv = new ECKey(I.slice(0, 32).concat([1]), true)
  this.pub = this.priv.getPub()
  this.index = 0
  this.depth = 0
}

HDWallet.HIGHEST_BIT = 0x80000000
HDWallet.LENGTH = 78

function arrayEqual(a, b) {
  return !(a < b || a > b)
}

HDWallet.fromSeedHex = function(hex, network) {
  return new HDWallet(convert.hexToBytes(hex), network)
}

HDWallet.fromSeedString = function(string, network) {
  return new HDWallet(convert.stringToBytes(string), network)
}

HDWallet.fromBase58 = function(string) {
  var buffer = base58.decode(string)

  var payload = buffer.slice(0, -4)
  var checksum = buffer.slice(-4)
  var newChecksum = sha256(sha256(payload)).slice(0, 4)

  assert.deepEqual(newChecksum, checksum)
  assert.equal(payload.length, HDWallet.LENGTH)

  return HDWallet.fromBytes(payload)
}

HDWallet.fromHex = function(input) {
  return HDWallet.fromBytes(convert.hexToBytes(input))
}

HDWallet.fromBytes = function(input) {
  // This 78 byte structure can be encoded like other Bitcoin data in Base58. (+32 bits checksum)
  if (input.length != HDWallet.LENGTH) {
    throw new Error(format('Invalid input length, %s. Expected %s.', input.length, HDWallet.LENGTH))
  }

  // FIXME: transitionary fix
  if (Buffer.isBuffer(input)) {
    input = Array.prototype.map.bind(input, function(x) { return x })()
  }

  var hd = new HDWallet()

  // 4 byte: version bytes (mainnet: 0x0488B21E public, 0x0488ADE4 private
  // testnet: 0x043587CF public, 0x04358394 private)
  var versionBytes = input.slice(0, 4)
  var versionWord = convert.bytesToWords(versionBytes)[0]
  var type

  for(var name in Network) {
    var network = Network[name]

    for(var t in network.hdVersions) {
      if (versionWord != network.hdVersions[t]) continue

      type = t
      hd.network = name
    }
  }

  if (!hd.network) {
    throw new Error(format('Could not find version %s', convert.bytesToHex(versionBytes)))
  }

  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ...
  hd.depth = input[4]

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  hd.parentFingerprint = input.slice(5, 9)
  assert((hd.depth === 0) == arrayEqual(hd.parentFingerprint, [0, 0, 0, 0]))

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in MSB order. (0x00000000 if master key)
  hd.index = convert.bytesToNum(input.slice(9, 13).reverse())
  assert(hd.depth > 0 || hd.index === 0)

  // 32 bytes: the chain code
  hd.chaincode = input.slice(13, 45)

  // 33 bytes: the public key or private key data (0x02 + X or 0x03 + X for
  // public keys, 0x00 + k for private keys)
  if (type == 'priv') {
    hd.priv = new ECKey(input.slice(46, 78).concat([1]), true)
    hd.pub = hd.priv.getPub()
  } else {
    hd.pub = new ECPubKey(input.slice(45, 78), true)
  }

  return hd
}

HDWallet.prototype.getIdentifier = function() {
  return util.sha256ripe160(this.pub.toBytes())
}

HDWallet.prototype.getFingerprint = function() {
  return this.getIdentifier().slice(0, 4)
}

HDWallet.prototype.getAddress = function() {
  return new Address(util.sha256ripe160(this.pub.toBytes()), this.getKeyVersion())
}

HDWallet.prototype.toBytes = function(priv) {
  var buffer = []

  // Version
  // 4 byte: version bytes (mainnet: 0x0488B21E public, 0x0488ADE4 private; testnet: 0x043587CF public,
  // 0x04358394 private)
  var version = Network[this.network].hdVersions[priv ? 'priv' : 'pub']
  var vBytes = convert.wordsToBytes([version])

  buffer = buffer.concat(vBytes)
  assert.equal(buffer.length, 4)

  // Depth
  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ....
  buffer.push(this.depth)
  assert.equal(buffer.length, 4 + 1)

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  buffer = buffer.concat(this.depth ? this.parentFingerprint : [0, 0, 0, 0])
  assert.equal(buffer.length, 4 + 1 + 4)

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in MSB order. (0x00000000 if master key)
  buffer = buffer.concat(convert.numToBytes(this.index, 4).reverse())
  assert.equal(buffer.length, 4 + 1 + 4 + 4)

  // 32 bytes: the chain code
  buffer = buffer.concat(this.chaincode)
  assert.equal(buffer.length, 4 + 1 + 4 + 4 + 32)

  // 33 bytes: the public key or private key data
  // (0x02 + X or 0x03 + X for public keys, 0x00 + k for private keys)
  if (priv) {
    assert(this.priv, 'Cannot serialize to private without private key')
    buffer.push(0)
    buffer = buffer.concat(this.priv.toBytes().slice(0, 32))
  } else {
    buffer = buffer.concat(this.pub.toBytes(true))
  }

  return buffer
}

HDWallet.prototype.toHex = function(priv) {
  var bytes = this.toBytes(priv)
  return convert.bytesToHex(bytes)
}

HDWallet.prototype.toBase58 = function(priv) {
  var buffer = new Buffer(this.toBytes(priv))
  var checksum = sha256(sha256(buffer)).slice(0, 4)

  return base58.encode(Buffer.concat([
    buffer,
    checksum
  ]))
}

HDWallet.prototype.derive = function(i) {
  var I
    , iBytes = convert.numToBytes(i, 4).reverse()
    , cPar = this.chaincode
    , usePriv = i >= HDWallet.HIGHEST_BIT
    , SHA512 = Crypto.algo.SHA512

  if (usePriv) {
    assert(this.priv, 'Private derive on public key')

    // If 1, private derivation is used:
    // let I = HMAC-SHA512(Key = cpar, Data = 0x00 || kpar || i) [Note:]
    var kPar = this.priv.toBytes().slice(0, 32)
    I = HmacFromBytesToBytes(SHA512, [0].concat(kPar, iBytes), cPar)
  } else {
    // If 0, public derivation is used:
    // let I = HMAC-SHA512(Key = cpar, Data = χ(kpar*G) || i)
    var KPar = this.pub.toBytes(true)
    I = HmacFromBytesToBytes(SHA512, KPar.concat(iBytes), cPar)
  }

  // Split I = IL || IR into two 32-byte sequences, IL and IR.
  var IL = I.slice(0, 32)
    , IR = I.slice(32)

  var hd = new HDWallet()
  hd.network = this.network

  if (this.priv) {
    // ki = IL + kpar (mod n).
    hd.priv = this.priv.add(new ECKey(IL.concat([1])))
    hd.priv.compressed = true
    hd.priv.version = this.getKeyVersion()
    hd.pub = hd.priv.getPub()
  } else {
    // Ki = (IL + kpar)*G = IL*G + Kpar
    hd.pub = this.pub.add(new ECKey(IL.concat([1]), true).getPub())
  }

  // ci = IR.
  hd.chaincode = IR
  hd.parentFingerprint = this.getFingerprint()
  hd.depth = this.depth + 1
  hd.index = i
  hd.pub.compressed = true
  return hd
}

HDWallet.prototype.derivePrivate = function(index) {
  return this.derive(index + HDWallet.HIGHEST_BIT)
}

HDWallet.prototype.getKeyVersion = function() {
  return Network[this.network].addressVersion
}

HDWallet.prototype.toString = HDWallet.prototype.toBase58

function HmacFromBytesToBytes(hasher, message, key) {
  var hmac = HMAC.create(hasher, convert.bytesToWordArray(key))
  hmac.update(convert.bytesToWordArray(message))
  return convert.wordArrayToBytes(hmac.finalize())
}

module.exports = HDWallet
