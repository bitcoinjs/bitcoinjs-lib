var assert = require('assert')
var crypto = require('../').crypto
var ecdsa = require('..').ecdsa
var sec = require('..').sec
var ecparams = sec("secp256k1")

var BigInteger = require('..').BigInteger
var ECKey = require('..').ECKey
var ECPubKey = require('..').ECPubKey
var Message = require('..').Message

describe('ecdsa', function() {
  // FIXME: needs much better tests than this
  describe('deterministicGenerateK', function() {
    it('produces deterministic K values', function() {
      var secret = [4]

      var k1 = ecdsa.deterministicGenerateK([1], secret)
      var k2 = ecdsa.deterministicGenerateK([2], secret)

      assert.notDeepEqual(k1, k2)
    })
  })

  describe('recoverPubKey', function() {
    it('succesfully recovers a public key', function() {
      var addr = 'mgQK8S6CfSXKjPmnujArSmVxafeJfrZsa3'
      var signature = new Buffer('H0PG6+PUo96UPTJ/DVj8aBU5it+Nuli4YdsLuTMvfJxoHH9Jb7jYTQXCCOX2jrTChD5S1ic3vCrUQHdmB5/sEQY=', 'base64')
      var obj = ecdsa.parseSigCompact(signature)
      var pubKey = new ECPubKey(ecdsa.recoverPubKey(obj.r, obj.s, Message.magicHash('1111'), obj.i))

      assert.equal(pubKey.toHex(), '02e8fcf4d749b35879bc1f3b14b49e67ab7301da3558c5a9b74a54f1e6339c334c')
    })
  })

  describe('sign/verify', function() {
    it('Signing and Verifying', function () {
      var s1 = ECKey.makeRandom()
      var sig_a = s1.sign([0])

      assert.ok(sig_a, 'Sign null')
      assert.ok(s1.pub.verify([0], sig_a))

      var message = new Buffer(1024) // More or less random :P
      var hash = crypto.sha256(message)
      var sig_b = s1.sign(hash)
      assert.ok(sig_b, 'Sign random string')
      assert.ok(s1.pub.verify(hash, sig_b))

      var message2 = new Buffer(
        '12dce2c169986b3346827ffb2305cf393984627f5f9722a1b1368e933c8d' +
        'd296653fbe5d7ac031c4962ad0eb1c4298c3b91d244e1116b4a76a130c13' +
        '1e7aec7fa70184a71a2e66797052831511b93c6e8d72ae58a1980eaacb66' +
        '8a33f50d7cefb96a5dab897b5efcb99cbafb0d777cb83fc9b2115b69c0fa' +
        '3d82507b932b84e4', 'hex')

      var hash2 = crypto.sha256(message2)

      var sig_c = new Buffer(
        '3044022038d9b8dd5c9fbf330565c1f51d72a59ba869aeb2c2001be959d3' +
        '79e861ec71960220a73945f32cf90d03127d2c3410d16cee120fa1a4b4c3' +
        'f273ab082801a95506c4', 'hex')

      var s2 = new Buffer(
        '045a1594316e433fb91f35ef4874610d22177c3f1a1060f6c1e70a609d51' +
        'b20be5795cd2a5eae0d6b872ba42db95e9afaeea3fbb89e98099575b6828' +
        '609a978528', 'hex')

      assert.ok(ecdsa.verify(hash2, sig_c, s2), 'Verify constant signature')
    })

    it('should sign with low S value', function() {
      var priv = ECKey.fromHex('ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458')
      var message = new Buffer('Vires in numeris')
      var signature = priv.sign(message)
      var parsed = ecdsa.parseSig(signature)

      // Check that the 's' value is 'low', to prevent possible transaction malleability as per
      // https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki#low-s-values-in-signatures
      assert.ok(parsed.s.compareTo(ecparams.getN().divide(BigInteger.valueOf(2))) <= 0)

      assert.ok(priv.pub.verify(message, signature))
    })
  })
})
