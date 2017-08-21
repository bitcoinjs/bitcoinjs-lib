/* global describe, it */

var assert = require('assert')
var bitcoin = require('../../')
var dhttp = require('dhttp/200')
var testnet = bitcoin.networks.testnet
var testnetUtils = require('./_testnet')

function rng () {
  return Buffer.from('YT8dAtK4d16A3P1z+TpwB2jJ4aFH3g9M1EioIBkLEV4=', 'base64')
}

describe('bitcoinjs-lib (transactions)', function () {
  it('can create a 1-to-1 Transaction', function () {
    var alice = bitcoin.ECPair.fromWIF('L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy')
    var tx = new bitcoin.TransactionBuilder()

    tx.addInput('61d520ccb74288c96bc1a2b20ea1c0d5a704776dd0164a396efec3ea7040349d', 0) // Alice's previous transaction output, has 15000 satoshis
    tx.addOutput('1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP', 12000)
    // (in)15000 - (out)12000 = (fee)3000, this is the miner fee

    tx.sign(0, alice)

    // prepare for broadcast to the Bitcoin network, see "can broadcast a Transaction" below
    assert.strictEqual(tx.build().toHex(), '01000000019d344070eac3fe6e394a16d06d7704a7d5c0a10eb2a2c16bc98842b7cc20d561000000006b48304502210088828c0bdfcdca68d8ae0caeb6ec62cd3fd5f9b2191848edae33feb533df35d302202e0beadd35e17e7f83a733f5277028a9b453d525553e3f5d2d7a7aa8010a81d60121029f50f51d63b345039a290c94bffd3180c99ed659ff6ea6b1242bca47eb93b59fffffffff01e02e0000000000001976a91406afd46bcdfd22ef94ac122aa11f241244a37ecc88ac00000000')
  })

  it('can create a 2-to-2 Transaction', function () {
    var alice = bitcoin.ECPair.fromWIF('L1Knwj9W3qK3qMKdTvmg3VfzUs3ij2LETTFhxza9LfD5dngnoLG1')
    var bob = bitcoin.ECPair.fromWIF('KwcN2pT3wnRAurhy7qMczzbkpY5nXMW2ubh696UBc1bcwctTx26z')

    var tx = new bitcoin.TransactionBuilder()
    tx.addInput('b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c', 6) // Alice's previous transaction output, has 200000 satoshis
    tx.addInput('7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730', 0) // Bob's previous transaction output, has 300000 satoshis
    tx.addOutput('1CUNEBjYrCn2y1SdiUMohaKUi4wpP326Lb', 180000)
    tx.addOutput('1JtK9CQw1syfWj1WtFMWomrYdV3W2tWBF9', 170000)
    // (in)(200000 + 300000) - (out)(180000 + 150000) = (fee)170000, this is the miner fee

    tx.sign(1, bob) // Bob signs his input, which was the second input (1th)
    tx.sign(0, alice) // Alice signs her input, which was the first input (0th)

    // prepare for broadcast to the Bitcoin network, see "can broadcast a Transaction" below
    assert.strictEqual(tx.build().toHex(), '01000000024c94e48a870b85f41228d33cf25213dfcc8dd796e7211ed6b1f9a014809dbbb5060000006a473044022041450c258ce7cac7da97316bf2ea1ce66d88967c4df94f3e91f4c2a30f5d08cb02203674d516e6bb2b0afd084c3551614bd9cec3c2945231245e891b145f2d6951f0012103e05ce435e462ec503143305feb6c00e06a3ad52fbf939e85c65f3a765bb7baacffffffff3077d9de049574c3af9bc9c09a7c9db80f2d94caaf63988c9166249b955e867d000000006b483045022100aeb5f1332c79c446d3f906e4499b2e678500580a3f90329edf1ba502eec9402e022072c8b863f8c8d6c26f4c691ac9a6610aa4200edc697306648ee844cfbc089d7a012103df7940ee7cddd2f97763f67e1fb13488da3fbdd7f9c68ec5ef0864074745a289ffffffff0220bf0200000000001976a9147dd65592d0ab2fe0d0257d571abf032cd9db93dc88ac10980200000000001976a914c42e7ef92fdb603af844d064faad95db9bcdfd3d88ac00000000')
  })

  it('can create (and broadcast via 3PBP) a typical Transaction', function (done) {
    this.timeout(30000)

    var alice1 = bitcoin.ECPair.makeRandom({ network: testnet })
    var alice2 = bitcoin.ECPair.makeRandom({ network: testnet })
    var aliceChange = bitcoin.ECPair.makeRandom({ rng: rng, network: testnet })

    // "simulate" on testnet that Alice has 2 unspent outputs
    testnetUtils.faucetMany([
      {
        address: alice1.getAddress(),
        value: 5e4
      },
      {
        address: alice2.getAddress(),
        value: 7e4
      }
    ], function (err, unspents) {
      if (err) return done(err)

      var tx = new bitcoin.TransactionBuilder(testnet)
      tx.addInput(unspents[0].txId, unspents[0].vout) // alice1 unspent
      tx.addInput(unspents[1].txId, unspents[1].vout) // alice2 unspent
      tx.addOutput('mwCwTceJvYV27KXBc3NJZys6CjsgsoeHmf', 8e4) // the actual "spend"
      tx.addOutput(aliceChange.getAddress(), 1e4) // Alice's change
      // (in)(4e4 + 2e4) - (out)(1e4 + 3e4) = (fee)2e4 = 20000, this is the miner fee

      // Alice signs each input with the respective private keys
      tx.sign(0, alice1)
      tx.sign(1, alice2)

      // build and broadcast to the Bitcoin Testnet network
      dhttp({
        method: 'POST',
        url: 'https://api.ei8ht.com.au:9443/3/pushtx',
//          url: 'http://tbtc.blockr.io/api/v1/tx/push',
        body: tx.build().toHex()
      }, done)
      // to build and broadcast to the actual Bitcoin network, see https://github.com/bitcoinjs/bitcoinjs-lib/issues/839
    })
  })

  it('can create (and broadcast via 3PBP) a Transaction with an OP_RETURN output', function (done) {
    this.timeout(30000)

    var keyPair = bitcoin.ECPair.makeRandom({ network: testnet })
    var address = keyPair.getAddress()

    testnetUtils.faucet(address, 5e4, function (err, unspent) {
      if (err) return done(err)

      var tx = new bitcoin.TransactionBuilder(testnet)
      var data = Buffer.from('bitcoinjs-lib', 'utf8')
      var dataScript = bitcoin.script.nullData.output.encode(data)

      tx.addInput(unspent.txId, unspent.vout)
      tx.addOutput(dataScript, 1000)
      tx.addOutput(testnetUtils.RETURN_ADDRESS, 4e4)
      tx.sign(0, keyPair)

      // build and broadcast to the Bitcoin Testnet network
      dhttp({
        method: 'POST',
        url: 'https://api.ei8ht.com.au:9443/3/pushtx',
        body: tx.build().toHex()
      }, done)
    })
  })

  it('can create (and broadcast via 3PBP) a Transaction with a 2-of-4 P2SH(multisig) input', function (done) {
    this.timeout(30000)

    var keyPairs = [
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx9rcrL7'
    ].map(function (wif) { return bitcoin.ECPair.fromWIF(wif, testnet) })
    var pubKeys = keyPairs.map(function (x) { return x.getPublicKeyBuffer() })

    var redeemScript = bitcoin.script.multisig.output.encode(2, pubKeys)
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, testnet)

    testnetUtils.faucet(address, 2e4, function (err, unspent) {
      if (err) return done(err)

      var txb = new bitcoin.TransactionBuilder(testnet)
      txb.addInput(unspent.txId, unspent.vout)
      txb.addOutput(testnetUtils.RETURN_ADDRESS, 1e4)

      txb.sign(0, keyPairs[0], redeemScript)
      txb.sign(0, keyPairs[2], redeemScript)

      var tx = txb.build()

      // build and broadcast to the Bitcoin Testnet network
      testnetUtils.transactions.propagate(tx.toHex(), function (err) {
        if (err) return done(err)

        testnetUtils.verify(address, tx.getId(), 1e4, done)
      })
    })
  })

  it('can create (and broadcast via 3PBP) a Transaction with a SegWit P2SH(P2WPKH) input', function (done) {
    this.timeout(30000)

    var keyPair = bitcoin.ECPair.fromWIF('cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA', testnet)
    var pubKey = keyPair.getPublicKeyBuffer()
    var pubKeyHash = bitcoin.crypto.hash160(pubKey)

    var redeemScript = bitcoin.script.witnessPubKeyHash.output.encode(pubKeyHash)
    var redeemScriptHash = bitcoin.crypto.hash160(redeemScript)

    var scriptPubKey = bitcoin.script.scriptHash.output.encode(redeemScriptHash)
    var address = bitcoin.address.fromOutputScript(scriptPubKey, testnet)

    testnetUtils.faucet(address, 5e4, function (err, unspent) {
      if (err) return done(err)

      var txb = new bitcoin.TransactionBuilder(testnet)
      txb.addInput(unspent.txId, unspent.vout)
      txb.addOutput(testnetUtils.RETURN_ADDRESS, 4e4)
      txb.sign(0, keyPair, redeemScript, null, unspent.value)

      var tx = txb.build()

      // build and broadcast to the Bitcoin Testnet network
      testnetUtils.transactions.propagate(tx.toHex(), function (err) {
        if (err) return done(err)

        testnetUtils.verify(address, tx.getId(), 1e4, done)
      })
    })
  })

  it('can create (and broadcast via 3PBP) a Transaction with a SegWit 3-of-4 P2SH(P2WSH(multisig)) input', function (done) {
    this.timeout(50000)

    var keyPairs = [
      'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
      'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87K7XCyj5v',
      'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87KcLPVfXz',
      'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87L7FgDCKE'
    ].map(function (wif) { return bitcoin.ECPair.fromWIF(wif, testnet) })
    var pubKeys = keyPairs.map(function (x) { return x.getPublicKeyBuffer() })

    var witnessScript = bitcoin.script.multisig.output.encode(3, pubKeys)
    var redeemScript = bitcoin.script.witnessScriptHash.output.encode(bitcoin.crypto.sha256(witnessScript))
    var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, testnet)

    testnetUtils.faucet(address, 6e4, function (err, unspent) {
      if (err) return done(err)

      var txb = new bitcoin.TransactionBuilder(testnet)
      txb.addInput(unspent.txId, unspent.vout)
      txb.addOutput(testnetUtils.RETURN_ADDRESS, 4e4)
      txb.sign(0, keyPairs[0], redeemScript, null, unspent.value, witnessScript)
      txb.sign(0, keyPairs[2], redeemScript, null, unspent.value, witnessScript)
      txb.sign(0, keyPairs[3], redeemScript, null, unspent.value, witnessScript)

      var tx = txb.build()

      // build and broadcast to the Bitcoin Testnet network
      testnetUtils.transactions.propagate(tx.toHex(), function (err) {
        if (err) return done(err)

        testnetUtils.verify(address, tx.getId(), 4e4, done)
      })
    })
  })
})
