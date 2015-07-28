/* global describe, it */

var assert = require('assert')
var message = require('../src/message')
var networks = require('../src/networks')

var BigInteger = require('bigi')
var ECPair = require('../src/ecpair')

var fixtures = require('./fixtures/message.json')

describe('message', function () {
  describe('magicHash', function () {
    fixtures.valid.magicHash.forEach(function (f) {
      it('produces the correct magicHash for "' + f.message + '" (' + f.network + ')', function () {
        var network = networks[f.network]
        var actual = message.magicHash(f.message, network)

        assert.strictEqual(actual.toString('hex'), f.magicHash)
      })
    })
  })

  describe('verify', function () {
    fixtures.valid.verify.forEach(function (f) {
      it('verifies a valid signature for "' + f.message + '" (' + f.network + ')', function () {
        var network = networks[f.network]

        assert(message.verify(f.address, f.signature, f.message, network))

        if (f.compressed) {
          assert(message.verify(f.compressed.address, f.compressed.signature, f.message, network))
        }
      })
    })

    fixtures.invalid.verify.forEach(function (f) {
      it(f.description, function () {
        assert(!message.verify(f.address, f.signature, f.message))
      })
    })
  })

  describe('signing', function () {
    fixtures.valid.signing.forEach(function (f) {
      it(f.description, function () {
        var network = networks[f.network]

        var keyPair = new ECPair(new BigInteger(f.d), null, {
          compressed: false
        })
        var signature = message.sign(keyPair, f.message, network)
        assert.strictEqual(signature.toString('base64'), f.signature)

        if (f.compressed) {
          var compressedPrivKey = new ECPair(new BigInteger(f.d))
          var compressedSignature = message.sign(compressedPrivKey, f.message)

          assert.strictEqual(compressedSignature.toString('base64'), f.compressed.signature)
        }
      })
    })
  })
})
