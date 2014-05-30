var assert = require('assert')
var base58 = require('../src/base58')

var fixtures = require('./fixtures/base58.json')

describe('base58', function() {
  describe('decode', function() {
    it('can decode Bitcoin core test data', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58.decode(f.string)
        var expected = f.hex

        assert.strictEqual(actual.toString('hex'), expected)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        assert.throws(function() {
          base58.decode(f.string)
        }, /Non-base58 character/)
      })
    })
  })

  describe('encode', function() {
    it('can encode Bitcoin core test data', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58.encode(new Buffer(f.hex, 'hex'))
        var expected = f.string.trim()

        assert.strictEqual(actual, expected)
      })
    })
  })
})
