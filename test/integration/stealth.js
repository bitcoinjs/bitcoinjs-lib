/* global describe, it */

let assert = require('assert')
let bitcoin = require('../../')
let ecc = require('tiny-secp256k1')

// TODO: remove
let baddress = bitcoin.address
let bcrypto = bitcoin.crypto
function getAddress (node) {
  return baddress.toBase58Check(bcrypto.hash160(node.publicKey), bitcoin.networks.bitcoin.pubKeyHash)
}

// vG = (dG \+ sha256(e * dG)G)
function stealthSend (e, Q) {
  var eQ = ecc.pointMultiply(Q, e, true) // shared secret
  var c = bitcoin.crypto.sha256(eQ)
  var Qc = ecc.pointAddScalar(Q, c)
  var vG = bitcoin.ECPair.fromPublicKey(Qc)

  return vG
}

// v = (d + sha256(eG * d))
function stealthReceive (d, eG) {
  var eQ = ecc.pointMultiply(eG, d) // shared secret
  var c = bitcoin.crypto.sha256(eQ)
  var dc = ecc.privateAdd(d, c)
  var v = bitcoin.ECPair.fromPrivateKey(dc)

  return v
}

// d = (v - sha256(e * dG))
function stealthRecoverLeaked (v, e, Q) {
  var eQ = ecc.pointMultiply(Q, e) // shared secret
  var c = bitcoin.crypto.sha256(eQ)
  var vc = ecc.privateSub(v, c)
  var d = bitcoin.ECPair.fromPrivateKey(vc)

  return d
}

// vG = (rG \+ sha256(e * dG)G)
function stealthDualSend (e, R, Q) {
  var eQ = ecc.pointMultiply(Q, e) // shared secret
  var c = bitcoin.crypto.sha256(eQ)
  var Rc = ecc.pointAddScalar(R, c)
  var vG = bitcoin.ECPair.fromPublicKey(Rc)

  return vG
}

// vG = (rG \+ sha256(eG * d)G)
function stealthDualScan (d, R, eG) {
  var eQ = ecc.pointMultiply(eG, d) // shared secret
  var c = bitcoin.crypto.sha256(eQ)
  var Rc = ecc.pointAddScalar(R, c)
  var vG = bitcoin.ECPair.fromPublicKey(Rc)

  return vG
}

// v = (r + sha256(eG * d))
function stealthDualReceive (d, r, eG) {
  var eQ = ecc.pointMultiply(eG, d) // shared secret
  var c = bitcoin.crypto.sha256(eQ)
  var rc = ecc.privateAdd(r, c)
  var v = bitcoin.ECPair.fromPrivateKey(rc)

  return v
}

