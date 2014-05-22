var assert = require('assert')
var networks = require('../src/networks')

var BigInteger = require('bigi')
var ECKey = require('../src/eckey')
var Message = require('../src/message')

var fixtures = require('./fixtures/message.json')

describe('Message', function() {
  describe('magicHash', function() {
    it('matches the test vectors', function() {
      fixtures.valid.magicHash.forEach(function(f) {
        var network = networks[f.network]
        var actual = Message.magicHash(f.message, network)

        assert.equal(actual.toString('hex'), f.magicHash)
      })
    })
  })

  describe('verify', function() {
    it('verifies a valid signature', function() {
      fixtures.valid.verify.forEach(function(f) {
        var network = networks[f.network]

        var s1 = new Buffer(f.signature, 'base64')
        assert.ok(Message.verify(f.address, s1, f.message, network))

        if (f.compressed) {
          var s2 = new Buffer(f.compressed.signature, 'base64')

          assert.ok(Message.verify(f.compressed.address, s2, f.message, network))
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

        var k1 = new ECKey(new BigInteger(f.D), false)
        var s1 = Message.sign(k1, f.message, network)
        assert.equal(s1.toString('base64'), f.signature)

        if (f.compressed) {
          var k2 = new ECKey(new BigInteger(f.D))
          var s2 = Message.sign(k2, f.message)

          assert.equal(s2.toString('base64'), f.compressed.signature)
        }
      })
    })
  })
})
