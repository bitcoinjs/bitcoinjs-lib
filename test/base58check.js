var assert = require('assert')
var base58check = require('../src/base58check')

var fixtures = require('./fixtures/base58check.json')

function h2b(h) { return new Buffer(h, 'hex') }

describe('base58check', function() {
  describe('decode', function() {
    fixtures.valid.forEach(function(f) {
      it('can decode ' + f.string, function() {
        var actual = base58check.decode(f.string)
        var expected = h2b(f.payload)

        assert.deepEqual(actual, expected)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f, function() {
        assert.throws(function() {
          base58check.decode(f)
        }, /Invalid checksum/)
      })
    })
  })

  describe('encode', function() {
    fixtures.valid.forEach(function(f) {
      it('can encode ' + f.string, function() {
        var actual = base58check.encode(h2b(f.payload))
        var expected = f.string

        assert.strictEqual(actual, expected)
      })
    })
  })
})
