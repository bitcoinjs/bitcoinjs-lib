/* global describe, it */

var assert = require('assert')
var bigi = require('bigi')
var bitcoin = require('../../')

var ecurve = require('ecurve')
var secp256k1 = ecurve.getCurveByName('secp256k1')
var G = secp256k1.G
var n = secp256k1.n

// c = sha256: e * (d * G)
// cQ = (d * G) + (c * G)
function stealthSend (e, Q) {
  var eQ = Q.multiply(e) // shared secret

  var c = bigi.fromBuffer(bitcoin.crypto.sha256(eQ.getEncoded()))
  var cG = G.multiply(c)

  var cQ = new bitcoin.ECPair(null, Q.add(cG))

  return cQ
}

// c = sha256: d * (e * G)
// cQ = (d + c) * G
function stealthReceive (d, eG) {
  var eQ = eG.multiply(d) // shared secret

  var c = bigi.fromBuffer(bitcoin.crypto.sha256(eQ.getEncoded()))
  var cQ = new bitcoin.ECPair(d.add(c).mod(n))

  return cQ
}

describe('bitcoinjs-lib (crypto)', function () {
  it('can generate a single-key stealth address', function () {
    // XXX: should be randomly generated, see next test for example
    var recipient = bitcoin.ECPair.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss') // private to recipient
    var nonce = bitcoin.ECPair.fromWIF('KxVqB96pxbw1pokzQrZkQbLfVBjjHFfp2mFfEp8wuEyGenLFJhM9') // private to sender

    // ... recipient reveals public key (recipient.Q) to sender
    var forSender = stealthSend(nonce.d, recipient.Q)
    assert.equal(forSender.getAddress(), '1CcZWwCpACJL3AxqoDbwEt4JgDFuTHUspE')
    assert.throws(function () { forSender.toWIF() }, /Error: Missing private key/)

    // ... sender reveals nonce public key (nonce.Q) to recipient
    var forRecipient = stealthReceive(recipient.d, nonce.Q)
    assert.equal(forRecipient.getAddress(), '1CcZWwCpACJL3AxqoDbwEt4JgDFuTHUspE')
    assert.equal(forRecipient.toWIF(), 'L1yjUN3oYyCXV3LcsBrmxCNTa62bZKWCybxVJMvqjMmmfDE8yk7n')

    // sender and recipient, both derived same address
    assert.equal(forSender.getAddress(), forRecipient.getAddress())
  })

  it('can generate a single-key stealth address (randomly)', function () {
    var recipient = bitcoin.ECPair.makeRandom() // private to recipient
    var nonce = bitcoin.ECPair.makeRandom() // private to sender

    // ... recipient reveals public key (recipient.Q) to sender
    var forSender = stealthSend(nonce.d, recipient.Q)
    assert.throws(function () { forSender.toWIF() }, /Error: Missing private key/)

    // ... sender reveals nonce public key (nonce.Q) to recipient
    var forRecipient = stealthReceive(recipient.d, nonce.Q)
    assert.doesNotThrow(function () { forRecipient.toWIF() })

    // sender and recipient, both derived same address
    assert.equal(forSender.getAddress(), forRecipient.getAddress())
  })

  // TODO
  it.skip('can generate a dual-key stealth address', function () {})
})
