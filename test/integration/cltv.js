/* global describe, it */

var assert = require('assert')
var bitcoin = require('../../')
var blockchain = require('./_blockchain')

var network = bitcoin.networks.testnet
var alice = bitcoin.ECPair.fromWIF('cScfkGjbzzoeewVWmU2hYPUHeVGJRDdFt7WhmrVVGkxpmPP8BHWe', network)
var bob = bitcoin.ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsLwjHXA9x', network)

describe('bitcoinjs-lib (CLTV)', function () {
  var hashType = bitcoin.Transaction.SIGHASH_ALL

  function cltvCheckSigInput (aQ, bQ, utcSeconds) {
    return bitcoin.script.compile([
      bitcoin.opcodes.OP_IF,
      bitcoin.script.number.encode(utcSeconds),
      bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
      bitcoin.opcodes.OP_DROP,

      bitcoin.opcodes.OP_ELSE,
      bQ.getPublicKeyBuffer(),
      bitcoin.opcodes.OP_CHECKSIGVERIFY,
      bitcoin.opcodes.OP_ENDIF,

      aQ.getPublicKeyBuffer(),
      bitcoin.opcodes.OP_CHECKSIG
    ])
  }

  function utcNow () {
    return Math.floor(Date.now() / 1000)
  }

  // expiry past, {Alice's signature} OP_TRUE
  it('where Alice can redeem after the expiry is past', function (done) {
    this.timeout(30000)

    // three hours ago
    var timeUtc = utcNow() - (3600 * 3)
    var redeemScript = cltvCheckSigInput(alice, bob, timeUtc)
    var scriptPubKey = bitcoin.script.scriptHashOutput(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

    // fund the P2SH(CLTV) address
    blockchain.t.faucet(address, 2e4, function (err, unspent) {
      if (err) return done(err)

      var tx = new bitcoin.TransactionBuilder(network)
      tx.setLockTime(timeUtc)
      tx.addInput(unspent.txId, 0, 0xfffffffe)
      tx.addOutput(alice.getAddress(), 1000)

      var txRaw = tx.buildIncomplete()
      var signatureHash = txRaw.hashForSignature(0, redeemScript, hashType)

      // {Alice's signature} OP_TRUE
      var redeemScriptSig = bitcoin.script.scriptHashInput([
        alice.sign(signatureHash).toScriptSignature(hashType),
        bitcoin.opcodes.OP_TRUE
      ], redeemScript)

      txRaw.setInputScript(0, redeemScriptSig)

      blockchain.t.transactions.propagate(txRaw.toHex(), done)
    })
  })

  // expiry ignored, {Bob's signature} {Alice's signature} OP_FALSE
  it('where Alice and Bob can redeem at any time', function (done) {
    this.timeout(30000)

    // two hours ago
    var timeUtc = utcNow() - (3600 * 2)
    var redeemScript = cltvCheckSigInput(alice, bob, timeUtc)
    var scriptPubKey = bitcoin.script.scriptHashOutput(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

    // fund the P2SH(CLTV) address
    blockchain.t.faucet(address, 2e4, function (err, unspent) {
      if (err) return done(err)

      var tx = new bitcoin.TransactionBuilder(network)
      tx.addInput(unspent.txId, 0, 0xfffffffe)
      tx.addOutput(alice.getAddress(), 1000)

      var txRaw = tx.buildIncomplete()
      var signatureHash = txRaw.hashForSignature(0, redeemScript, hashType)
      var redeemScriptSig = bitcoin.script.scriptHashInput([
        alice.sign(signatureHash).toScriptSignature(hashType),
        bob.sign(signatureHash).toScriptSignature(hashType),
        bitcoin.opcodes.OP_FALSE
      ], redeemScript)

      txRaw.setInputScript(0, redeemScriptSig)

      blockchain.t.transactions.propagate(txRaw.toHex(), done)
    })
  })

  // expiry in the future, {Alice's signature} OP_TRUE
  it('fails when still time-locked', function (done) {
    this.timeout(30000)

    // two hours from now
    var timeUtc = utcNow() + (3600 * 2)
    var redeemScript = cltvCheckSigInput(alice, bob, timeUtc)
    var scriptPubKey = bitcoin.script.scriptHashOutput(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

    // fund the P2SH(CLTV) address
    blockchain.t.faucet(address, 2e4, function (err, unspent) {
      if (err) return done(err)

      var tx = new bitcoin.TransactionBuilder(network)
      tx.setLockTime(timeUtc)
      tx.addInput(unspent.txId, 0, 0xfffffffe)
      tx.addOutput(alice.getAddress(), 1000)

      var txRaw = tx.buildIncomplete()
      var signatureHash = txRaw.hashForSignature(0, redeemScript, hashType)

      // {Alice's signature} OP_TRUE
      var redeemScriptSig = bitcoin.script.scriptHashInput([
        alice.sign(signatureHash).toScriptSignature(hashType),
        bitcoin.opcodes.OP_TRUE
      ], redeemScript)

      txRaw.setInputScript(0, redeemScriptSig)

      blockchain.t.transactions.propagate(txRaw.toHex(), function (err) {
        assert.throws(function () {
          if (err) throw err
        }, /Error: 64: non-final/)

        done()
      })
    })
  })
})
