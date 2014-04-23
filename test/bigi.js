var assert = require('assert')
var BigInteger = require('../').BigInteger

var fixtures = require('./fixtures/bigi')

describe('BigInteger', function() {
  describe('fromBuffer/fromHex', function() {
    it('should match the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        assert.deepEqual(BigInteger.fromHex(f.hex).toString(), f.dec)
        assert.deepEqual(BigInteger.fromHex(f.hexPadded).toString(), f.dec)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        assert.throws(function() {
          BigInteger.fromHex(f.string)
        })
      })
    })
  })

  describe('toBuffer/toHex', function() {
    it('should match the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var actualHex = new BigInteger(f.dec).toHex()

        assert.equal(actualHex, f.hex)
      })
    })
  })

  describe('toPaddedBuffer', function() {
    it('should match the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var actualBuf = new BigInteger(f.dec).toPaddedBuffer(32)

        assert.equal(actualBuf.length, 32)
        assert.equal(actualBuf.toString('hex'), f.hexPadded)
      })
    })
  })
})

module.exports = BigInteger
