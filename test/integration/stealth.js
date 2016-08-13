/* global describe, it */

var assert = require('assert')
var bigi = require('bigi')
var bitcoin = require('../../')

var ecurve = require('ecurve')
var secp256k1 = ecurve.getCurveByName('secp256k1')

describe('bitcoinjs-lib (crypto)', function () {
  it('can generate a single-key stealth address', function () {
    var G = secp256k1.G
    var n = secp256k1.n

    function stealthSend (Q) {
      var noncePair = bitcoin.ECPair.makeRandom()
      var e = noncePair.d
      var eQ = Q.multiply(e) // shared secret
      var c = bigi.fromBuffer(bitcoin.crypto.sha256(eQ.getEncoded()))
      var cG = G.multiply(c)
      var Qprime = Q.add(cG)

      return {
        shared: new bitcoin.ECPair(null, Qprime),
        nonce: noncePair.Q
      }
    }

    function stealthReceive (d, P) {
      var dP = P.multiply(d) // shared secret
      var c = bigi.fromBuffer(bitcoin.crypto.sha256(dP.getEncoded()))
      return new bitcoin.ECPair(d.add(c).mod(n))
    }

    // receiver private key
    var receiver = bitcoin.ECPair.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')

    var stealthS = stealthSend(receiver.Q) // public, done by sender
    // ... sender now reveals nonce to receiver

    var stealthR = stealthReceive(receiver.d, stealthS.nonce) // private, done by receiver

    // and check that we derived both sides correctly
    assert.equal(stealthS.shared.getAddress(), stealthR.getAddress())
  })

  // TODO
  it.skip('can generate a dual-key stealth address', function () {})
})
