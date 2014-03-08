var Crypto = require('crypto-js');
var RIPEMD160 = Crypto.RIPEMD160;
var SHA256 = Crypto.SHA256;
var HMAC= Crypto.algo.HMAC;
var WordArray = Crypto.lib.WordArray;

/**
 * Create a byte array representing a number with the given length
 */
exports.numToBytes = function(num, bytes) {
    if (bytes === undefined) bytes = 8;
    if (bytes === 0) return [];
    return [num % 256].concat(module.exports.numToBytes(Math.floor(num / 256), bytes - 1));
}

/**
 * Convert a byte array to the number that it represents
 */
exports.bytesToNum = function(bytes) {
    if (bytes.length === 0) return 0;
    return bytes[0] + 256 * module.exports.bytesToNum(bytes.slice(1));
}

/**
 * Turn an integer into a "var_int".
 *
 * "var_int" is a variable length integer used by Bitcoin's binary format.
 *
 * Returns a byte array.
 */
exports.numToVarInt = function(num) {
    if (num < 253) return [num];
    if (num < 65536) return [253].concat(exports.numToBytes(num, 2));
    if (num < 4294967296) return [254].concat(exports.numToBytes(num, 4));
    return [253].concat(exports.numToBytes(num, 8));
}

exports.bytesToWords = function (bytes) {
    var words = [];
    for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
        words[b >>> 5] |= bytes[i] << (24 - b % 32);
    }
    return words;
}

exports.wordsToBytes = function (words) {
    var bytes = [];
    for (var b = 0; b < words.length * 32; b += 8) {
        bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
    }
    return bytes;
}

exports.bytesToWordArray = function (bytes) {
  return new WordArray.init(exports.bytesToWords(bytes), bytes.length)
}

exports.wordArrayToBytes = function (wordArray) {
  return exports.wordsToBytes(wordArray.words)
}

/**
 * Calculate RIPEMD160(SHA256(data)).
 *
 * Takes an arbitrary byte array as inputs and returns the hash as a byte
 * array.
 */
exports.sha256ripe160 = function (data) {
    var wordArray = RIPEMD160(SHA256(exports.bytesToWordArray(data)))
    return exports.wordArrayToBytes(wordArray)
}


exports.HmacFromBytesToBytes = function (hasher, message, key) {
  var hmac = HMAC.create(hasher, exports.bytesToWordArray(key))
  hmac.update(exports.bytesToWordArray(message))
  return exports.wordArrayToBytes(hmac.finalize())
}

exports.error = function(msg) {
    throw new Error(msg);
}
