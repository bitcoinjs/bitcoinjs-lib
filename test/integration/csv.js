const { describe, it, before } = require('mocha')
const assert = require('assert')
const bitcoin = require('../../')
const regtestUtils = require('./_regtest')
const regtest = regtestUtils.network
const bip68 = require('bip68')

const alice = bitcoin.ECPair.fromWIF('cScfkGjbzzoeewVWmU2hYPUHeVGJRDdFt7WhmrVVGkxpmPP8BHWe', regtest)
const bob = bitcoin.ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsLwjHXA9x', regtest)

describe('bitcoinjs-lib (transactions w/ CSV)', function () {
  // force update MTP
  before(function (done) {
    regtestUtils.mine(11, done)
  })

  const hashType = bitcoin.Transaction.SIGHASH_ALL

  // IF MTP (from when confirmed) > seconds, aQ can redeem
  function csvCheckSigOutput (aQ, bQ, sequence) {
    return bitcoin.script.compile([
      bitcoin.opcodes.OP_IF,
      bitcoin.script.number.encode(sequence),
      bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
      bitcoin.opcodes.OP_DROP,

      bitcoin.opcodes.OP_ELSE,
      bQ.publicKey,
      bitcoin.opcodes.OP_CHECKSIGVERIFY,
      bitcoin.opcodes.OP_ENDIF,

      aQ.publicKey,
      bitcoin.opcodes.OP_CHECKSIG
    ])
  }

  // expiry will pass, {Alice's signature} OP_TRUE
  it('can create (and broadcast via 3PBP) a Transaction where Alice can redeem the output after the expiry (in the future)', function (done) {
    regtestUtils.height(function (err, height) {
      if (err) return done(err)

      // 5 blocks from now
      const sequence = bip68.encode({ blocks: 5 })
      const p2sh = bitcoin.payments.p2sh({
        redeem: {
          output: csvCheckSigOutput(alice, bob, sequence)
        },
        network: regtest
      })

      // fund the P2SH(CSV) address
      regtestUtils.faucet(p2sh.address, 1e5, function (err, unspent) {
        if (err) return done(err)

        const txb = new bitcoin.TransactionBuilder(regtest)
        txb.addInput(unspent.txId, unspent.vout, sequence)
        txb.addOutput(regtestUtils.RANDOM_ADDRESS, 7e4)

        // {Alice's signature} OP_TRUE
        const tx = txb.buildIncomplete()
        const signatureHash = tx.hashForSignature(0, p2sh.redeem.output, hashType)
        const redeemScriptSig = bitcoin.payments.p2sh({
          network: regtest,
          redeem: {
            network: regtest,
            output: p2sh.redeem.output,
            input: bitcoin.script.compile([
              bitcoin.script.signature.encode(alice.sign(signatureHash), hashType),
              bitcoin.opcodes.OP_TRUE
            ])
          }
        }).input
        tx.setInputScript(0, redeemScriptSig)

        // TODO: test that it failures _prior_ to expiry, unfortunately, race conditions when run concurrently
        // ...
        // into the future!
        regtestUtils.mine(10, function (err) {
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

  // expiry in the future, {Alice's signature} OP_TRUE
  it('can create (but fail to broadcast via 3PBP) a Transaction where Alice attempts to redeem before the expiry', function (done) {
    // two hours after confirmation
    const sequence = bip68.encode({ seconds: 7168 })
    const p2sh = bitcoin.payments.p2sh({
      network: regtest,
      redeem: {
        output: csvCheckSigOutput(alice, bob, sequence)
      }
    })

    // fund the P2SH(CSV) address
    regtestUtils.faucet(p2sh.address, 2e4, function (err, unspent) {
      if (err) return done(err)

      const txb = new bitcoin.TransactionBuilder(regtest)
      txb.addInput(unspent.txId, unspent.vout, sequence)
      txb.addOutput(regtestUtils.RANDOM_ADDRESS, 1e4)

      // {Alice's signature} OP_TRUE
      const tx = txb.buildIncomplete()
      const signatureHash = tx.hashForSignature(0, p2sh.redeem.output, hashType)
      const redeemScriptSig = bitcoin.payments.p2sh({
        network: regtest,
        redeem: {
          network: regtest,
          output: p2sh.redeem.output,
          input: bitcoin.script.compile([
            bitcoin.script.signature.encode(alice.sign(signatureHash), hashType),
            bitcoin.script.signature.encode(bob.sign(signatureHash), hashType),
            bitcoin.opcodes.OP_TRUE
          ])
        }
      }).input
      tx.setInputScript(0, redeemScriptSig)

      regtestUtils.broadcast(tx.toHex(), function (err) {
        assert.throws(function () {
          if (err) throw err
        }, /Error: non-BIP68-final \(code 64\)/)

        done()
      })
    })
  })
})
