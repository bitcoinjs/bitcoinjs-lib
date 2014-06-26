// https://en.bitcoin.it/wiki/Base58Check_encoding
var assert = require('assert')
var base58 = require('bs58')
var crypto = require('./crypto')

// Encode a buffer as a base58-check-encoded string
function encode(payload) {
  var checksum = crypto.hash256(payload).slice(0, 4)

  return base58.encode(Buffer.concat([
    payload,
    checksum
  ]))
}

// Decode a base58-check-encoded string to a buffer
function decode(string) {
  var buffer = base58.decode(string)

  var payload = buffer.slice(0, -4)
  var checksum = buffer.slice(-4)
  var newChecksum = crypto.hash256(payload).slice(0, 4)

  assert.deepEqual(newChecksum, checksum, 'Invalid checksum')

  return payload
}

module.exports = {
  encode: encode,
  decode: decode
}
