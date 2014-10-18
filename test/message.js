var assert = require('assert')
var message = require('../src/message')
var networks = require('../src/networks')

var Address = require('../src/address')
var BigInteger = require('bigi')
var ECKey = require('../src/eckey')

var fixtures = require('./fixtures/message.json')

describe('message', function() {
  describe('magicHash', function() {
    fixtures.valid.magicHash.forEach(function(f) {
      it('produces the correct magicHash for \"' + f.message + '\" (' + f.network + ')', function() {
        var network = networks[f.network]
        var actual = message.magicHash(f.message, network)

        assert.equal(actual.toString('hex'), f.magicHash)
      })
    })
  })

  describe('verify', function() {
    it('accepts an Address object', function() {
      var f = fixtures.valid.verify[0]
      var network = networks[f.network]

      var address = Address.fromBase58Check(f.address)
      assert(message.verify(address, f.signature, f.message, network))
    })

    fixtures.valid.verify.forEach(function(f) {
      it('verifies a valid signature for \"' + f.message + '\" (' + f.network + ')', function() {
        var network = networks[f.network]

        assert(message.verify(f.address, f.signature, f.message, network))

        if (f.compressed) {
          assert(message.verify(f.compressed.address, f.compressed.signature, f.message, network))
        }
      })
    })

    fixtures.invalid.verify.forEach(function(f) {
      it(f.description, function() {
        assert(!message.verify(f.address, f.signature, f.message))
      })
    })
  })

  describe('signing', function() {
    fixtures.valid.signing.forEach(function(f) {
      it(f.description, function() {
        var network = networks[f.network]

        var privKey = new ECKey(new BigInteger(f.d), false)
        var signature = message.sign(privKey, f.message, network)
        assert.equal(signature.toString('base64'), f.signature)

        if (f.compressed) {
          var compressedPrivKey = new ECKey(new BigInteger(f.d))
          var compressedSignature = message.sign(compressedPrivKey, f.message)

          assert.equal(compressedSignature.toString('base64'), f.compressed.signature)
        }
      })
    })
  })
})
