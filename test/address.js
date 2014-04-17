var assert = require('assert')

var Address = require('..').Address
var ECPubKey = require('..').ECPubKey
var base58check = require('..').base58check

var fixtures = require('./fixtures/address')

describe('Address', function() {
  var bothVectors = fixtures.pubKeyHash.concat(fixtures.scriptHash)

  describe('Constructor', function() {
    it('matches the test vectors', function() {
      bothVectors.forEach(function(f) {
        var hash = new Buffer(f.hex, 'hex')
        var addr = new Address(hash, f.version)

        assert.equal(addr.version, f.version)
        assert.equal(addr.hash.toString('hex'), f.hex)
      })
    })
  })

  describe('fromBase58Check', function() {
    it('throws on invalid base58check', function() {
      fixtures.malformed.forEach(function(f) {
        assert.throws(function() {
          Address.fromBase58Check(f.base58check)
        })
      })
    })

    it('output matches the test vectors', function() {
      bothVectors.forEach(function(f) {
        var addr = Address.fromBase58Check(f.base58check)

        assert.equal(addr.version, f.version)
        assert.equal(addr.hash.toString('hex'), f.hex)
      })
    })
  })

  describe('fromPubKey', function() {
    it('output matches the test vectors', function() {
      fixtures.pubKeyHash.forEach(function(f) {
        var pub = ECPubKey.fromBuffer(new Buffer(f.pubKey, 'hex'))
        var addr = Address.fromPubKey(pub, f.version)

        assert.equal(addr.version, f.version)
        assert.equal(addr.hash.toString('hex'), f.hex)
      })
    })
  })

  describe('toBase58Check', function() {
    it('output matches the test vectors', function() {
      bothVectors.forEach(function(f) {
        var addr = Address.fromBase58Check(f.base58check)
        var base58check = addr.toBase58Check()

        assert.equal(base58check, f.base58check)
      })
    })
  })
})
