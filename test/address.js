/* global describe, it */

var assert = require('assert')
var baddress = require('../src/address')
var networks = require('../src/networks')
var bscript = require('../src/script')
var fixtures = require('./fixtures/address.json')

describe('address', function () {
  describe('fromBase58Check', function () {
    fixtures.valid.forEach(function (f) {
      it('decodes ' + f.base58check, function () {
        var decode = baddress.fromBase58Check(f.base58check)

        assert.strictEqual(decode.version, f.version)
        assert.strictEqual(decode.hash.toString('hex'), f.hash)
      })
    })

    fixtures.invalid.fromBase58Check.forEach(function (f) {
      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          baddress.fromBase58Check(f.address)
        }, new RegExp(f.address + ' ' + f.exception))
      })
    })
  })

  describe('fromOutputScript', function () {
    fixtures.valid.forEach(function (f) {
      it('parses ' + f.script.slice(0, 30) + '... (' + f.network + ')', function () {
        var script = bscript.fromASM(f.script)
        var address = baddress.fromOutputScript(script, networks[f.network])

        assert.strictEqual(address, f.base58check)
      })
    })

    fixtures.valid.forEach(function (f) {
      it('parses (as chunks) ' + f.script.slice(0, 30) + '... (' + f.network + ')', function () {
        var chunks = bscript.decompile(bscript.fromASM(f.script))
        var address = baddress.fromOutputScript(chunks, networks[f.network])

        assert.strictEqual(address, f.base58check)
      })
    })

    fixtures.invalid.fromOutputScript.forEach(function (f) {
      it('throws when ' + f.script.slice(0, 30) + '... ' + f.exception, function () {
        var script = bscript.fromASM(f.script)

        assert.throws(function () {
          baddress.fromOutputScript(script)
        }, new RegExp(f.script + ' ' + f.exception))
      })
    })
  })

  describe('toBase58Check', function () {
    fixtures.valid.forEach(function (f) {
      it('formats ' + f.hash + ' (' + f.network + ')', function () {
        var address = baddress.toBase58Check(new Buffer(f.hash, 'hex'), f.version)

        assert.strictEqual(address, f.base58check)
      })
    })
  })

  describe('toOutputScript', function () {
    fixtures.valid.forEach(function (f) {
      var network = networks[f.network]

      it('exports ' + f.script.slice(0, 30) + '... (' + f.network + ')', function () {
        var script = baddress.toOutputScript(f.base58check, network)

        assert.strictEqual(bscript.toASM(script), f.script)
      })
    })

    fixtures.invalid.toOutputScript.forEach(function (f) {
      it('throws when ' + f.exception, function () {
        assert.throws(function () {
          baddress.toOutputScript(f.address)
        }, new RegExp(f.address + ' ' + f.exception))
      })
    })
  })
})
