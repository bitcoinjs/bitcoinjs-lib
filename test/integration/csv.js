const { describe, it, before } = require('mocha')
const assert = require('assert')
const bitcoin = require('../../')
const regtestUtils = require('./_regtest')
const regtest = regtestUtils.network
const bip68 = require('bip68')

const alice = bitcoin.ECPair.fromWIF('cScfkGjbzzoeewVWmU2hYPUHeVGJRDdFt7WhmrVVGkxpmPP8BHWe', regtest)
const bob = bitcoin.ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsLwjHXA9x', regtest)
const charles = bitcoin.ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsMSb4Ubnf', regtest)
const dave = bitcoin.ECPair.fromWIF('cMkopUXKWsEzAjfa1zApksGRwjVpJRB3831qM9W4gKZsMwS4pqnx', regtest)
console.warn = () => {} // Silence the Deprecation Warning

describe('bitcoinjs-lib (transactions w/ CSV)', () => {
  // force update MTP
  before(async () => {
    await regtestUtils.mine(11)
  })

  const hashType = bitcoin.Transaction.SIGHASH_ALL

  // IF MTP (from when confirmed) > seconds, _alice can redeem
  function csvCheckSigOutput (_alice, _bob, sequence) {
    return bitcoin.script.fromASM(`
      OP_IF
          ${bitcoin.script.number.encode(sequence).toString('hex')}
          OP_CHECKSEQUENCEVERIFY
          OP_DROP
      OP_ELSE
          ${_bob.publicKey.toString('hex')}
          OP_CHECKSIGVERIFY
      OP_ENDIF
      ${_alice.publicKey.toString('hex')}
      OP_CHECKSIG
    `.trim().replace(/\s+/g, ' '))
  }

  // 2 of 3 multisig of _bob, _charles, _dave,
  // but after sequence1 time, _alice can allow the multisig to become 1 of 3.
  // but after sequence2 time, _alice can sign for the output all by themself.
  // Ref: https://github.com/bitcoinbook/bitcoinbook/blob/f8b883dcd4e3d1b9adf40fed59b7e898fbd9241f/ch07.asciidoc#complex-script-example
  // Note: bitcoinjs-lib will not offer specific support for problems with
  //       advanced script usages such as below. Use at your own risk.
  function complexCsvOutput (_alice, _bob, _charles, _dave, sequence1, sequence2) {
    return bitcoin.script.fromASM(`
      OP_IF
          OP_IF
              OP_2
          OP_ELSE
              ${bitcoin.script.number.encode(sequence1).toString('hex')}
              OP_CHECKSEQUENCEVERIFY
              OP_DROP
              ${_alice.publicKey.toString('hex')}
              OP_CHECKSIGVERIFY
              OP_1
          OP_ENDIF
          ${_bob.publicKey.toString('hex')}
          ${_charles.publicKey.toString('hex')}
          ${_dave.publicKey.toString('hex')}
          OP_3
          OP_CHECKMULTISIG
      OP_ELSE
          ${bitcoin.script.number.encode(sequence2).toString('hex')}
          OP_CHECKSEQUENCEVERIFY
          OP_DROP
          ${_alice.publicKey.toString('hex')}
          OP_CHECKSIG
      OP_ENDIF
    `.trim().replace(/\s+/g, ' '))
  }

  // expiry will pass, {Alice's signature} OP_TRUE
  it('can create (and broadcast via 3PBP) a Transaction where Alice can redeem the output after the expiry (in the future) (simple CHECKSEQUENCEVERIFY)', async () => {
    // 5 blocks from now
    const sequence = bip68.encode({ blocks: 5 })
    const p2sh = bitcoin.payments.p2sh({
      redeem: {
        output: csvCheckSigOutput(alice, bob, sequence)
      },
      network: regtest
    })

    // fund the P2SH(CSV) address
    const unspent = await regtestUtils.faucet(p2sh.address, 1e5)

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
    await regtestUtils.mine(10)

    await regtestUtils.broadcast(tx.toHex())

    await regtestUtils.verify({
      txId: tx.getId(),
      address: regtestUtils.RANDOM_ADDRESS,
      vout: 0,
      value: 7e4
    })
  })

  // expiry in the future, {Alice's signature} OP_TRUE
  it('can create (but fail to broadcast via 3PBP) a Transaction where Alice attempts to redeem before the expiry (simple CHECKSEQUENCEVERIFY)', async () => {
    // two hours after confirmation
    const sequence = bip68.encode({ seconds: 7168 })
    const p2sh = bitcoin.payments.p2sh({
      network: regtest,
      redeem: {
        output: csvCheckSigOutput(alice, bob, sequence)
      }
    })

    // fund the P2SH(CSV) address
    const unspent = await regtestUtils.faucet(p2sh.address, 2e4)

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

    await regtestUtils.broadcast(tx.toHex()).catch(err => {
      assert.throws(() => {
        if (err) throw err
      }, /Error: non-BIP68-final \(code 64\)/)
    })
  })

  // Check first combination of complex CSV, 2 of 3
  it('can create (and broadcast via 3PBP) a Transaction where Bob and Charles can send (complex CHECKSEQUENCEVERIFY)', async () => {
    const height = await regtestUtils.height()

    // 2 blocks from now
    const sequence1 = bip68.encode({ blocks: 2 })
    // 5 blocks from now
    const sequence2 = bip68.encode({ blocks: 5 })
    const p2sh = bitcoin.payments.p2sh({
      redeem: {
        output: complexCsvOutput(alice, bob, charles, dave, sequence1, sequence2)
      },
      network: regtest
    })

    // fund the P2SH(CCSV) address
    const unspent = await regtestUtils.faucet(p2sh.address, 1e5)

    const txb = new bitcoin.TransactionBuilder(regtest)
    txb.addInput(unspent.txId, unspent.vout)
    txb.addOutput(regtestUtils.RANDOM_ADDRESS, 7e4)

    // OP_0 {Bob sig} {Charles sig} OP_TRUE OP_TRUE
    const tx = txb.buildIncomplete()
    const signatureHash = tx.hashForSignature(0, p2sh.redeem.output, hashType)
    const redeemScriptSig = bitcoin.payments.p2sh({
      network: regtest,
      redeem: {
        network: regtest,
        output: p2sh.redeem.output,
        input: bitcoin.script.compile([
          bitcoin.opcodes.OP_0,
          bitcoin.script.signature.encode(bob.sign(signatureHash), hashType),
          bitcoin.script.signature.encode(charles.sign(signatureHash), hashType),
          bitcoin.opcodes.OP_TRUE,
          bitcoin.opcodes.OP_TRUE
        ])
      }
    }).input
    tx.setInputScript(0, redeemScriptSig)

    await regtestUtils.broadcast(tx.toHex())

    await regtestUtils.verify({
      txId: tx.getId(),
      address: regtestUtils.RANDOM_ADDRESS,
      vout: 0,
      value: 7e4
    })
  })

  // Check first combination of complex CSV, mediator + 1 of 3 after 2 blocks
  it('can create (and broadcast via 3PBP) a Transaction where Alice (mediator) and Bob can send after 2 blocks (complex CHECKSEQUENCEVERIFY)', async () => {
    const height = await regtestUtils.height()

    // 2 blocks from now
    const sequence1 = bip68.encode({ blocks: 2 })
    // 5 blocks from now
    const sequence2 = bip68.encode({ blocks: 5 })
    const p2sh = bitcoin.payments.p2sh({
      redeem: {
        output: complexCsvOutput(alice, bob, charles, dave, sequence1, sequence2)
      },
      network: regtest
    })

    // fund the P2SH(CCSV) address
    const unspent = await regtestUtils.faucet(p2sh.address, 1e5)

    const txb = new bitcoin.TransactionBuilder(regtest)
    txb.addInput(unspent.txId, unspent.vout, sequence1) // Set sequence1 for input
    txb.addOutput(regtestUtils.RANDOM_ADDRESS, 7e4)

    // OP_0 {Bob sig} {Alice mediator sig} OP_FALSE OP_TRUE
    const tx = txb.buildIncomplete()
    const signatureHash = tx.hashForSignature(0, p2sh.redeem.output, hashType)
    const redeemScriptSig = bitcoin.payments.p2sh({
      network: regtest,
      redeem: {
        network: regtest,
        output: p2sh.redeem.output,
        input: bitcoin.script.compile([
          bitcoin.opcodes.OP_0,
          bitcoin.script.signature.encode(bob.sign(signatureHash), hashType),
          bitcoin.script.signature.encode(alice.sign(signatureHash), hashType),
          bitcoin.opcodes.OP_0,
          bitcoin.opcodes.OP_TRUE
        ])
      }
    }).input
    tx.setInputScript(0, redeemScriptSig)

    // Wait 2 blocks
    await regtestUtils.mine(2)

    await regtestUtils.broadcast(tx.toHex())

    await regtestUtils.verify({
      txId: tx.getId(),
      address: regtestUtils.RANDOM_ADDRESS,
      vout: 0,
      value: 7e4
    })
  })

  // Check first combination of complex CSV, mediator after 5 blocks
  it('can create (and broadcast via 3PBP) a Transaction where Alice (mediator) can send after 5 blocks (complex CHECKSEQUENCEVERIFY)', async () => {
    const height = await regtestUtils.height()

    // 2 blocks from now
    const sequence1 = bip68.encode({ blocks: 2 })
    // 5 blocks from now
    const sequence2 = bip68.encode({ blocks: 5 })
    const p2sh = bitcoin.payments.p2sh({
      redeem: {
        output: complexCsvOutput(alice, bob, charles, dave, sequence1, sequence2)
      },
      network: regtest
    })

    // fund the P2SH(CCSV) address
    const unspent = await regtestUtils.faucet(p2sh.address, 1e5)

    const txb = new bitcoin.TransactionBuilder(regtest)
    txb.addInput(unspent.txId, unspent.vout, sequence2) // Set sequence2 for input
    txb.addOutput(regtestUtils.RANDOM_ADDRESS, 7e4)

    // {Alice mediator sig} OP_FALSE
    const tx = txb.buildIncomplete()
    const signatureHash = tx.hashForSignature(0, p2sh.redeem.output, hashType)
    const redeemScriptSig = bitcoin.payments.p2sh({
      network: regtest,
      redeem: {
        network: regtest,
        output: p2sh.redeem.output,
        input: bitcoin.script.compile([
          bitcoin.script.signature.encode(alice.sign(signatureHash), hashType),
          bitcoin.opcodes.OP_0
        ])
      }
    }).input
    tx.setInputScript(0, redeemScriptSig)

    // Wait 5 blocks
    await regtestUtils.mine(5)

    await regtestUtils.broadcast(tx.toHex())

    await regtestUtils.verify({
      txId: tx.getId(),
      address: regtestUtils.RANDOM_ADDRESS,
      vout: 0,
      value: 7e4
    })
  })
})
