/* global describe, it */

var async = require('async')
var assert = require('assert')
var bitcoin = require('../../')
var blockchain = require('./_blockchain')

describe('bitcoinjs-lib (multisig)', function () {
  it('can create a 2-of-3 multisig P2SH address', function () {
    var pubKeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map(function (hex) {
      return new Buffer(hex, 'hex')
    })

    var redeemScript = bitcoin.script.multisigOutput(2, pubKeys) // 2 of 3
    var scriptPubKey = bitcoin.script.scriptHashOutput(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey)

    assert.strictEqual(address, '36NUkt6FWUi3LAWBqWRdDmdTWbt91Yvfu7')
  })

  it('can spend from a 2-of-4 multsig P2SH address', function (done) {
    this.timeout(30000)

    var keyPairs = [
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx9rcrL7'
    ].map(function (wif) { return bitcoin.ECPair.fromWIF(wif, bitcoin.networks.testnet) })
    var pubKeys = keyPairs.map(function (x) { return x.getPublicKeyBuffer() })

    var redeemScript = bitcoin.script.multisigOutput(2, pubKeys) // 2 of 4
    var scriptPubKey = bitcoin.script.scriptHashOutput(bitcoin.crypto.hash160(redeemScript))
    var address = bitcoin.address.fromOutputScript(scriptPubKey, bitcoin.networks.testnet)

    // attempt to send funds to the source address
    blockchain.t.faucet(address, 2e4, function (err, unspent) {
      if (err) return done(err)

      var fee = 1e4
      var targetValue = unspent.value - fee

      // make a random destination address
      var targetAddress = bitcoin.ECPair.makeRandom({
        network: bitcoin.networks.testnet
      }).getAddress()

      var txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet)
      txb.addInput(unspent.txId, unspent.vout)
      txb.addOutput(targetAddress, targetValue)

      // sign with 1st and 3rd key
      txb.sign(0, keyPairs[0], redeemScript)
      txb.sign(0, keyPairs[2], redeemScript)

      // broadcast our transaction
      var tx = txb.build()
      var txId = tx.getId()

      blockchain.t.transactions.propagate(tx.toHex(), function (err) {
        if (err) return done(err)

        // allow for TX to be processed
        async.retry(5, function (callback) {
          setTimeout(function () {
            // check that the above transaction included the intended address
            blockchain.t.addresses.unspents(targetAddress, function (err, unspents) {
              if (err) return callback(err)

              var unspentFound = unspents.some(function (unspent) {
                return unspent.txId === txId && unspent.value === targetValue
              })

              if (!unspentFound) return callback(new Error('Could not find unspent after propagate'))
              callback()
            })
          }, 600)
        }, done)
      })
    })
  })
})
