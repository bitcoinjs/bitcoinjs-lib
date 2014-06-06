var assert = require('assert')

var sec = require('../src/sec')
var ecparams = sec('secp256k1')

var BigInteger = require('bigi')
var ECPointFp = require('../src/ec').ECPointFp

var fixtures = require('./fixtures/ec.json')

describe('ec', function() {
  describe('ECPointFp', function() {
    it('behaves correctly', function() {
      var G = ecparams.getG()
      var n = ecparams.getN()

      assert.ok(G.multiply(n).isInfinity(), "Gn is infinite")

      var k = BigInteger.ONE
      var P = G.multiply(k)
      assert.ok(!P.isInfinity(), "kG is not infinite")
      assert.ok(P.isOnCurve(), "kG on curve")
      assert.ok(P.multiply(n).isInfinity(), "kGn is infinite")

      assert.ok(P.validate(), "kG validates as a public key")
    })

    describe('getEncoded', function() {
      it('encodes a point correctly', function() {
        fixtures.valid.ECPointFp.forEach(function(f) {
          var curve = ecparams.getCurve()
          var Q = new ECPointFp(
            curve,
            curve.fromBigInteger(new BigInteger(f.x)),
            curve.fromBigInteger(new BigInteger(f.y))
          )

          var encoded = Q.getEncoded(f.compressed)
          assert.equal(encoded.toString('hex'), f.hex)
        })
      })
    })

    describe('decodeFrom', function() {
      it('decodes the correct point', function() {
        fixtures.valid.ECPointFp.forEach(function(f) {
          var curve = ecparams.getCurve()
          var buffer = new Buffer(f.hex, 'hex')

          var decoded = ECPointFp.decodeFrom(curve, buffer)
          assert.equal(decoded.Q.getX().toBigInteger().toString(), f.x)
          assert.equal(decoded.Q.getY().toBigInteger().toString(), f.y)
          assert.equal(decoded.compressed, f.compressed)
        })
      })

      fixtures.invalid.ECPointFp.forEach(function(f) {
        it('throws on ' + f.description, function() {
          var curve = ecparams.getCurve()
          var buffer = new Buffer(f.hex, 'hex')

          assert.throws(function() {
            ECPointFp.decodeFrom(curve, buffer)
          }, /Invalid sequence length|Invalid sequence tag/)
        })
      })

      it('supports secp256r1', function() {
        var f = fixtures.valid.ECPointFp[1]
        var ecparams2 = sec('secp256r1')
        var curve = ecparams2.getCurve()

        var D = BigInteger.ONE
        var Q = ecparams2.getG().multiply(D)

        var buffer = Q.getEncoded(true)
        var decoded = ECPointFp.decodeFrom(curve, buffer)

        assert(Q.equals(decoded.Q))
        assert(decoded.compressed, true)
      })
    })
  })
})