describe('bitcoinjs-lib (crypto)', function () {
  it('can generate a single-key stealth address', function () {
    // XXX: should be randomly generated, see next test for example
    var recipient = bitcoin.ECPair.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss') // private to recipient
    var nonce = bitcoin.ECPair.fromWIF('KxVqB96pxbw1pokzQrZkQbLfVBjjHFfp2mFfEp8wuEyGenLFJhM9') // private to sender

    // ... recipient reveals public key (recipient.Q) to sender
    var forSender = stealthSend(nonce.privateKey, recipient.publicKey)
    assert.equal(getAddress(forSender), '1CcZWwCpACJL3AxqoDbwEt4JgDFuTHUspE')
    assert.throws(function () { forSender.toWIF() }, /Error: Missing private key/)

    // ... sender reveals nonce public key (nonce.Q) to recipient
    var forRecipient = stealthReceive(recipient.privateKey, nonce.publicKey)
    assert.equal(getAddress(forRecipient), '1CcZWwCpACJL3AxqoDbwEt4JgDFuTHUspE')
    assert.equal(forRecipient.toWIF(), 'L1yjUN3oYyCXV3LcsBrmxCNTa62bZKWCybxVJMvqjMmmfDE8yk7n')

    // sender and recipient, both derived same address
    assert.equal(getAddress(forSender), getAddress(forRecipient))
  })

  it('can generate a single-key stealth address (randomly)', function () {
    var recipient = bitcoin.ECPair.makeRandom() // private to recipient
    var nonce = bitcoin.ECPair.makeRandom() // private to sender

    // ... recipient reveals public key (recipient.Q) to sender
    var forSender = stealthSend(nonce.privateKey, recipient.publicKey)
    assert.throws(function () { forSender.toWIF() }, /Error: Missing private key/)

    // ... sender reveals nonce public key (nonce.Q) to recipient
    var forRecipient = stealthReceive(recipient.privateKey, nonce.publicKey)
    assert.doesNotThrow(function () { forRecipient.toWIF() })

    // sender and recipient, both derived same address
    assert.equal(getAddress(forSender), getAddress(forRecipient))
  })

  it('can recover parent recipient.d, if a derived private key is leaked [and nonce was revealed]', function () {
    var recipient = bitcoin.ECPair.makeRandom() // private to recipient
    var nonce = bitcoin.ECPair.makeRandom() // private to sender

    // ... recipient reveals public key (recipient.Q) to sender
    var forSender = stealthSend(nonce.privateKey, recipient.publicKey)
    assert.throws(function () { forSender.toWIF() }, /Error: Missing private key/)

    // ... sender reveals nonce public key (nonce.Q) to recipient
    var forRecipient = stealthReceive(recipient.privateKey, nonce.publicKey)
    assert.doesNotThrow(function () { forRecipient.toWIF() })

    // ... recipient accidentally leaks forRecipient.d on the blockchain
    var leaked = stealthRecoverLeaked(forRecipient.privateKey, nonce.privateKey, recipient.publicKey)
    assert.equal(leaked.toWIF(), recipient.toWIF())
  })

  it('can generate a dual-key stealth address', function () {
    // XXX: should be randomly generated, see next test for example
    var recipient = bitcoin.ECPair.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss') // private to recipient
    var scan = bitcoin.ECPair.fromWIF('L5DkCk3xLLoGKncqKsWQTdaPSR4V8gzc14WVghysQGkdryRudjBM') // private to scanner/recipient
    var nonce = bitcoin.ECPair.fromWIF('KxVqB96pxbw1pokzQrZkQbLfVBjjHFfp2mFfEp8wuEyGenLFJhM9') // private to sender

    // ... recipient reveals public key(s) (recipient.Q, scan.Q) to sender
    var forSender = stealthDualSend(nonce.privateKey, recipient.publicKey, scan.publicKey)
    assert.throws(function () { forSender.toWIF() }, /Error: Missing private key/)

    // ... sender reveals nonce public key (nonce.Q) to scanner
    var forScanner = stealthDualScan(scan.privateKey, recipient.publicKey, nonce.publicKey)
    assert.throws(function () { forScanner.toWIF() }, /Error: Missing private key/)

    // ... scanner reveals relevant transaction + nonce public key (nonce.Q) to recipient
    var forRecipient = stealthDualReceive(scan.privateKey, recipient.privateKey, nonce.publicKey)
    assert.doesNotThrow(function () { forRecipient.toWIF() })

    // scanner, sender and recipient, all derived same address
    assert.equal(getAddress(forSender), getAddress(forScanner))
    assert.equal(getAddress(forSender), getAddress(forRecipient))
  })

  it('can generate a dual-key stealth address (randomly)', function () {
    var recipient = bitcoin.ECPair.makeRandom() // private to recipient
    var scan = bitcoin.ECPair.makeRandom() // private to scanner/recipient
    var nonce = bitcoin.ECPair.makeRandom() // private to sender

    // ... recipient reveals public key(s) (recipient.Q, scan.Q) to sender
    var forSender = stealthDualSend(nonce.privateKey, recipient.publicKey, scan.publicKey)
    assert.throws(function () { forSender.toWIF() }, /Error: Missing private key/)

    // ... sender reveals nonce public key (nonce.Q) to scanner
    var forScanner = stealthDualScan(scan.privateKey, recipient.publicKey, nonce.publicKey)
    assert.throws(function () { forScanner.toWIF() }, /Error: Missing private key/)

    // ... scanner reveals relevant transaction + nonce public key (nonce.Q) to recipient
    var forRecipient = stealthDualReceive(scan.privateKey, recipient.privateKey, nonce.publicKey)
    assert.doesNotThrow(function () { forRecipient.toWIF() })

    // scanner, sender and recipient, all derived same address
    assert.equal(getAddress(forSender), getAddress(forScanner))
    assert.equal(getAddress(forSender), getAddress(forRecipient))
  })
})
