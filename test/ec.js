var assert = require('assert')

var sec = require('../src/sec')
var ecparams = sec('secp256k1')

var BigInteger = require('bigi')
var ECPointFp = require('../src/ec').ECPointFp

var fixtures = require('./fixtures/ec.js')

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
          assert.equal(decoded.getX().toBigInteger().toString(), f.x)
          assert.equal(decoded.getY().toBigInteger().toString(), f.y)

          // TODO
//          assert.equal(decoded.compressed, f.compressed)
        })
      })

      // FIXME
  //    fixtures.invalid.ECPointFp.forEach(function(f) {
  //      it('throws on ' + f.description, function() {
  //        var curve = ecparams.getCurve()
  //        var buffer = new Buffer(f.hex, 'hex')
  //
  //        assert.throws(function() {
  //          ECPointFp.decodeFrom(curve, buffer)
  //        })
  //      })
  //    })
    })
  })
})
