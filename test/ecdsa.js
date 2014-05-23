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
        var D = BigInteger.fromHex(f.D)
        var h1 = crypto.sha256(f.message)

        var k = ecdsa.deterministicGenerateK(ecparams, h1, D)
        assert.equal(k.toHex(), f.k)
      })
    })
  })

  describe('recoverPubKey', function() {
    it('succesfully recovers a public key', function() {
      var D = BigInteger.ONE
      var signature = new Buffer('INcvXVVEFyIfHLbDX+xoxlKFn3Wzj9g0UbhObXdMq+YMKC252o5RHFr0/cKdQe1WsBLUBi4morhgZ77obDJVuV0=', 'base64')

      var Q = ecparams.getG().multiply(D)
      var hash = message.magicHash('1111', networks.bitcoin)
      var e = BigInteger.fromBuffer(hash)
      var psig = ecdsa.parseSigCompact(signature)

      var Qprime = ecdsa.recoverPubKey(ecparams, e, psig.r, psig.s, psig.i)
      assert(Q.equals(Qprime))
    })
  })

  describe('sign', function() {
    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var D = BigInteger.fromHex(f.D)
        var hash = crypto.sha256(f.message)
        var sig = ecdsa.sign(ecparams, hash, D)

        assert.equal(sig.r.toString(), f.signature.r)
        assert.equal(sig.s.toString(), f.signature.s)
      })
    })

    it('should sign with low S value', function() {
      var hash = crypto.sha256('Vires in numeris')
      var sig = ecdsa.sign(ecparams, hash, BigInteger.ONE)

      // See BIP62 for more information
      var N_OVER_TWO = ecparams.getN().shiftRight(1)
      assert(sig.s.compareTo(N_OVER_TWO) <= 0)
    })
  })

  describe('verifyRaw', function() {
    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var D = BigInteger.fromHex(f.D)
        var Q = ecparams.getG().multiply(D)

        var r = new BigInteger(f.signature.r)
        var s = new BigInteger(f.signature.s)
        var e = BigInteger.fromBuffer(crypto.sha256(f.message))

        assert(ecdsa.verifyRaw(ecparams, e, r, s, Q))
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
        assert.equal(signature.i, f.signature.i)
        assert.equal(signature.compressed, f.signature.compressed)
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
