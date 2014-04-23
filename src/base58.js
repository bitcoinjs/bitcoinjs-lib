// Base58 encoding/decoding
// Originally written by Mike Hearn for BitcoinJ
// Copyright (c) 2011 Google Inc
// Ported to JavaScript by Stefan Thomas
// Merged Buffer refactorings from base58-native by Stephen Pair
// Copyright (c) 2013 BitPay Inc

var BigInteger = require('./bigi')

var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
var ALPHABET_BUF = new Buffer(ALPHABET, 'ascii')
var ALPHABET_MAP = {}
for(var i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET[i]] = BigInteger.valueOf(i)
}
var BASE = BigInteger.valueOf(58)

function encode(buffer) {
  var bi = BigInteger.fromBuffer(buffer)
  var result = new Buffer(buffer.length << 1)

  var i = result.length - 1
  while (bi.compareTo(BigInteger.ZERO) > 0) {
    var remainder = bi.mod(BASE)
    bi = bi.divide(BASE)

    result[i] = ALPHABET_BUF[remainder.intValue()]
    i--
  }

  // deal with leading zeros
  var j = 0
  while (buffer[j] === 0) {
    result[i] = ALPHABET_BUF[0]
    j++
    i--
  }

  return result.slice(i + 1, result.length).toString('ascii')
}

function decode(string) {
  if (string.length === 0) return new Buffer(0)

  var num = BigInteger.ZERO.clone()

  for (var i = 0; i < string.length; i++) {
    num = num.multiply(BASE)
    num = num.add(ALPHABET_MAP[string.charAt(i)])
  }

  // deal with leading zeros
  var i = 0
  while ((i < string.length) && (string[i] === ALPHABET[0])) {
    i++
  }

  var buffer = num.toBuffer()
  var leadz = new Buffer(i)
  leadz.fill(0)

  return Buffer.concat([leadz, buffer])
}

module.exports = {
  encode: encode,
  decode: decode
}
