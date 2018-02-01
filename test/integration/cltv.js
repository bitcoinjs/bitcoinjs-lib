/* global describe, it */

var assert = require('assert')
var bitcoin = require('../../')
var regtestUtils = require('./_regtest')
var regtest = regtestUtils.network
var bip65 = require('bip65')

var alice = bitcoin.ECPair.fromWIF('cScfkGjbzzoeewVWmU2hYPUHeVGJRDdFt7WhmrVVGkxpmPP8BHWe', regtest)
var bob = bitcoin.ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsLwjHXA9x', regtest)

describe('bitcoinjs-lib (transactions w/ CLTV)', function () {
  var hashType = bitcoin.Transaction.SIGHASH_ALL

  function cltvCheckSigOutput (aQ, bQ, lockTime) {
    return bitcoin.script.compile([
      bitcoin.opcodes.OP_IF,
      bitcoin.script.number.encode(lockTime),
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
  it('can create (and broadcast via 3PBP) a Transaction where Alice can redeem the output after the expiry (in the past)', function (done) {
    this.timeout(30000)

    // 3 hours ago
    var lockTime = bip65.encode({ utc: utcNow() - (3600 * 3) })
    var redeemScript = cltvCheckSigOutput(alice, bob, lockTime)
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, regtest)

    // fund the P2SH(CLTV) address
    regtestUtils.faucet(address, 1e5, function (err, unspent) {
      if (err) return done(err)

      var txb = new bitcoin.TransactionBuilder(regtest)
      txb.setLockTime(lockTime)
      txb.addInput(unspent.txId, unspent.vout, 0xfffffffe)
      txb.addOutput(regtestUtils.RANDOM_ADDRESS, 7e4)

      // {Alice's signature} OP_TRUE
      var tx = txb.buildIncomplete()
      var signatureHash = tx.hashForSignature(0, redeemScript, hashType)
      var redeemScriptSig = bitcoin.script.scriptHash.input.encode([
        alice.sign(signatureHash).toScriptSignature(hashType),
        bitcoin.opcodes.OP_TRUE
      ], redeemScript)
      tx.setInputScript(0, redeemScriptSig)

      regtestUtils.broadcast(tx.toHex(), function (err) {
        if (err) return done(err)

        regtestUtils.verify({
          txId: tx.getId(),
          address: regtestUtils.RANDOM_ADDRESS,
          vout: 0,
          value: 7e4
        }, done)
      })
    })
  })

  // expiry will pass, {Alice's signature} OP_TRUE
  it('can create (and broadcast via 3PBP) a Transaction where Alice can redeem the output after the expiry (in the future)', function (done) {
    this.timeout(30000)

    regtestUtils.height(function (err, height) {
      if (err) return done(err)

      // 50 blocks from now
      var lockTime = bip65.encode({ blocks: height + 50 })
      var redeemScript = cltvCheckSigOutput(alice, bob, lockTime)
      var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
      var address = bitcoin.address.fromOutputScript(scriptPubKey, regtest)

      // fund the P2SH(CLTV) address
      regtestUtils.faucet(address, 1e5, function (err, unspent) {
        if (err) return done(err)

        var txb = new bitcoin.TransactionBuilder(regtest)
        txb.setLockTime(lockTime)
        txb.addInput(unspent.txId, unspent.vout, 0xfffffffe)
        txb.addOutput(regtestUtils.RANDOM_ADDRESS, 7e4)

        // {Alice's signature} OP_TRUE
        var tx = txb.buildIncomplete()
        var signatureHash = tx.hashForSignature(0, redeemScript, hashType)
        var redeemScriptSig = bitcoin.script.scriptHash.input.encode([
          alice.sign(signatureHash).toScriptSignature(hashType),
          bitcoin.opcodes.OP_TRUE
        ], redeemScript)
        tx.setInputScript(0, redeemScriptSig)

        regtestUtils.broadcast(tx.toHex(), function (err) {
          // fails before the expiry
          assert.throws(function () {
            if (err) throw err
          }, /Error: 64: non-final/)

          // into the future!
          regtestUtils.mine(51, function (err) {
            if (err) return done(err)

            regtestUtils.broadcast(tx.toHex(), function (err) {
              if (err) return done(err)

              regtestUtils.verify({
                txId: tx.getId(),
                address: regtestUtils.RANDOM_ADDRESS,
                vout: 0,
                value: 7e4
              }, done)
            })
          })
        })
      })
    })
  })

  // expiry ignored, {Bob's signature} {Alice's signature} OP_FALSE
  it('can create (and broadcast via 3PBP) a Transaction where Alice and Bob can redeem the output at any time', function (done) {
    this.timeout(30000)

    // two hours ago
    var timeUtc = utcNow() - (3600 * 2)
    var redeemScript = cltvCheckSigOutput(alice, bob, timeUtc)
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, regtest)

    // fund the P2SH(CLTV) address
    regtestUtils.faucet(address, 2e5, function (err, unspent) {
      if (err) return done(err)

      var txb = new bitcoin.TransactionBuilder(regtest)
      txb.setLockTime(timeUtc)
      txb.addInput(unspent.txId, unspent.vout, 0xfffffffe)
      txb.addOutput(regtestUtils.RANDOM_ADDRESS, 8e4)

      // {Alice's signature} {Bob's signature} OP_FALSE
      var tx = txb.buildIncomplete()
      var signatureHash = tx.hashForSignature(0, redeemScript, hashType)
      var redeemScriptSig = bitcoin.script.scriptHash.input.encode([
        alice.sign(signatureHash).toScriptSignature(hashType),
        bob.sign(signatureHash).toScriptSignature(hashType),
        bitcoin.opcodes.OP_FALSE
      ], redeemScript)
      tx.setInputScript(0, redeemScriptSig)

      regtestUtils.broadcast(tx.toHex(), function (err) {
        if (err) return done(err)

        regtestUtils.verify({
          txId: tx.getId(),
          address: regtestUtils.RANDOM_ADDRESS,
          vout: 0,
          value: 8e4
        }, done)
      })
    })
  })

  // expiry in the future, {Alice's signature} OP_TRUE
  it('can create (but fail to broadcast via 3PBP) a Transaction where Alice attempts to redeem before the expiry', function (done) {
    this.timeout(30000)

    // two hours from now
    var timeUtc = utcNow() + (3600 * 2)
    var redeemScript = cltvCheckSigOutput(alice, bob, timeUtc)
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, regtest)

    // fund the P2SH(CLTV) address
    regtestUtils.faucet(address, 2e4, function (err, unspent) {
      if (err) return done(err)

      var txb = new bitcoin.TransactionBuilder(regtest)
      txb.setLockTime(timeUtc)
      txb.addInput(unspent.txId, unspent.vout, 0xfffffffe)
      txb.addOutput(regtestUtils.RANDOM_ADDRESS, 1e4)

      // {Alice's signature} OP_TRUE
      var tx = txb.buildIncomplete()
      var signatureHash = tx.hashForSignature(0, redeemScript, hashType)
      var redeemScriptSig = bitcoin.script.scriptHash.input.encode([
        alice.sign(signatureHash).toScriptSignature(hashType),
        bitcoin.opcodes.OP_TRUE
      ], redeemScript)
      tx.setInputScript(0, redeemScriptSig)

      regtestUtils.broadcast(tx.toHex(), function (err) {
        assert.throws(function () {
          if (err) throw err
        }, /Error: 64: non-final/)

        done()
      })
    })
  })
})
