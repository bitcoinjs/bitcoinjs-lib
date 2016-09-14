/* global describe, it */

var assert = require('assert')
var BN = require('bn.js')
var bscriptSignature = require('../src/script_signature')
var fixtures = require('./fixtures/script_signature.json')

describe('script-signature', function () {
  fixtures.valid.forEach(function (f) {
    it('encodes ' + f.hex, function () {
      var signature = {
        r: new BN(f.signature.r),
        s: new BN(f.signature.s)
      }
      var ss = bscriptSignature.encode(signature, f.hashType)

      assert.strictEqual(ss.toString('hex'), f.hex)
    })
  })

  fixtures.invalid.forEach(function (f) {
    if (!f.signature) return

    it('throws ' + f.exception, function () {
      var signature = {
        r: new BN(f.signature.r),
        s: new BN(f.signature.s)
      }

      assert.throws(function () {
        bscriptSignature.encode(signature, f.hashType)
      }, new RegExp(f.exception))
    })
  })

  fixtures.valid.forEach(function (f) {
    it('decodes ' + f.hex, function () {
      var buffer = new Buffer(f.hex, 'hex')
      var decode = bscriptSignature.decode(buffer)

      assert.strictEqual(decode.signature.r.toString(), f.signature.r)
      assert.strictEqual(decode.signature.s.toString(), f.signature.s)
      assert.strictEqual(decode.hashType, f.hashType)
    })
  })

  fixtures.invalid.forEach(function (f) {
    if (!f.hex) return

    it('throws on ' + f.hex, function () {
      var buffer = new Buffer(f.hex, 'hex')

      assert.throws(function () {
        bscriptSignature.decode(buffer)
      }, new RegExp(f.exception))
    })
  })
})
