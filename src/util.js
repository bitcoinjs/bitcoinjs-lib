var convert = require('./convert.js')
var Crypto = require('crypto-js')
var RIPEMD160 = Crypto.RIPEMD160
var SHA256 = Crypto.SHA256

exports.sha256ripe160 = function (data) {
  var wordArray = RIPEMD160(SHA256(convert.bytesToWordArray(data)))
  return convert.wordArrayToBytes(wordArray)
}

exports.error = function (msg) {
  throw new Error(msg)
}
