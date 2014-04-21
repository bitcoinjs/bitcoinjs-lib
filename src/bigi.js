var assert = require('assert')
var BigInteger = require('bigi')

BigInteger.fromBuffer = function(buffer) {
  // FIXME: Transitionary
  if (Buffer.isBuffer(buffer)) {
    buffer = Array.prototype.slice.call(buffer)
  }

  return BigInteger.fromByteArrayUnsigned(buffer)
}

module.exports = BigInteger
