var assert = require('assert')
var BigInteger = require('bigi')

// Import operations
BigInteger.fromHex = function(hex) {
  var buffer = new Buffer(hex, 'hex')
  assert.equal(buffer.length, Buffer.byteLength(hex) / 2)

  return BigInteger.fromBuffer(buffer)
}

BigInteger.fromBuffer = function(buffer) {
  assert(Array.isArray(buffer) || Buffer.isBuffer(buffer)) // FIXME: Transitionary

  // FIXME: Transitionary
  if (Buffer.isBuffer(buffer)) {
    buffer = Array.prototype.slice.call(buffer)
  }

  return BigInteger.fromByteArrayUnsigned(buffer)
}

// Export operations
BigInteger.prototype.toBuffer = function(s) {
  if (s != undefined) assert(Number.isFinite(s))

  var buffer = new Buffer(this.toByteArrayUnsigned())
  var padded = new Buffer(s - buffer.length)
  padded.fill(0)

  return Buffer.concat([padded, buffer], s)
}

BigInteger.prototype.toHex = function(s) {
  return this.toBuffer(s).toString('hex')
}

module.exports = BigInteger
