// Crypto, crypto, where art thou crypto
var assert = require('assert')
var CryptoJS = require('crypto-js')
var crypto = require('crypto')
var convert = require('./convert')

function hash160(buffer) {
  var step1 = sha256(buffer)

  var step2a = convert.bufferToWordArray(step1)
  var step2b = CryptoJS.RIPEMD160(step2a)

  return convert.wordArrayToBuffer(step2b)
}

function hash256(buffer) {
  return sha256(sha256(buffer))
}

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest()
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest()
}

// FIXME: Name not consistent with others
function HmacSHA256(buffer, secret) {
  return crypto.createHmac('sha256', secret).update(buffer).digest()
}

function HmacSHA512(data, secret) {
  assert(Buffer.isBuffer(data), 'Expected Buffer for data, got ' + data)
  assert(Buffer.isBuffer(secret), 'Expected Buffer for secret, got ' + secret)

  var dataWords = convert.bufferToWordArray(data)
  var secretWords = convert.bufferToWordArray(secret)

  var hash = CryptoJS.HmacSHA512(dataWords, secretWords)

  return convert.wordArrayToBuffer(hash)
}

module.exports = {
  sha1: sha1,
  sha256: sha256,
  hash160: hash160,
  hash256: hash256,
  HmacSHA256: HmacSHA256,
  HmacSHA512: HmacSHA512
}
