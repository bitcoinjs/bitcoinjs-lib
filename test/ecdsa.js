/* global describe, it */

var assert = require('assert')
var bcrypto = require('../src/crypto')
var ecdsa = require('../src/ecdsa')
var hoodwink = require('hoodwink')

var BigInteger = require('bigi')
var ECSignature = require('../src/ecsignature')

var curve = ecdsa.__curve

var fixtures = require('./fixtures/ecdsa.json')

describe('ecdsa', function () {
  describe('deterministicGenerateK', function () {
    function checkSig () {
      return true
    }

    fixtures.valid.ecdsa.forEach(function (f) {
      it('for "' + f.message + '"', function () {
        var x = BigInteger.fromHex(f.d).toBuffer(32)
        var h1 = bcrypto.sha256(f.message)

        var k = ecdsa.deterministicGenerateK(h1, x, checkSig)
        assert.strictEqual(k.toHex(), f.k)
      })
    })

    it('loops until an appropriate k value is found', hoodwink(function () {
      this.mock(BigInteger, 'fromBuffer', function f (b) {
        assert.strictEqual(b.length, 32)
        if (f.calls === 0) return BigInteger.ZERO // < 1
        if (f.calls === 1) return curve.n // > n - 1
        if (f.calls === 2) return new BigInteger('42') // valid
      }, 3)

      var x = new BigInteger('1').toBuffer(32)
      var h1 = Buffer.alloc(32)
      var k = ecdsa.deterministicGenerateK(h1, x, checkSig)

      assert.strictEqual(k.toString(), '42')
    }))

    it('loops until a suitable signature is found', hoodwink(function () {
      var checkSigStub = this.stub(function f () {
        if (f.calls === 0) return false // bad signature
        if (f.calls === 1) return true // good signature
      }, 2)

      var x = BigInteger.ONE.toBuffer(32)
      var h1 = Buffer.alloc(32)
      var k = ecdsa.deterministicGenerateK(h1, x, checkSigStub)

      assert.strictEqual(k.toHex(), 'a9b1a1a84a4c2f96b6158ed7a81404c50cb74373c22e8d9e02d0411d719acae2')
    }))

    fixtures.valid.rfc6979.forEach(function (f) {
      it('produces the expected k values for ' + f.message + " if k wasn't suitable", function () {
        var x = BigInteger.fromHex(f.d).toBuffer(32)
        var h1 = bcrypto.sha256(f.message)

        var results = []
        ecdsa.deterministicGenerateK(h1, x, function (k) {
          results.push(k)

          return results.length === 16
        })

        assert.strictEqual(results[0].toHex(), f.k0)
        assert.strictEqual(results[1].toHex(), f.k1)
        assert.strictEqual(results[15].toHex(), f.k15)
      })
    })
  })

  describe('sign', function () {
    fixtures.valid.ecdsa.forEach(function (f) {
      it('produces a deterministic signature for "' + f.message + '"', function () {
        var d = BigInteger.fromHex(f.d)
        var hash = bcrypto.sha256(f.message)
        var signature = ecdsa.sign(hash, d).toDER()

        assert.strictEqual(signature.toString('hex'), f.signature)
      })
    })

    it('should sign with low S value', function () {
      var hash = bcrypto.sha256('Vires in numeris')
      var sig = ecdsa.sign(hash, BigInteger.ONE)

      // See BIP62 for more information
      var N_OVER_TWO = curve.n.shiftRight(1)
      assert(sig.s.compareTo(N_OVER_TWO) <= 0)
    })
  })

  describe('verify', function () {
    fixtures.valid.ecdsa.forEach(function (f) {
      it('verifies a valid signature for "' + f.message + '"', function () {
        var d = BigInteger.fromHex(f.d)
        var H = bcrypto.sha256(f.message)
        var signature = ECSignature.fromDER(Buffer.from(f.signature, 'hex'))
        var Q = curve.G.multiply(d)

        assert(ecdsa.verify(H, signature, Q))
      })
    })

    fixtures.invalid.verify.forEach(function (f) {
      it('fails to verify with ' + f.description, function () {
        var H = bcrypto.sha256(f.message)
        var d = BigInteger.fromHex(f.d)

        var signature
        if (f.signature) {
          signature = ECSignature.fromDER(Buffer.from(f.signature, 'hex'))
        } else if (f.signatureRaw) {
          signature = new ECSignature(new BigInteger(f.signatureRaw.r, 16), new BigInteger(f.signatureRaw.s, 16))
        }

        var Q = curve.G.multiply(d)

        assert.strictEqual(ecdsa.verify(H, signature, Q), false)
      })
    })
  })
})
