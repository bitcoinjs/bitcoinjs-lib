var assert = require('assert')
var base58 = require('../').base58

var fixtures = require('./fixtures/base58')

describe('base58', function() {
  describe('decode', function() {
    it('decodes the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58.decode(f.encoded.string)
        var expected = f.encoded.hex

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })

  describe('encode', function() {
    it('encodes the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58.encode(new Buffer(f.encoded.hex, 'hex'))
        var expected = f.encoded.string

        assert.equal(actual, expected)
      })
    })
  })
})
