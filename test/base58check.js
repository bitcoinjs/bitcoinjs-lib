var assert = require('assert')
var base58check = require('../').base58check

var fixtures = require('./fixtures/base58')

describe('base58check', function() {
  describe('decode', function() {
    it('decodes the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58check.decode(f.encoded.string)
        var expected = f.decoded

        assert.deepEqual({
          version: actual.version,
          payload: actual.payload.toString('hex'),
          checksum: actual.checksum.toString('hex')
        }, expected)
      })
    })

    it('throws on invalid strings', function() {
      fixtures.invalid.forEach(function(f) {
        assert.throws(function() {
          base58check.decode(f)
        })
      })
    })
  })

  describe('encode', function() {
    it('encodes the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58check.encode(
          new Buffer(f.decoded.payload, 'hex'),
          f.decoded.version
        )
        var expected = f.encoded.string

        assert.equal(actual, expected)
      })
    })
  })
})
