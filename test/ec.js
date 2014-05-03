var assert = require('assert')

var sec = require('../').sec
var ecparams = sec('secp256k1')

var BigInteger = require('bigi')
var ECPointFp = require('../').ECPointFp

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
  })

  describe('decodeFrom', function() {
    it('decodes compressed ECPoints', function() {
      var s = new Buffer('02789ece95adf35fb3de994b8b16c90166736d70913a18378fff79503e8c5db7fb', 'hex')
      var Q = ECPointFp.decodeFrom(ecparams.getCurve(), s)
      assert.ok(Q)
      assert.ok(Q.validate())
    })

    it('decodes uncompressed ECPoints', function() {
      var s = new Buffer('0486f356006a38b847bedec1bf47013776925d939d5a35a97a4d1263e550c7f1ab5aba44ab74d22892097a0e851addf07ba97e33416df5affaceeb35d5607cd23c', 'hex')
      var Q = ECPointFp.decodeFrom(ecparams.getCurve(), s)
      assert.ok(Q)
      assert.ok(Q.validate())
    })
  })
})
