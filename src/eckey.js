var Address = require('./address')
var assert = require('assert')
var convert = require('./convert')
var base58check = require('./base58check')
var BigInteger = require('./jsbn/jsbn')
var ecdsa = require('./ecdsa')
var ECPointFp = require('./jsbn/ec').ECPointFp
var sec = require('./jsbn/sec')
var Network = require('./network')
var util = require('./util')
var ecparams = sec("secp256k1")

// input can be nothing, array of bytes, hex string, or base58 string
var ECKey = function (input, compressed) {
  if (!(this instanceof ECKey)) { return new ECKey(input, compressed) }
  if (!input) {
    // Generate new key
    var n = ecparams.getN()
    this.priv = ecdsa.getBigRandom(n)
    this.compressed = compressed || false
  }
  else this.import(input,compressed)
}

ECKey.prototype.import = function (input, compressed) {
  function has(li, v) { return li.indexOf(v) >= 0 }
  function fromBin(x) { return BigInteger.fromByteArrayUnsigned(x) }

  this.priv =
      input instanceof ECKey                   ? input.priv
    : input instanceof BigInteger              ? input.mod(ecparams.getN())
    : Array.isArray(input)                     ? fromBin(input.slice(0, 32))
    : typeof input != "string"                 ? null
    : input.length == 44                       ? fromBin(convert.base64ToBytes(input))
    : input.length == 51 && input[0] == '5'    ? fromBin(base58check.decode(input).payload)
    : input.length == 51 && input[0] == '9'    ? fromBin(base58check.decode(input).payload)
    : input.length == 52 && has('LK', input[0]) ? fromBin(base58check.decode(input).payload.slice(0, 32))
    : input.length == 52 && input[0] == 'c'    ? fromBin(base58check.decode(input).payload.slice(0, 32))
    : has([64,65],input.length)                ? fromBin(convert.hexToBytes(input.slice(0, 64)))
    : null

  assert(this.priv !== null)

  this.compressed =
      compressed !== undefined                 ? compressed
    : input instanceof ECKey                   ? input.compressed
    : input instanceof BigInteger              ? false
    : Array.isArray(input)                     ? false
    : typeof input != "string"                 ? null
    : input.length == 44                       ? false
    : input.length == 51 && input[0] == '5'    ? false
    : input.length == 51 && input[0] == '9'    ? false
    : input.length == 52 && has('LK', input[0]) ? true
    : input.length == 52 && input[0] == 'c'    ? true
    : input.length == 64                       ? false
    : input.length == 65                       ? true
    : null

  assert(this.compressed !== null)
}

ECKey.prototype.getPub = function(compressed) {
  if (compressed === undefined) compressed = this.compressed
  return ECPubKey(ecparams.getG().multiply(this.priv), compressed)
}

ECKey.prototype.toBin = function() {
  return convert.bytesToString(this.toBytes())
}

ECKey.version_bytes = {
  0: 128,
  111: 239
}

ECKey.prototype.toWif = function(version) {
  version = version || Network.mainnet.addressVersion

  return base58check.encode(this.toBytes(), ECKey.version_bytes[version])
}

ECKey.prototype.toHex = function() {
  return convert.bytesToHex(this.toBytes())
}

ECKey.prototype.toBytes = function() {
  var bytes = this.priv.toByteArrayUnsigned()
  if (this.compressed) bytes.push(1)
  return bytes
}

ECKey.prototype.toBase64 = function() {
  return convert.bytesToBase64(this.toBytes())
}

ECKey.prototype.toString = ECKey.prototype.toHex

ECKey.prototype.getAddress = function(version) {
  return this.getPub().getAddress(version)
}

ECKey.prototype.add = function(key) {
  return ECKey(this.priv.add(ECKey(key).priv), this.compressed)
}

ECKey.prototype.multiply = function(key) {
  return ECKey(this.priv.multiply(ECKey(key).priv), this.compressed)
}

ECKey.prototype.sign = function(hash) {
  return ecdsa.sign(hash, this.priv)
}

ECKey.prototype.verify = function(hash, sig) {
  return this.getPub().verify(hash, sig)
}

var ECPubKey = function(input, compressed) {
  if (!(this instanceof ECPubKey)) {
    return new ECPubKey(input, compressed)
  }

  this.import(input, compressed)
}

ECPubKey.prototype.import = function(input, compressed) {
  var decode = function(x) { return ECPointFp.decodeFrom(ecparams.getCurve(), x) }

  this.pub =
      input instanceof ECPointFp ? input
    : input instanceof ECKey     ? ecparams.getG().multiply(input.priv)
    : input instanceof ECPubKey  ? input.pub
    : typeof input == "string"   ? decode(convert.hexToBytes(input))
    : Array.isArray(input)       ? decode(input)
    : null

  assert(this.pub !== null)

  this.compressed =
      compressed                 ? compressed
    : input instanceof ECPointFp ? input.compressed
    : input instanceof ECPubKey  ? input.compressed
    : (this.pub[0] < 4)
}

ECPubKey.prototype.add = function(key) {
  return ECPubKey(this.pub.add(ECPubKey(key).pub), this.compressed)
}

ECPubKey.prototype.multiply = function(key) {
  return ECPubKey(this.pub.multiply(ECKey(key).priv), this.compressed)
}

ECPubKey.prototype.toBytes = function(compressed) {
  if (compressed === undefined) compressed = this.compressed
  return this.pub.getEncoded(compressed)
}

ECPubKey.prototype.toHex = function(compressed) {
  return convert.bytesToHex(this.toBytes(compressed))
}

ECPubKey.prototype.toBin = function(compressed) {
  return convert.bytesToString(this.toBytes(compressed))
}

ECPubKey.prototype.toWif = function(version) {
  version = version || Network.mainnet.addressVersion

  return base58check.encode(this.toBytes(), version)
}

ECPubKey.prototype.toString = ECPubKey.prototype.toHex

ECPubKey.prototype.getAddress = function(version) {
  version = version || Network.mainnet.addressVersion

  return new Address(util.sha256ripe160(this.toBytes()), version)
}

ECPubKey.prototype.verify = function(hash, sig) {
  return ecdsa.verify(hash, sig, this.toBytes())
}

module.exports = {
  ECKey: ECKey,
  ECPubKey: ECPubKey
}
