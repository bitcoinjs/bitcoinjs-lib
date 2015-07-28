/* global describe, it */

var assert = require('assert')
var bitcoin = require('../../')
var blockchain = new (require('cb-insight'))('https://test-insight.bitpay.com')
var faucetWithdraw = require('./utils').faucetWithdraw
var pollUnspent = require('./utils').pollUnspent
var pollSummary = require('./utils').pollSummary

describe('bitcoinjs-lib (multisig)', function () {
  it('can create a 2-of-3 multisig P2SH address', function () {
    var pubKeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map(function (hex) {
      return new Buffer(hex, 'hex')
    })

    var redeemScript = bitcoin.scripts.multisigOutput(2, pubKeys) // 2 of 3
    var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash())
    var address = bitcoin.Address.fromOutputScript(scriptPubKey).toString()

    assert.strictEqual(address, '36NUkt6FWUi3LAWBqWRdDmdTWbt91Yvfu7')
  })

  it('can spend from a 2-of-4 multsig P2SH address', function (done) {
    this.timeout(20000)

    var keyPairs = [
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx9rcrL7'
    ].map(function (wif) { return bitcoin.ECPair.fromWIF(wif, bitcoin.networks.testnet) })
    var pubKeys = keyPairs.map(function (x) { return x.getPublicKeyBuffer() })

    var redeemScript = bitcoin.scripts.multisigOutput(2, pubKeys) // 2 of 4
    var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash())
    var address = bitcoin.Address.fromOutputScript(scriptPubKey, bitcoin.networks.testnet).toString()

    // Attempt to send funds to the source address
    faucetWithdraw(address, 2e4, function (err) {
      if (err) return done(err)

      // get latest unspents from the address
      pollUnspent(blockchain, address, function (err, unspents) {
        if (err) return done(err)

          // filter small unspents
        unspents = unspents.filter(function (unspent) {
          return unspent.value > 1e4
        })

        // use the oldest unspent
        var unspent = unspents.pop()

        // make a random destination address
        var targetAddress = bitcoin.ECPair.makeRandom({
          network: bitcoin.networks.testnet
        }).getAddress()

        var txb = new bitcoin.TransactionBuilder()
        txb.addInput(unspent.txId, unspent.vout)
        txb.addOutput(targetAddress, 1e4)

        // sign with 1st and 3rd key
        txb.sign(0, keyPairs[0], redeemScript)
        txb.sign(0, keyPairs[2], redeemScript)

        // broadcast our transaction
        blockchain.transactions.propagate(txb.build().toHex(), function (err) {
          if (err) return done(err)

          // check that the funds (1e4 Satoshis) indeed arrived at the intended address
          pollSummary(blockchain, targetAddress, function (err, result) {
            if (err) return done(err)

            assert.strictEqual(result.balance, 1e4)
            done()
          })
        })
      })
    })
  })
})
