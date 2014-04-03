// https://en.bitcoin.it/wiki/Base58Check_encoding
var assert = require('assert')
var base58 = require('./base58')
var crypto = require('crypto')

function sha256(buf) {
  var hash = crypto.createHash('sha256')
  hash.update(buf)

  return hash.digest()
}

// Encode a buffer as a base58-check-encoded string
function encode(buffer, version) {
  version = version || 0

  // FIXME: `new Buffer(buffer)` is unnecessary if input is a Buffer
  var version = new Buffer([version])
  var payload = new Buffer(buffer)

  var message = Buffer.concat([version, payload])
  var checksum = sha256(sha256(message)).slice(0, 4)

  return base58.encode(Buffer.concat([
    message,
    checksum
  ]))
}

// Decode a base58-check-encoded string to a buffer
function decode(string) {
  var buffer = base58.decode(string)

  var message = buffer.slice(0, -4)
  var checksum = buffer.slice(-4)
  var newChecksum = sha256(sha256(message)).slice(0, 4)

  assert.deepEqual(newChecksum, checksum)

  var version = message.readUInt8(0)
  var payload = message.slice(1)

  return {
    version: version,
    payload: payload,
    checksum: checksum
  }
}

module.exports = {
  encode: encode,
  decode: decode
}
