var assert = require('assert')
var sec = require('../src/jsbn/sec')
var ecdsa = require('../').ecdsa

var ecparams = sec('secp256k1')

describe('ecdsa', function() {
  it('handles point multiplication', function() {
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
