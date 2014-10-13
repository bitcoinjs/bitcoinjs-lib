var assert = require('assert')
var networks = require('../src/networks')

var BigInteger = require('bigi')
var ECPair = require('../src/ecpair')
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
    it('accepts an Address object', function() {
      var f = fixtures.valid.verify[0]
      var network = networks[f.network]

      assert(Message.verify(f.address, f.signature, f.message, network))
    })

    fixtures.valid.verify.forEach(function(f) {
      it('verifies a valid signature for \"' + f.message + '\" (' + f.network + ')', function() {
        var network = networks[f.network]

        assert(Message.verify(f.address, f.signature, f.message, network))

        if (f.compressed) {
          assert(Message.verify(f.compressed.address, f.compressed.signature, f.message, network))
        }
      })
    })

    fixtures.invalid.verify.forEach(function(f) {
      it(f.description, function() {
        assert(!Message.verify(f.address, f.signature, f.message))
      })
    })
  })

  describe('signing', function() {
    fixtures.valid.signing.forEach(function(f) {
      it(f.description, function() {
        var network = networks[f.network]

        var keyPair = new ECPair(new BigInteger(f.d), null, { compressed: false })
        var signature = Message.sign(keyPair, f.message, network)
        assert.equal(signature.toString('base64'), f.signature)

        if (f.compressed) {
          var compressedPrivKey = new ECPair(new BigInteger(f.d))
          var compressedSignature = Message.sign(compressedPrivKey, f.message)

          assert.equal(compressedSignature.toString('base64'), f.compressed.signature)
        }
      })
    })
  })
})
