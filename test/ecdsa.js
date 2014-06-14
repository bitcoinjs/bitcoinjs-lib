var assert = require('assert')
var crypto = require('../src/crypto')
var ecdsa = require('../src/ecdsa')
var message = require('../src/message')
var networks = require('../src/networks')

var BigInteger = require('bigi')

var ecurve = require('ecurve')
var curve = ecurve.getCurveByName('secp256k1')

var fixtures = require('./fixtures/ecdsa.json')

describe('ecdsa', function() {
  describe('deterministicGenerateK', function() {
    fixtures.valid.forEach(function(f) {
      it('determines k for \"' + f.message + '\"', function() {
        var d = BigInteger.fromHex(f.d)
        var h1 = crypto.sha256(f.message)

        var k = ecdsa.deterministicGenerateK(curve, h1, d)
        assert.equal(k.toHex(), f.k)
      })
    })
  })

  describe('recoverPubKey', function() {
    it('succesfully recovers a public key', function() {
      var d = BigInteger.ONE
      var signature = new Buffer('INcvXVVEFyIfHLbDX+xoxlKFn3Wzj9g0UbhObXdMq+YMKC252o5RHFr0/cKdQe1WsBLUBi4morhgZ77obDJVuV0=', 'base64')

      var Q = curve.params.G.multiply(d)
      var hash = message.magicHash('1111', networks.bitcoin)
      var e = BigInteger.fromBuffer(hash)
      var parsed = ecdsa.parseSigCompact(signature)

      var Qprime = ecdsa.recoverPubKey(curve, e, parsed.signature, parsed.i)
      assert(Q.equals(Qprime))
    })

    fixtures.invalid.recoverPubKey.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var e = BigInteger.fromHex(f.e)
        var signature = {
          r: new BigInteger(f.signature.r),
          s: new BigInteger(f.signature.s)
        }

        assert.throws(function() {
          ecdsa.recoverPubKey(curve, e, signature, f.i)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('sign', function() {
    fixtures.valid.forEach(function(f) {
      it('produces a deterministic signature for \"' + f.message + '\"', function() {
        var d = BigInteger.fromHex(f.d)
        var hash = crypto.sha256(f.message)
        var signature = ecdsa.sign(curve, hash, d)

        assert.equal(signature.r.toString(), f.signature.r)
        assert.equal(signature.s.toString(), f.signature.s)
      })
    })

    it('should sign with low S value', function() {
      var hash = crypto.sha256('Vires in numeris')
      var sig = ecdsa.sign(curve, hash, BigInteger.ONE)

      // See BIP62 for more information
      var N_OVER_TWO = curve.params.n.shiftRight(1)
      assert(sig.s.compareTo(N_OVER_TWO) <= 0)
    })
  })

  describe('verifyRaw', function() {
    fixtures.valid.forEach(function(f) {
      it('verifies a valid signature for \"' + f.message + '\"', function() {
        var d = BigInteger.fromHex(f.d)
        var Q = curve.params.G.multiply(d)

        var signature = {
          r: new BigInteger(f.signature.r),
          s: new BigInteger(f.signature.s)
        }
        var e = BigInteger.fromBuffer(crypto.sha256(f.message))

        assert(ecdsa.verifyRaw(curve, e, signature, Q))
      })
    })

    fixtures.invalid.verifyRaw.forEach(function(f) {
      it('fails to verify with ' + f.description, function() {
        var d = BigInteger.fromHex(f.d)
        var e = BigInteger.fromHex(f.e)
        var signature = {
          r: new BigInteger(f.signature.r),
          s: new BigInteger(f.signature.s)
        }
        var Q = curve.params.G.multiply(d)

        assert.equal(ecdsa.verifyRaw(curve, e, signature, Q), false)
      })
    })
  })

  describe('serializeSig', function() {
    it('encodes a DER signature', function() {
      fixtures.valid.forEach(function(f) {
        var signature = {
          r: new BigInteger(f.signature.r),
          s: new BigInteger(f.signature.s)
        }

        var signature = new Buffer(ecdsa.serializeSig(signature))
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
      it('throws on ' + f.hex, function() {
        var buffer = new Buffer(f.hex, 'hex')

        assert.throws(function() {
          ecdsa.parseSig(buffer)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('serializeSigCompact', function() {
    fixtures.valid.forEach(function(f) {
      it('encodes ' + f.compact.hex + ' correctly', function() {
        var signature = {
          r: new BigInteger(f.signature.r),
          s: new BigInteger(f.signature.s)
        }
        var i = f.compact.i
        var compressed = f.compact.compressed

        var signature = ecdsa.serializeSigCompact(signature, i, compressed)
        assert.equal(signature.toString('hex'), f.compact.hex)
      })
    })
  })

  describe('parseSigCompact', function() {
    fixtures.valid.forEach(function(f) {
      it('decodes ' + f.compact.hex + ' correctly', function() {
        var buffer = new Buffer(f.compact.hex, 'hex')
        var parsed = ecdsa.parseSigCompact(buffer)

        assert.equal(parsed.signature.r.toString(), f.signature.r)
        assert.equal(parsed.signature.s.toString(), f.signature.s)
        assert.equal(parsed.i, f.compact.i)
        assert.equal(parsed.compressed, f.compact.compressed)
      })
    })

    fixtures.invalid.compact.forEach(function(f) {
      it('throws on ' + f.hex, function() {
        var buffer = new Buffer(f.hex, 'hex')

        assert.throws(function() {
          ecdsa.parseSigCompact(buffer)
        }, new RegExp(f.exception))
      })
    })
  })
})
