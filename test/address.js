/* global describe, it */

var assert = require('assert')
var baddress = require('../src/address')
var networks = require('../src/networks')
var bscript = require('../src/script')
var fixtures = require('./fixtures/address.json')

describe('address', function () {
  describe('fromBase58Check', function () {
    fixtures.standard.forEach(function (f) {
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
    fixtures.bech32.forEach((f) => {
      it('encodes ' + f.address, function () {
        var actual = baddress.fromBech32(f.address)

        assert.strictEqual(actual.prefix, f.prefix)
        assert.strictEqual(actual.program.toString('hex'), f.program)
        assert.strictEqual(actual.version, f.version)
      })
    })

    fixtures.invalid.bech32.forEach((f, i) => {
      if (f.address === undefined) return

      it('decode fails for ' + f.address + '(' + f.exception + ')', function () {
        assert.throws(function () {
          baddress.fromBech32(f.address, f.prefix)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('fromOutputScript', function () {
    fixtures.standard.forEach(function (f) {
      it('parses ' + f.script.slice(0, 30) + '... (' + f.network + ')', function () {
        var script = bscript.fromASM(f.script)
        var address = baddress.fromOutputScript(script, networks[f.network])

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
    fixtures.standard.forEach(function (f) {
      it('formats ' + f.hash + ' (' + f.network + ')', function () {
        var address = baddress.toBase58Check(Buffer.from(f.hash, 'hex'), f.version)

        assert.strictEqual(address, f.base58check)
      })
    })
  })

  describe('toBech32', function () {
    fixtures.bech32.forEach((f, i) => {
      // unlike the reference impl., we don't support mixed/uppercase
      var string = f.address.toLowerCase()
      var program = Buffer.from(f.program, 'hex')

      it('encode ' + string, function () {
        assert.deepEqual(baddress.toBech32(f.prefix, f.version, program), string)
      })
    })

    fixtures.invalid.bech32.forEach((f, i) => {
      if (!f.prefix || f.version === undefined || f.program === undefined) return

      it('encode fails (' + f.exception, function () {
        assert.throws(function () {
          baddress.toBech32(f.prefix, f.version, Buffer.from(f.program, 'hex'))
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toOutputScript', function () {
    fixtures.standard.forEach(function (f) {
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
