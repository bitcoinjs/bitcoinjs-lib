var assert = require('assert')
var Crypto = require('crypto-js')
var WordArray = Crypto.lib.WordArray

function bufferToWords(buffer) {
  assert(Buffer.isBuffer(buffer), 'Expected Buffer, got' + buffer)
  var words = []
  for (var i = 0, b = 0; i < buffer.length; i++, b += 8) {
    words[b >>> 5] |= buffer[i] << (24 - b % 32)
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

function bufferToWordArray(buffer) {
  return new WordArray.init(bufferToWords(buffer), buffer.length)
}

function wordArrayToBuffer(wordArray) {
  return new Buffer(wordsToBytes(wordArray.words))
}

function reverseEndian(hex) {
  var buffer = new Buffer(hex, 'hex')
  Array.prototype.reverse.call(buffer)

  return buffer.toString('hex')
}

module.exports = {
  bufferToWords: bufferToWords,
  wordsToBytes: wordsToBytes,
  bufferToWordArray: bufferToWordArray,
  wordArrayToBuffer: wordArrayToBuffer,
  reverseEndian: reverseEndian
}
