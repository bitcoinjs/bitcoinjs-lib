var assert = require('assert')
var BigInteger = require('../').BigInteger

var fixtures = require('./fixtures/bigi')

describe('BigInteger', function() {
  describe('fromBuffer/fromHex', function() {
    it('should match the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        assert.equal(BigInteger.fromHex(f.hex).toString(), f.dec)
        assert.equal(BigInteger.fromHex(f.hexPadded).toString(), f.dec)
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
        var bi = new BigInteger(f.dec)

        assert.equal(bi.toHex(), f.hex)
        assert.equal(bi.toHex(32), f.hexPadded)
      })
    })

    it('throws on non-finite padding value', function() {
        var bi = new BigInteger('1')

        assert.throws(function() { bi.toHex({}) })
        assert.throws(function() { bi.toHex([]) })
        assert.throws(function() { bi.toHex('') })
        assert.throws(function() { bi.toHex(0 / 0) })
        assert.throws(function() { bi.toHex(1 / 0) })
    })
  })
})

module.exports = BigInteger
