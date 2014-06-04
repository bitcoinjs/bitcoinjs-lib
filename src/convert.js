var assert = require('assert')
var Crypto = require('crypto-js')
var WordArray = Crypto.lib.WordArray

function bufferToWordArray(buffer) {
  assert(Buffer.isBuffer(buffer), 'Expected Buffer, got', buffer)

  var words = []
  for (var i = 0, b = 0; i < buffer.length; i++, b += 8) {
    words[b >>> 5] |= buffer[i] << (24 - b % 32)
  }

  return new WordArray.init(words, buffer.length)
}

function wordArrayToBuffer(wordArray) {
  assert(Array.isArray(wordArray.words), 'Expected WordArray, got' + wordArray)

  var words = wordArray.words
  var buffer = new Buffer(words.length * 4)

  words.forEach(function(value, i) {
    buffer.writeInt32BE(value & -1, i * 4)
  })

  return buffer
}

module.exports = {
  bufferToWordArray: bufferToWordArray,
  wordArrayToBuffer: wordArrayToBuffer
}
