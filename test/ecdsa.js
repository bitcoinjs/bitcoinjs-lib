var assert = require('assert')
var crypto = require('../src/crypto')
var ecdsa = require('../src/ecdsa')
var message = require('../src/message')
var networks = require('../src/networks')
var sinon = require('sinon')

var BigInteger = require('bigi')
var ECSignature = require('../src/ecsignature')

var ecurve = require('ecurve')
var curve = ecurve.getCurveByName('secp256k1')

var fixtures = require('./fixtures/ecdsa.json')

describe('ecdsa', function() {
  describe('deterministicGenerateK', function() {
    function checkSig() { return true }

    fixtures.valid.ecdsa.forEach(function(f) {
      it('for \"' + f.message + '\"', function() {
        var d = BigInteger.fromHex(f.d)
        var h1 = crypto.sha256(f.message)

        var k = ecdsa.deterministicGenerateK(curve, h1, d, checkSig)
        assert.equal(k.toHex(), f.k)
      })
    })

    // FIXME: remove in 2.0.0
    fixtures.valid.ecdsa.forEach(function(f) {
      it('(deprecated) for \"' + f.message + '\"', function() {
        var d = BigInteger.fromHex(f.d)
        var h1 = crypto.sha256(f.message)

        var k = ecdsa.deterministicGenerateK(curve, h1, d) // default checkSig
        assert.equal(k.toHex(), f.k)
      })
    })

    it('loops until an appropriate k value is found', sinon.test(function() {
      this.mock(BigInteger).expects('fromBuffer')
        .exactly(3)
        .onCall(0).returns(new BigInteger('0')) // < 1
        .onCall(1).returns(curve.n) // > n-1
        .onCall(2).returns(new BigInteger('42')) // valid

      var d = new BigInteger('1')
      var h1 = new Buffer(32)
      var k = ecdsa.deterministicGenerateK(curve, h1, d, checkSig)

      assert.equal(k.toString(), '42')
    }))

    it('loops until a suitable signature is found', sinon.test(function() {
      this.mock(BigInteger).expects('fromBuffer')
        .exactly(4)
        .onCall(0).returns(new BigInteger('0')) // < 1
        .onCall(1).returns(curve.n) // > n-1
        .onCall(2).returns(new BigInteger('42')) // valid, but 'bad' signature
        .onCall(3).returns(new BigInteger('53')) // valid, good signature

      var checkSig = this.mock()
      checkSig.exactly(2)
      checkSig.onCall(0).returns(false) // bad signature
      checkSig.onCall(1).returns(true) // good signature

      var d = new BigInteger('1')
      var h1 = new Buffer(32)
      var k = ecdsa.deterministicGenerateK(curve, h1, d, checkSig)

      assert.equal(k.toString(), '53')
    }))

    fixtures.valid.rfc6979.forEach(function(f) {
      it('produces the expected k values for ' + f.message + ' if k wasn\'t suitable', function() {
        var d = BigInteger.fromHex(f.d)
        var h1 = crypto.sha256(f.message)

        var results = []
        ecdsa.deterministicGenerateK(curve, h1, d, function(k) {
          results.push(k)

          return results.length === 16
        })

        assert.equal(results[0].toHex(), f.k0)
        assert.equal(results[1].toHex(), f.k1)
        assert.equal(results[15].toHex(), f.k15)
      })
    })
  })

  describe('recoverPubKey', function() {
    fixtures.valid.ecdsa.forEach(function(f) {
      it('recovers the pubKey for ' + f.d, function() {
        var d = BigInteger.fromHex(f.d)
        var Q = curve.G.multiply(d)
        var signature = {
          r: new BigInteger(f.signature.r),
          s: new BigInteger(f.signature.s)
        }
        var h1 = crypto.sha256(f.message)
        var e = BigInteger.fromBuffer(h1)
        var Qprime = ecdsa.recoverPubKey(curve, e, signature, f.i)

        assert(Qprime.equals(Q))
      })
    })

    describe('with i ∈ {0,1,2,3}', function() {
      var hash = message.magicHash('1111', networks.bitcoin)
      var e = BigInteger.fromBuffer(hash)

      var signatureBuffer = new Buffer('INcvXVVEFyIfHLbDX+xoxlKFn3Wzj9g0UbhObXdMq+YMKC252o5RHFr0/cKdQe1WsBLUBi4morhgZ77obDJVuV0=', 'base64')
      var signature = ECSignature.parseCompact(signatureBuffer).signature
      var points = [
        '03e3a8c44a8bf712f1fbacee274fb19c0239b1a9e877eff0075ea335f2be8ff380',
        '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
        '03d49e765f0bc27525c51a1b98fb1c99dacd59abe85a203af90f758260550b56c5',
        '027eea09d46ac7fb6aa2e96f9c576677214ffdc238eb167734a9b39d1eb4c3d30d'
      ]

      points.forEach(function(expectedHex, i) {
        it('recovers an expected point for i of ' + i, function() {
          var Qprime = ecdsa.recoverPubKey(curve, e, signature, i)
          var QprimeHex = Qprime.getEncoded().toString('hex')

          assert.equal(QprimeHex, expectedHex)
        })
      })
    })

    fixtures.invalid.recoverPubKey.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var e = BigInteger.fromHex(f.e)
        var signature = new ECSignature(new BigInteger(f.signature.r), new BigInteger(f.signature.s))

        assert.throws(function() {
          ecdsa.recoverPubKey(curve, e, signature, f.i)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('sign', function() {
    fixtures.valid.ecdsa.forEach(function(f) {
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
      var N_OVER_TWO = curve.n.shiftRight(1)
      assert(sig.s.compareTo(N_OVER_TWO) <= 0)
    })
  })

  describe('verify/verifyRaw', function() {
    fixtures.valid.ecdsa.forEach(function(f) {
      it('verifies a valid signature for \"' + f.message + '\"', function() {
        var d = BigInteger.fromHex(f.d)
        var H = crypto.sha256(f.message)
        var e = BigInteger.fromBuffer(H)
        var signature = new ECSignature(
          new BigInteger(f.signature.r),
          new BigInteger(f.signature.s)
        )
        var Q = curve.G.multiply(d)

        assert(ecdsa.verify(curve, H, signature, Q))
        assert(ecdsa.verifyRaw(curve, e, signature, Q))
      })
    })

    fixtures.invalid.verifyRaw.forEach(function(f) {
      it('fails to verify with ' + f.description, function() {
        var H = crypto.sha256(f.message)
        var e = BigInteger.fromBuffer(H)
        var d = BigInteger.fromHex(f.d)
        var signature = new ECSignature(
          new BigInteger(f.signature.r),
          new BigInteger(f.signature.s)
        )
        var Q = curve.G.multiply(d)

        assert.equal(ecdsa.verify(curve, H, signature, Q), false)
        assert.equal(ecdsa.verifyRaw(curve, e, signature, Q), false)
      })
    })
  })
})
