var assert = require('assert')
var base58check = require('..').base58check
var fixtures = require('./fixtures/base58check')

function b2h(b) { return new Buffer(b).toString('hex') }
function h2b(h) { return new Buffer(h, 'hex') }

describe('base58check', function() {
  describe('decode', function() {
    it('can decode Bitcoin core test data', function() {
      fixtures.valid.forEach(function(f) {
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
        })
      })
    })

    it('throws on [invalid] Bitcoin core test data', function() {
      fixtures.invalid2.forEach(function(f) {
        assert.throws(function() {
          base58check.decode(f.string)
        })
      })
    })
  })

  describe('encode', function() {
    it('can encode Bitcoin core test data', function() {
      fixtures.valid.forEach(function(f) {
        var actual = base58check.encode(h2b(f.decode.payload), f.decode.version)
        var expected = f.string

        assert.strictEqual(actual, expected)
      })
    })
  })
})

