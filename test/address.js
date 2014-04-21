var assert = require('assert')
var Address = require('..').Address

var b58fixtures = require('./fixtures/base58')
var fixtures = require('./fixtures/address')

describe('Address', function() {
  var bothVectors = fixtures.pubKeyHash.concat(fixtures.scriptHash)

  describe('Constructor', function() {
    it('does not mutate the input', function() {
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
      b58fixtures.invalid.forEach(function(f) {
        assert.throws(function() {
          Address.fromBase58Check(f)
        })
      })
    })

    bothVectors.forEach(function(f) {
      it('imports ' + f.description + ' correctly', function() {
        var addr = Address.fromBase58Check(f.base58check)

        assert.equal(addr.version, f.version)
        assert.equal(addr.hash.toString('hex'), f.hex)
      })
    })
  })

  describe('toBase58Check', function() {
    bothVectors.forEach(function(f) {
      it('exports ' + f.description + ' correctly', function() {
        var addr = Address.fromBase58Check(f.base58check)
        var result = addr.toBase58Check()

        assert.equal(result, f.base58check)
      })
    })
  })
})
