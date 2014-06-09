var assert = require('assert')
var networks = require('../src/networks')

var BigInteger = require('bigi')
var ECKey = require('../src/eckey')
var Message = require('../src/message')

var fixtures = require('./fixtures/message.json')

describe('Message', function() {
  describe('magicHash', function() {
    fixtures.valid.magicHash.forEach(function(f) {
      it('produces the correct magicHash for \"' + f.message + '\" (' + f.network + ')', function() {
        var network = networks[f.network]
        var actual = Message.magicHash(f.message, network)

        assert.equal(actual.toString('hex'), f.magicHash)
      })
    })
  })

  describe('verify', function() {
    fixtures.valid.verify.forEach(function(f) {
      it('verifies a valid signature for \"' + f.message + '\" (' + f.network + ')', function() {
        var network = networks[f.network]

        var signature = new Buffer(f.signature, 'base64')
        assert.ok(Message.verify(f.address, signature, f.message, network))

        if (f.compressed) {
          var compressedSignature = new Buffer(f.compressed.signature, 'base64')

          assert.ok(Message.verify(f.compressed.address, compressedSignature, f.message, network))
        }
      })
    })

    fixtures.invalid.verify.forEach(function(f) {
      it(f.description, function() {
        var signature = new Buffer(f.signature, 'base64')
        assert.ok(!Message.verify(f.address, signature, f.message))
      })
    })
  })

  describe('signing', function() {
    fixtures.valid.signing.forEach(function(f) {
      it(f.description, function() {
        var network = networks[f.network]

        var privKey = new ECKey(new BigInteger(f.d), false)
        var signature = Message.sign(privKey, f.message, network)
        assert.equal(signature.toString('base64'), f.signature)

        if (f.compressed) {
          var compressedPrivKey = new ECKey(new BigInteger(f.d))
          var compressedSignature = Message.sign(compressedPrivKey, f.message)

          assert.equal(compressedSignature.toString('base64'), f.compressed.signature)
        }
      })
    })
  })
})
