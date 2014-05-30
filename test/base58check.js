var assert = require('assert')
var base58check = require('../src/base58check')

var fixtures = require('./fixtures/base58check.json')

function h2b(h) { return new Buffer(h, 'hex') }

describe('base58check', function() {
  describe('decode', function() {
    fixtures.valid.forEach(function(f) {
      it('can decode ' + f.string, function() {
        var actual = base58check.decode(f.string)
        var expected = {
          version: f.decode.version,
          payload: h2b(f.decode.payload),
          checksum: h2b(f.decode.checksum)
        }

        assert.deepEqual(actual, expected)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        assert.throws(function() {
          base58check.decode(f.string)
        }, /Invalid checksum/)
      })
    })
  })

  describe('encode', function() {
    fixtures.valid.forEach(function(f) {
      it('can encode ' + f.string, function() {
        var actual = base58check.encode(h2b(f.decode.payload), f.decode.version)
        var expected = f.string

        assert.strictEqual(actual, expected)
      })
    })
  })
})

