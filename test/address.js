var assert = require('assert')
var networks = require('../src/networks')

var address = require('../src/address')
var Script = require('../src/script')

var fixtures = require('./fixtures/address.json')

describe('address', function() {
  describe('decode', function() {
    fixtures.valid.forEach(function(f) {
      it('decodes ' + f.address + ' correctly', function() {
        var decoded = address.decode(f.address)

        assert.equal(decoded.version, f.version)
        assert.equal(decoded.hash.toString('hex'), f.hash)
        assert.equal(decoded.network, networks[f.network])
      })
    })
  })

  describe('encode', function() {
    fixtures.valid.forEach(function(f) {
      it('encoded ' + f.address + ' correctly', function() {
        var result = address.encode(f.version, new Buffer(f.hash, 'hex'))

        assert.equal(result, f.address)
      })
    })
  })

  describe('fromOutputScript', function() {
    fixtures.valid.forEach(function(f) {
      it('transforms ' + f.script + ' (' + f.network + ') to ' + f.address, function() {
        var script = Script.fromHex(f.script)
        var addr = address.fromOutputScript(script, networks[f.network])

        assert.equal(addr, f.address)
      })
    })

    fixtures.invalid.fromOutputScript.forEach(function(f) {
      it('throws when ' + f.description, function() {
        var script = Script.fromHex(f.hex)

        assert.throws(function() {
          address.fromOutputScript(script)
        }, new RegExp(f.description))
      })
    })
  })

  describe('toOutputScript', function() {
    fixtures.valid.forEach(function(f) {
      it('transforms ' + f.address + ' to ' + f.script, function() {
        var script = address.toOutputScript(f.address)

        assert.equal(script.toHex(), f.script)
      })
    })

    fixtures.invalid.toOutputScript.forEach(function(f) {
      it('throws when ' + f.description, function() {
        assert.throws(function() {
          address.toOutputScript(f.address)
        }, new RegExp(f.description))
      })
    })
  })
})
