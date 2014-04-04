// Base58 encoding/decoding
// Originally written by Mike Hearn for BitcoinJ
// Copyright (c) 2011 Google Inc
// Ported to JavaScript by Stefan Thomas

var BigInteger = require('./jsbn/jsbn')

// FIXME: ? This is a Base58Check alphabet
var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
var base = BigInteger.valueOf(58)

var alphabetMap = {}
for (var i=0; i<alphabet.length; ++i) {
  var chr = alphabet[i]
  alphabetMap[chr] = BigInteger.valueOf(i)
}

// encode a byte array into a base58 encoded String
// @return String
function encode(buffer) {
  var bi = BigInteger.fromByteArrayUnsigned(buffer)
  var chars = []

  while (bi.compareTo(base) >= 0) {
    var mod = bi.mod(base)
    bi = bi.subtract(mod).divide(base)

    chars.push(alphabet[mod.intValue()])
  }

  chars.push(alphabet[bi.intValue()])

  // Convert leading zeros too.
  for (var i=0; i<buffer.length; i++) {
    if (buffer[i] !== 0x00) break

    chars.push(alphabet[0])
  }

  return chars.reverse().join('')
}

// decode a base58 encoded String into a byte array
// @return Array
function decode(str) {
  var num = BigInteger.valueOf(0)

  var leading_zero = 0
  var seen_other = false

  for (var i=0; i<str.length; ++i) {
    var chr = str[i]
    var bi = alphabetMap[chr]

    // if we encounter an invalid character, decoding fails
    if (bi === undefined) {
      throw new Error('invalid base58 string: ' + str)
    }

    num = num.multiply(base).add(bi)

    if (chr === '1' && !seen_other) {
      ++leading_zero
    } else {
      seen_other = true
    }
  }

  var bytes = num.toByteArrayUnsigned()

  // remove leading zeros
  while (leading_zero-- > 0) {
    bytes.unshift(0)
  }

  return new Buffer(bytes)
}

module.exports = {
  encode: encode,
  decode: decode
}
