var assert = require('assert')
var crypto = require('../src/crypto')

var fixtures = require('./fixtures/crypto.json')

describe('Crypto', function() {
  describe('HASH160', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.hash160(data).toString('hex')

        assert.equal(actual, fixtures.after.hash160[i])
      })
    })
  })

  describe('HASH256', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.hash256(data).toString('hex')

        assert.equal(actual, fixtures.after.hash256[i])
      })
    })
  })

  describe('RIPEMD160', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.ripemd160(data).toString('hex')

        assert.equal(actual, fixtures.after.ripemd160[i])
      })
    })
  })

  describe('SHA1', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.sha1(data).toString('hex')

        assert.equal(actual, fixtures.after.sha1[i])
      })
    })
  })

  describe('SHA256', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.sha256(data).toString('hex')

        assert.equal(actual, fixtures.after.sha256[i])
      })
    })
  })
})
