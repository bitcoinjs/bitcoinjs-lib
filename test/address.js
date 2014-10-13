var assert = require('assert')
var networks = require('../src/networks')

var Address = require('../src/address')
var Script = require('../src/script')

var fixtures = require('./fixtures/address.json')

describe('Address', function() {
  describe('fromOutputScript', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.description + '(' + f.network + ') correctly', function() {
        var script = Script.fromHex(f.script)
        var addr = Address.fromOutputScript(script, networks[f.network])

        assert.equal(addr, f.address)
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

  describe('toOutputScript', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.description + '(' + f.network + ') correctly', function() {
        var script = Address.toOutputScript(f.address)

        assert.equal(script.toHex(), f.script)
      })
    })

    fixtures.invalid.toOutputScript.forEach(function(f) {
      it('throws when ' + f.description, function() {
        assert.throws(function() {
          Address.toOutputScript(f.address)
        }, new RegExp(f.description))
      })
    })
  })
})
