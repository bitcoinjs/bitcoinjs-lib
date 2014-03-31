var assert = require('assert')
var BigInteger = require('../src/jsbn/jsbn.js')
var bytesToHex = require('../src/convert.js').bytesToHex
var secureRandom = require('secure-random')

describe('BigInteger', function() {
  describe('toByteArraySigned', function() {
    it('handles examples', function() {
      function hex(num) {
        var bytes = BigInteger.valueOf(num).toByteArraySigned()
        var h = bytesToHex(bytes)
        return '0x' + h
      }

      assert.equal(hex( 0), '0x')
      assert.equal(hex( 1), '0x01')
      assert.equal(hex(-1), '0x81')
      assert.equal(hex( 127), '0x7f')
      assert.equal(hex(-127), '0xff')
      assert.equal(hex( 255), '0x00ff')
      assert.equal(hex(-255), '0x80ff')
      assert.equal(hex( 16300),  '0x3fac')
      assert.equal(hex(-16300), '0xbfac')
      assert.equal(hex( 62300), '0x00f35c')
      assert.equal(hex(-62300), '0x80f35c')
    })
  })

  describe('with RNG passed into constructor as the 2nd argument', function(){
    it('returns a BigInteger with the limit of the specified length', function(){
      var bitLength = 256
      var i = new BigInteger(bitLength, secureRandom)
      assert(i.bitLength() <= 256)
    })
  })
})
