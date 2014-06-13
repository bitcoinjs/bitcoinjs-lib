var assert = require('assert')
var networks = require('../src/networks')

var Address = require('../src/address')
var Script = require('../src/script')

var fixtures = require('./fixtures/address.json')

describe('Address', function() {
  describe('Constructor', function() {
    it('does not mutate the input', function() {
      fixtures.valid.forEach(function(f) {
        var hash = new Buffer(f.hex, 'hex')
        var addr = new Address(hash, f.version)

        assert.equal(addr.version, f.version)
        assert.equal(addr.hash.toString('hex'), f.hex)
      })
    })
  })

  describe('fromBase58Check', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.description + '(' + f.network + ') correctly', function() {
        var addr = Address.fromBase58Check(f.base58check)

        assert.equal(addr.version, f.version)
        assert.equal(addr.hash.toString('hex'), f.hex)
      })
    })

    fixtures.invalid.fromBase58Check.forEach(function(f) {
      it('throws on ' + f.description, function() {
        assert.throws(function() {
          Address.fromBase58Check(f.base58check)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('fromOutputScript', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.description + '(' + f.network + ') correctly', function() {
        var script = Script.fromHex(f.script)
        var addr = Address.fromOutputScript(script, networks[f.network])

        assert.equal(addr.version, f.version)
        assert.equal(addr.hash.toString('hex'), f.hex)
      })
    })

    fixtures.invalid.fromOutputScript.forEach(function(f) {
      it('throws when ' + f.description, function() {
        var script = Script.fromHex(f.hex)

        assert.throws(function() {
          Address.fromOutputScript(script)
        }, new RegExp(f.description))
      })
    })
  })

  describe('toBase58Check', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.description + '(' + f.network + ') correctly', function() {
        var addr = Address.fromBase58Check(f.base58check)
        var result = addr.toBase58Check()

        assert.equal(result, f.base58check)
      })
    })
  })

  describe('toOutputScript', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.description + '(' + f.network + ') correctly', function() {
        var addr = Address.fromBase58Check(f.base58check)
        var script = addr.toOutputScript()

        assert.equal(script.toHex(), f.script)
      })
    })

    fixtures.invalid.toOutputScript.forEach(function(f) {
      it('throws when ' + f.description, function() {
        var addr = new Address(new Buffer(f.hex, 'hex'), f.version)

        assert.throws(function() {
          addr.toOutputScript()
        }, new RegExp(f.description))
      })
    })
  })
})
