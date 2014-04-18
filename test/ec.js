var assert = require('assert')
var ecdsa = require('../').ecdsa

var sec = require('../src/jsbn/sec')
var ecparams = sec('secp256k1')

var ECPointFp = require('../').ECPointFp
var ECKey = require('../').ECKey

describe('ec', function() {
  describe('ECPointFp', function() {
    it('behaviours correctly', function() {
      var G = ecparams.getG()
      var n = ecparams.getN()

      assert.ok(G.multiply(n).isInfinity(), "Gn is infinite")

      var k = ecdsa.getBigRandom(n)
      var P = G.multiply(k)
      assert.ok(!P.isInfinity(), "kG is not infinite")
      assert.ok(P.isOnCurve(), "kG on curve")
      assert.ok(P.multiply(n).isInfinity(), "kGn is infinite")

      assert.ok(P.validate(), "kG validates as a public key")
    })
  })

  describe('decodeFrom', function() {
    it('decodes valid ECPoints', function() {
      var p1 = ECKey.makeRandom(false).pub.toBuffer()
      assert.equal(p1.length, 65)

      var p1_q = ECPointFp.decodeFrom(ecparams.getCurve(), p1)
      assert.ok(p1_q)
      assert.ok(p1_q.validate())

      var p2 = new Buffer('0486f356006a38b847bedec1bf47013776925d939d5a35a97a4d1263e550c7f1ab5aba44ab74d22892097a0e851addf07ba97e33416df5affaceeb35d5607cd23c', 'hex')

      var p2_q = ECPointFp.decodeFrom(ecparams.getCurve(), p2)
      assert.ok(p2_q)
      assert.ok(p2_q.validate())
    })
  })
})
