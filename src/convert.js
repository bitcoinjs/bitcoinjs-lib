var Crypto = require('crypto-js')
var WordArray = Crypto.lib.WordArray
var base64map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

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

function bytesToBase64(bytes) {
  var base64 = []

  for (var i = 0; i < bytes.length; i += 3) {
    var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    for (var j = 0; j < 4; j++) {
      if (i * 8 + j * 6 <= bytes.length * 8) {
        base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F))
      } else {
        base64.push('=')
      }
    }
  }

  return base64.join('')
}

function base64ToBytes(base64) {
  // Remove non-base-64 characters
  base64 = base64.replace(/[^A-Z0-9+\/]/ig, '')

  var bytes = []
  var imod4 = 0

  for (var i = 0; i < base64.length; imod4 = ++i % 4) {
    if (!imod4) continue

      bytes.push(
        (
          (base64map.indexOf(base64.charAt(i - 1)) & (Math.pow(2, -2 * imod4 + 8) - 1)) <<
          (imod4 * 2)
      ) |
        (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2))
      )
  }

  return bytes
}

/**
 * Hex only (allowing bin would be potentially risky, as 01010101 = \x01 * 4 or 85)
 */
function coerceToBytes(input) {
  if (typeof input != 'string') return input
    return hexToBytes(input)
}

function binToBytes(bin) {
  return bin.match(/......../g).map(function(x) {
    return parseInt(x,2)
  })
}

function bytesToBin(bytes) {
  return bytes.map(function(x) {
    return lpad(x.toString(2), '0', 8)
  }).join('')
}

function bytesToString(bytes) {
  return bytes.map(function(x){
    return String.fromCharCode(x)
  }).join('')
}

function stringToBytes(string) {
  return string.split('').map(function(x) {
    return x.charCodeAt(0)
  })
}

/**
 * Create a byte array representing a number with the given length
 */
function numToBytes(num, bytes) {
  if (bytes === undefined) bytes = 8
  if (bytes === 0) return []
  return [num % 256].concat(numToBytes(Math.floor(num / 256), bytes - 1))
}

/**
 * Convert a byte array to the number that it represents
 */
function bytesToNum(bytes) {
  if (bytes.length === 0) return 0
  return bytes[0] + 256 * bytesToNum(bytes.slice(1))
}

/**
 * Turn an integer into a "var_int".
 *
 * "var_int" is a variable length integer used by Bitcoin's binary format.
 *
 * Returns a byte array.
 */
function numToVarInt(num) {
  if (num < 253) return [num]
  if (num < 65536) return [253].concat(numToBytes(num, 2))
  if (num < 4294967296) return [254].concat(numToBytes(num, 4))
  return [255].concat(numToBytes(num, 8))
}

/**
 * Turn an VarInt into an integer
 *
 * "var_int" is a variable length integer used by Bitcoin's binary format.
 *
 * Returns { bytes: bytesUsed, number: theNumber }
 */
function varIntToNum(bytes) {
  var prefix = bytes[0]

  var viBytes =
      prefix < 253   ? bytes.slice(0, 1)
    : prefix === 253 ? bytes.slice(1, 3)
    : prefix === 254 ? bytes.slice(1, 5)
    : bytes.slice(1, 9)

  return {
    bytes: prefix < 253 ? viBytes : bytes.slice(0, viBytes.length + 1),
    number: bytesToNum(viBytes)
  }
}

function bytesToWords(bytes) {
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
  bytesToBase64: bytesToBase64,
  base64ToBytes: base64ToBytes,
  coerceToBytes: coerceToBytes,
  binToBytes: binToBytes,
  bytesToBin: bytesToBin,
  bytesToString: bytesToString,
  stringToBytes: stringToBytes,
  numToBytes: numToBytes,
  bytesToNum: bytesToNum,
  numToVarInt: numToVarInt,
  varIntToNum: varIntToNum,
  bytesToWords: bytesToWords,
  wordsToBytes: wordsToBytes,
  bytesToWordArray: bytesToWordArray,
  wordArrayToBytes: wordArrayToBytes,
  reverseEndian: reverseEndian
}
