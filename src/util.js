var convert = require('./convert.js')
var Crypto = require('crypto-js');
var RIPEMD160 = Crypto.RIPEMD160;
var SHA256 = Crypto.SHA256;
var HMAC= Crypto.algo.HMAC;

/**
 * Calculate RIPEMD160(SHA256(data)).
 *
 * Takes an arbitrary byte array as inputs and returns the hash as a byte
 * array.
 */
exports.sha256ripe160 = function (data) {
    var wordArray = RIPEMD160(SHA256(convert.bytesToWordArray(data)))
    return convert.wordArrayToBytes(wordArray)
}

exports.HmacFromBytesToBytes = function (hasher, message, key) {
  var hmac = HMAC.create(hasher, convert.bytesToWordArray(key))
  hmac.update(convert.bytesToWordArray(message))
  return convert.wordArrayToBytes(hmac.finalize())
}

exports.error = function(msg) {
    throw new Error(msg);
}
