/* global describe, it */

var assert = require('assert')
var baddress = require('../src/address')
var networks = require('../src/networks')
var bscript = require('../src/script')
var fixtures = require('./fixtures/address.json')

describe('address', function () {
  describe('fromBase58Check', function () {
    fixtures.standard.forEach(function (f) {
      if (!f.base58check) return

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

  describe('fromBech32', function () {
    fixtures.standard.forEach((f) => {
      if (!f.bech32) return

      it('decodes ' + f.bech32, function () {
        var actual = baddress.fromBech32(f.bech32)

        assert.strictEqual(actual.version, f.version)
        assert.strictEqual(actual.prefix, networks[f.network].bech32)
        assert.strictEqual(actual.data.toString('hex'), f.data)
      })
    })

    fixtures.invalid.bech32.forEach((f, i) => {
      it('decode fails for ' + f.bech32 + '(' + f.exception + ')', function () {
        assert.throws(function () {
          baddress.fromBech32(f.address)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('fromOutputScript', function () {
    fixtures.standard.forEach(function (f) {
      it('encodes ' + f.script.slice(0, 30) + '... (' + f.network + ')', function () {
        var script = bscript.fromASM(f.script)
        var address = baddress.fromOutputScript(script, networks[f.network])

        assert.strictEqual(address, f.base58check || f.bech32.toLowerCase())
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
    fixtures.standard.forEach(function (f) {
      if (!f.base58check) return

      it('encodes ' + f.hash + ' (' + f.network + ')', function () {
        var address = baddress.toBase58Check(Buffer.from(f.hash, 'hex'), f.version)

        assert.strictEqual(address, f.base58check)
      })
    })
  })

  describe('toBech32', function () {
    fixtures.bech32.forEach((f, i) => {
      if (!f.bech32) return
      var data = Buffer.from(f.data, 'hex')

      it('encode ' + f.address, function () {
        assert.deepEqual(baddress.toBech32(data, f.version, f.prefix), f.address)
      })
    })

    fixtures.invalid.bech32.forEach((f, i) => {
      if (!f.prefix || f.version === undefined || f.data === undefined) return

      it('encode fails (' + f.exception, function () {
        assert.throws(function () {
          baddress.toBech32(Buffer.from(f.data, 'hex'), f.version, f.prefix)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toOutputScript', function () {
    fixtures.standard.forEach(function (f) {
      it('decodes ' + f.script.slice(0, 30) + '... (' + f.network + ')', function () {
        var script = baddress.toOutputScript(f.base58check || f.bech32, networks[f.network])

        assert.strictEqual(bscript.toASM(script), f.script)
      })
    })

    fixtures.invalid.toOutputScript.forEach(function (f) {
      it('throws when ' + f.exception, function () {
        assert.throws(function () {
          baddress.toOutputScript(f.address, f.network)
        }, new RegExp(f.address + ' ' + f.exception))
      })
    })
  })
})
