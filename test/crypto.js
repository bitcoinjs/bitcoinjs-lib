var assert = require('assert')
var crypto = require('../src/crypto')

var fixtures = require('./fixtures/crypto.json')

describe('Crypto', function() {
  describe('HASH160', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.hash160(data)
        var expected = fixtures.after.hash160[i]

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })

  describe('HASH256', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.hash256(data)
        var expected = fixtures.after.hash256[i]

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })

  describe('SHA1', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.sha1(data)
        var expected = fixtures.after.sha1[i]

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })

  describe('SHA256', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var actual = crypto.sha256(data)
        var expected = fixtures.after.sha256[i]

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })

  describe('HmacSHA256', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var secret = new Buffer(fixtures.before.secret)

        var actual = crypto.HmacSHA256(data, secret)
        var expected = fixtures.after.hmacsha256[i]

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })

  describe('HmacSHA512', function() {
    it('matches the test vectors', function() {
      fixtures.before.hex.forEach(function(hex, i) {
        var data = new Buffer(hex, 'hex')
        var secret = new Buffer(fixtures.before.secret)

        var actual = crypto.HmacSHA512(data, secret)
        var expected = fixtures.after.hmacsha512[i]

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })
})
