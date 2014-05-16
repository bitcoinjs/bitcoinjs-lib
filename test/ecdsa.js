var assert = require('assert')
var crypto = require('../src/crypto')
var ecdsa = require('../src/ecdsa')
var message = require('../src/message')
var networks = require('../src/networks')

var sec = require('../src/sec')
var ecparams = sec("secp256k1")

var BigInteger = require('bigi')
var ECKey = require('../src/eckey')
var ECPubKey = require('../src/ecpubkey')

var fixtures = require('./fixtures/ecdsa.js')

describe('ecdsa', function() {
  describe('deterministicGenerateK', function() {
    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var priv = BigInteger.fromHex(f.D)
        var h1 = crypto.sha256(f.message)

        var k = ecdsa.deterministicGenerateK(h1, priv)
        assert.equal(k.toHex(), f.k)
      })
    })
  })

  describe('recoverPubKey', function() {
    it('succesfully recovers a public key', function() {
      var signature = new Buffer('H0PG6+PUo96UPTJ/DVj8aBU5it+Nuli4YdsLuTMvfJxoHH9Jb7jYTQXCCOX2jrTChD5S1ic3vCrUQHdmB5/sEQY=', 'base64')

      var obj = ecdsa.parseSigCompact(signature)
      var hash = message.magicHash('1111', networks.bitcoin)

      var pubKey = new ECPubKey(ecdsa.recoverPubKey(obj.r, obj.s, hash, obj.i))

      assert.equal(pubKey.toHex(), '02e8fcf4d749b35879bc1f3b14b49e67ab7301da3558c5a9b74a54f1e6339c334c')
    })
  })

  describe('sign', function() {
    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var D = BigInteger.fromHex(f.D)
        var priv = new ECKey(D)
        var hash = crypto.sha256(f.message)
        var sig = ecdsa.parseSig(priv.sign(hash))

        assert.equal(sig.r.toString(), f.signature.r)
        assert.equal(sig.s.toString(), f.signature.s)
      })
    })

    it('should sign with low S value', function() {
      var priv = ECKey.makeRandom()
      var hash = crypto.sha256('Vires in numeris')
      var signature = priv.sign(hash)
      var psig = ecdsa.parseSig(signature)

      // See BIP62 for more information
      assert(psig.s.compareTo(ecparams.getN().divide(BigInteger.valueOf(2))) <= 0)
    })
  })

  describe('verifyRaw', function() {
    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var D = BigInteger.fromHex(f.D)
        var priv = new ECKey(D)

        var r = new BigInteger(f.signature.r)
        var s = new BigInteger(f.signature.s)
        var e = BigInteger.fromBuffer(crypto.sha256(f.message))

        assert(ecdsa.verifyRaw(e, r, s, priv.pub.Q))
      })
    })
  })

  describe('serializeSig', function() {
    it('encodes a DER signature', function() {
      fixtures.valid.forEach(function(f) {
        var r = new BigInteger(f.signature.r)
        var s = new BigInteger(f.signature.s)

        var signature = new Buffer(ecdsa.serializeSig(r, s))
        assert.equal(signature.toString('hex'), f.DER)
      })
    })
  })

  describe('parseSig', function() {
    it('decodes the correct signature', function() {
      fixtures.valid.forEach(function(f) {
        var buffer = new Buffer(f.DER, 'hex')
        var signature = ecdsa.parseSig(buffer)

        assert.equal(signature.r.toString(), f.signature.r)
        assert.equal(signature.s.toString(), f.signature.s)
      })
    })

    fixtures.invalid.DER.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var buffer = new Buffer(f.hex)

        assert.throws(function() {
          ecdsa.parseSig(buffer)
        })
      })
    })
  })

  describe('serializeSigCompact', function() {
    it('encodes a compact signature', function() {
      fixtures.valid.forEach(function(f) {
        var r = new BigInteger(f.signature.r)
        var s = new BigInteger(f.signature.s)
        var i = f.signature.i
        var compressed = f.signature.compressed

        var signature = ecdsa.serializeSigCompact(r, s, i, compressed)
        assert.equal(signature.toString('hex'), f.compact)
      })
    })
  })

  describe('parseSigCompact', function() {
    it('decodes the correct signature', function() {
      fixtures.valid.forEach(function(f) {
        var buffer = new Buffer(f.compact, 'hex')
        var signature = ecdsa.parseSigCompact(buffer)

        assert.equal(signature.r.toString(), f.signature.r)
        assert.equal(signature.s.toString(), f.signature.s)

        //TODO
//        assert.equal(signature.i, f.signature.i)
//        assert.equal(signature.compressed, f.publicKey.compressed)
      })
    })

    fixtures.invalid.compact.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var buffer = new Buffer(f.hex)

        assert.throws(function() {
          ecdsa.parseSigCompact(buffer)
        })
      })
    })
  })
})
