/* global describe, it */

var assert = require('assert')
var bscriptSig = require('../src/script').signature
var Buffer = require('safe-buffer').Buffer
var fixtures = require('./fixtures/signature.json')

describe('Script Signatures', function () {
  function fromRaw (signature) {
    return Buffer.concat([
      Buffer.from(signature.r, 'hex'),
      Buffer.from(signature.s, 'hex')
    ], 64)
  }

  function toRaw (signature) {
    return {
      r: signature.slice(0, 32).toString('hex'),
      s: signature.slice(32, 64).toString('hex')
    }
  }

  describe('encode', function () {
    fixtures.valid.forEach(function (f) {
      it('encodes ' + f.hex, function () {
        var buffer = bscriptSig.encode(fromRaw(f.raw), f.hashType)

        assert.strictEqual(buffer.toString('hex'), f.hex)
      })
    })

    fixtures.invalid.forEach(function (f) {
      if (!f.raw) return

      it('throws ' + f.exception, function () {
        var signature = fromRaw(f.raw)

        assert.throws(function () {
          bscriptSig.encode(signature, f.hashType)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('decode', function () {
    fixtures.valid.forEach(function (f) {
      it('decodes ' + f.hex, function () {
        var decode = bscriptSig.decode(Buffer.from(f.hex, 'hex'))

        assert.deepEqual(toRaw(decode.signature), f.raw)
        assert.strictEqual(decode.hashType, f.hashType)
      })
    })

    fixtures.invalid.forEach(function (f) {
      it('throws on ' + f.hex, function () {
        var buffer = Buffer.from(f.hex, 'hex')

        assert.throws(function () {
          bscriptSig.decode(buffer)
        }, new RegExp(f.exception))
      })
    })
  })
})
