var assert = require('assert')
var base58 = require('../').base58
var fixtures = require('./fixtures/base58')

function b2h(b) { return new Buffer(b).toString('hex') }
function h2b(h) { return new Buffer(h, 'hex') }

describe('base58', function() {
  describe('decode', function() {
    it('can decode Bitcoin core test data', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58.decode(f.string)
        var expected = f.hex

        assert.strictEqual(b2h(actual), expected)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        assert.throws(function() {
          base58.decode(f.string)
        })
      })
    })
  })

  describe('encode', function() {
    it('can encode Bitcoin core test data', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58.encode(h2b(f.hex))
        var expected = f.string.trim()

        assert.strictEqual(actual, expected)
      })
    })
  })
})
