var assert = require('assert')
var convert = require('..').convert
var crypto = require('../').crypto
var ecdsa = require('..').ecdsa
var rng = require('secure-random')

var BigInteger = require('..').BigInteger
var ECKey = require('..').ECKey
var ECPubKey = require('..').ECPubKey
var Message = require('..').Message

describe('ecdsa', function() {
  describe('recoverPubKey', function() {
    it('succesfully recovers a public key', function() {
      var addr = 'mgQK8S6CfSXKjPmnujArSmVxafeJfrZsa3'
      var signature = convert.base64ToBytes('H0PG6+PUo96UPTJ/DVj8aBU5it+Nuli4YdsLuTMvfJxoHH9Jb7jYTQXCCOX2jrTChD5S1ic3vCrUQHdmB5/sEQY=')
      var obj = ecdsa.parseSigCompact(signature)
      var pubKey = new ECPubKey(ecdsa.recoverPubKey(obj.r, obj.s, Message.magicHash('1111'), obj.i))

      assert.equal(pubKey.toHex(true), '02e8fcf4d749b35879bc1f3b14b49e67ab7301da3558c5a9b74a54f1e6339c334c')
    })
  })

  describe('sign/verify', function() {
    it('Signing and Verifying', function () {
      var s1 = new ECKey()
      var sig_a = s1.sign(BigInteger.ZERO)

      assert.ok(sig_a, 'Sign null')
      assert.ok(s1.verify(BigInteger.ZERO, sig_a))

      var message = new BigInteger(1024, rng).toByteArrayUnsigned()
      var hash = crypto.sha256(message)
      var sig_b = s1.sign(hash)
      assert.ok(sig_b, 'Sign random string')
      assert.ok(s1.verify(hash, sig_b))

      var message2 = convert.hexToBytes(
        '12dce2c169986b3346827ffb2305cf393984627f5f9722a1b1368e933c8d' +
        'd296653fbe5d7ac031c4962ad0eb1c4298c3b91d244e1116b4a76a130c13' +
        '1e7aec7fa70184a71a2e66797052831511b93c6e8d72ae58a1980eaacb66' +
        '8a33f50d7cefb96a5dab897b5efcb99cbafb0d777cb83fc9b2115b69c0fa' +
        '3d82507b932b84e4')

      var hash2 = crypto.sha256(message2)

      var sig_c = convert.hexToBytes(
        '3044022038d9b8dd5c9fbf330565c1f51d72a59ba869aeb2c2001be959d3' +
        '79e861ec71960220a73945f32cf90d03127d2c3410d16cee120fa1a4b4c3' +
        'f273ab082801a95506c4')

      var s2 = convert.hexToBytes(
        '045a1594316e433fb91f35ef4874610d22177c3f1a1060f6c1e70a609d51' +
        'b20be5795cd2a5eae0d6b872ba42db95e9afaeea3fbb89e98099575b6828' +
        '609a978528')

      assert.ok(ecdsa.verify(hash2, sig_c, s2), 'Verify constant signature')
    })
  })
})
