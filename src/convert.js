var assert = require('assert')
var Crypto = require('crypto-js')
var WordArray = Crypto.lib.WordArray

function lpad(str, padString, length) {
  while (str.length < length) str = padString + str
  return str
}

function bytesToHex(bytes) {
  // FIXME: transitionary fix
  if (Buffer.isBuffer(bytes)) {
    return bytes.toString('hex')
  }

  return bytes.map(function(x) {
    return lpad(x.toString(16), '0', 2)
  }).join('')
}

function hexToBytes(hex) {
  return hex.match(/../g).map(function(x) {
    return parseInt(x,16)
  })
}

/**
 * Convert a byte array to the number that it represents
 */
function bytesToNum(bytes) {
  if (bytes.length === 0) return 0
  return bytes[0] + 256 * bytesToNum(bytes.slice(1))
}

function bytesToWords(bytes) {
  assert(Array.isArray(bytes) || Buffer.isBuffer(bytes), 'Input must be a byte array')
  var words = []
  for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
    words[b >>> 5] |= bytes[i] << (24 - b % 32)
  }
  return words
}

function wordsToBytes(words) {
  var bytes = []
  for (var b = 0; b < words.length * 32; b += 8) {
    bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF)
  }
  return bytes
}

function bytesToWordArray(bytes) {
  return new WordArray.init(bytesToWords(bytes), bytes.length)
}

function wordArrayToBytes(wordArray) {
  return wordsToBytes(wordArray.words)
}

function reverseEndian (hex) {
  return bytesToHex(hexToBytes(hex).reverse())
}

module.exports = {
  lpad: lpad,
  bytesToHex: bytesToHex,
  hexToBytes: hexToBytes,
  bytesToNum: bytesToNum,
  bytesToWords: bytesToWords,
  wordsToBytes: wordsToBytes,
  bytesToWordArray: bytesToWordArray,
  wordArrayToBytes: wordArrayToBytes,
  reverseEndian: reverseEndian
}
