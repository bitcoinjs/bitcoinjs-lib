/* global describe, it, beforeEach */

var assert = require('assert')
var bitcoin = require('../../')
var blockchain = require('./_blockchain')

describe('bitcoinjs-lib (advanced)', function () {
  it('can sign a Bitcoin message', function () {
    var keyPair = bitcoin.ECPair.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
    var message = 'This is an example of a signed message.'

    var signature = bitcoin.message.sign(keyPair, message)
    assert.strictEqual(signature.toString('base64'), 'G9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=')
  })

  it('can verify a Bitcoin message', function () {
    var address = '1HZwkjkeaoZfTSaJxDw6aKkxp45agDiEzN'
    var signature = 'HJLQlDWLyb1Ef8bQKEISzFbDAKctIlaqOpGbrk3YVtRsjmC61lpE5ErkPRUFtDKtx98vHFGUWlFhsh3DiW6N0rE'
    var message = 'This is an example of a signed message.'

    assert(bitcoin.message.verify(address, signature, message))
  })

  it('can create a transaction using OP_RETURN', function (done) {
    this.timeout(30000)

    var network = bitcoin.networks.testnet
    var keyPair = bitcoin.ECPair.makeRandom({ network: network })
    var address = keyPair.getAddress()

    blockchain.t.faucet(address, 2e4, function (err, unspent) {
      if (err) return done(err)

      var tx = new bitcoin.TransactionBuilder(network)
      var data = new Buffer('bitcoinjs-lib')
      var dataScript = bitcoin.script.nullDataOutput(data)

      tx.addInput(unspent.txId, unspent.vout)
      tx.addOutput(dataScript, 1000)
      tx.sign(0, keyPair)
      var txRaw = tx.build()

      blockchain.t.transactions.propagate(txRaw.toHex(), done)
    })
  })

  describe('can create transactions using OP_CHECKLOCKTIMEVERIFY', function (done) {
    var network = bitcoin.networks.testnet
    var alice = bitcoin.ECPair.fromWIF('cScfkGjbzzoeewVWmU2hYPUHeVGJRDdFt7WhmrVVGkxpmPP8BHWe', network)
    var bob = bitcoin.ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsLwjHXA9x', network)

    // now - 3 hours
    var threeHoursAgo = Math.floor(Date.now() / 1000) - (3600 * 3)
    var redeemScript = bitcoin.script.compile([
      bitcoin.opcodes.OP_IF,

      bitcoin.script.number.encode(threeHoursAgo),
      bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
      bitcoin.opcodes.OP_DROP,

      bitcoin.opcodes.OP_ELSE,

      bob.getPublicKeyBuffer(),
      bitcoin.opcodes.OP_CHECKSIGVERIFY,

      bitcoin.opcodes.OP_ENDIF,

      alice.getPublicKeyBuffer(),
      bitcoin.opcodes.OP_CHECKSIG
    ])
    var scriptPubKey = bitcoin.script.scriptHashOutput(bitcoin.crypto.hash160(redeemScript))

    var txId
    beforeEach(function (done) {
      this.timeout(10000)

      blockchain.t.faucet(alice.getAddress(), 2e4, function (err, unspent) {
        if (err) return done(err)

        // build the transaction
        var tx = new bitcoin.TransactionBuilder(network)
        tx.addInput(unspent.txId, unspent.vout)
        tx.addOutput(scriptPubKey, 1e4)
        tx.sign(0, alice)
        var txRaw = tx.build()

        txId = txRaw.getId()

        blockchain.t.transactions.propagate(txRaw.toHex(), done)
      })
    })

    // expiry past, {Alice's signature} OP_TRUE
    it('where Alice can redeem after the expiry is past', function (done) {
      this.timeout(30000)

      var tx2 = new bitcoin.TransactionBuilder(network)
      tx2.setLockTime(threeHoursAgo)
      tx2.addInput(txId, 0, 0xfffffffe)
      tx2.addOutput(alice.getAddress(), 1000)

      var tx2Raw = tx2.buildIncomplete()
      var hashType = bitcoin.Transaction.SIGHASH_ALL
      var signatureHash = tx2Raw.hashForSignature(0, redeemScript, hashType)
      var signature = alice.sign(signatureHash)

      var redeemScriptSig = bitcoin.script.scriptHashInput([
        signature.toScriptSignature(hashType), bitcoin.opcodes.OP_TRUE
      ], redeemScript)

      tx2Raw.setInputScript(0, redeemScriptSig)

      blockchain.t.transactions.propagate(tx2Raw.toHex(), done)
    })

    // {Bob's signature} {Alice's signature} OP_FALSE
    it('where Alice and Bob can redeem at any time', function (done) {
      this.timeout(30000)

      var tx2 = new bitcoin.TransactionBuilder(network)
      tx2.setLockTime(threeHoursAgo)
      tx2.addInput(txId, 0, 0xfffffffe)
      tx2.addOutput(alice.getAddress(), 1000)

      var tx2Raw = tx2.buildIncomplete()
      var hashType = bitcoin.Transaction.SIGHASH_ALL
      var signatureHash = tx2Raw.hashForSignature(0, redeemScript, hashType)
      var signatureA = alice.sign(signatureHash)
      var signatureB = bob.sign(signatureHash)
      var redeemScriptSig = bitcoin.script.scriptHashInput([
        signatureA.toScriptSignature(hashType), signatureB.toScriptSignature(hashType), bitcoin.opcodes.OP_FALSE
      ], redeemScript)

      tx2Raw.setInputScript(0, redeemScriptSig)

      blockchain.t.transactions.propagate(tx2Raw.toHex(), done)
    })
  })
})
