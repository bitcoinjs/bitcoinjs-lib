var assert = require('assert')
var crypto = require('../').crypto
var ecdsa = require('..').ecdsa
var sec = require('..').sec
var ecparams = sec("secp256k1")

var BigInteger = require('..').BigInteger
var ECKey = require('..').ECKey
var ECPubKey = require('..').ECPubKey
var Message = require('..').Message

var fixtures = require('./fixtures/ecdsa.js')

describe('ecdsa', function() {
  describe('deterministicGenerateK', function() {
    it('matches the test vectors', function() {
      fixtures.forEach(function(f) {
        var priv = BigInteger.fromHex(f.privateKey)
        var h1 = crypto.sha256(f.message)

        var k = ecdsa.deterministicGenerateK(h1, priv)
        assert.deepEqual(k.toHex(), f.k)
      })
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

  describe('sign', function() {
    it('matches the test vectors', function() {
      fixtures.forEach(function(f) {
        var priv = ECKey.fromHex(f.privateKey)
        var hash = crypto.sha256(f.message)
        var sig = ecdsa.parseSig(priv.sign(hash))

        assert.equal(sig.r.toHex(), f.signature.slice(0, 64))
        assert.equal(sig.s.toHex(), f.signature.slice(64))
      })
    })

    it('should sign with low S value', function() {
      var priv = ECKey.fromHex('ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458')
      var hash = crypto.sha256('Vires in numeris')
      var signature = priv.sign(hash)
      var psig = ecdsa.parseSig(signature)

      // See BIP62 for more information
      assert(psig.s.compareTo(ecparams.getN().divide(BigInteger.valueOf(2))) <= 0)
    })
  })

  describe('verifyRaw', function() {
    it('matches the test vectors', function() {
      fixtures.forEach(function(f) {
        var priv = ECKey.fromHex(f.privateKey)

        var r = BigInteger.fromHex(f.signature.slice(0, 64))
        var s = BigInteger.fromHex(f.signature.slice(64))
        var e = BigInteger.fromBuffer(crypto.sha256(f.message))

        assert(ecdsa.verifyRaw(e, r, s, priv.pub.Q))
      })
    })
  })
})
