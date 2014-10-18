var assert = require('assert')

var bitcoin = require('../../')
var networks = bitcoin.networks
var scripts = bitcoin.scripts

var Address = bitcoin.Address
var ECKey = bitcoin.ECKey
var TransactionBuilder = bitcoin.TransactionBuilder

var helloblock = require('helloblock-js')({
  network: 'testnet'
})

describe('bitcoinjs-lib (helloblock)', function() {
  this.timeout(20000)

  it('can spend from a 2-of-2 address', function(done) {
    var privKeys = [
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT'
    ].map(ECKey.fromWIF)
    var pubKeys = privKeys.map(function(x) { return x.pub })

    var redeemScript = scripts.multisigOutput(2, pubKeys)
    var scriptPubKey = scripts.scriptHashOutput(redeemScript.getHash())
    var p2shAddress = Address.fromOutputScript(scriptPubKey, networks.testnet).toString()

    // Attempt to send funds to the source address
    helloblock.faucet.withdraw(p2shAddress, 2e4, function(err) {
      if (err) return done(err)

      // get latest unspents from the p2shAddress
      helloblock.addresses.getUnspents(p2shAddress, function(err, res, unspents) {
        if (err) return done(err)

        // use the oldest unspent
        var unspent = unspents[unspents.length - 1]
        var spendAmount = Math.min(unspent.value, 1e4)

        // make a random destination address
        var targetAddress = ECKey.makeRandom().pub.getAddress(networks.testnet).toString()

        var txb = new TransactionBuilder()
        txb.addInput(unspent.txHash, unspent.index)
        txb.addOutput(targetAddress, spendAmount)

        privKeys.forEach(function(privKey) {
          txb.sign(0, privKey, redeemScript)
        })

        // broadcast our transaction
        helloblock.transactions.propagate(txb.build().toHex(), function(err) {
          // no err means that the transaction has been successfully propagated
          if (err) return done(err)

          // check that the funds (spendAmount Satoshis) indeed arrived at the intended address
          helloblock.addresses.get(targetAddress, function(err, res, addrInfo) {
            if (err) return done(err)

            assert.equal(addrInfo.balance, spendAmount)
            done()
          })
        })
      })
    })
  })
})
