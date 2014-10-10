var assert = require('assert')

var bitcoin = require('../../')
var networks = bitcoin.networks
var scripts = bitcoin.scripts

var Address = bitcoin.Address
var ECPair = bitcoin.ECPair
var Transaction = bitcoin.Transaction

var helloblock = require('helloblock-js')({
  network: 'testnet'
})

describe('Bitcoin-js', function() {
  this.timeout(10000)

  it('can spend from a 2-of-2 address', function(done) {
    var keyPairs = [
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT'
    ].map(function(wif) {
      return ECPair.fromWIF(wif, networks.testnet)
    })

    var coldAmount = 2e4
    var outputAmount = 1e4

    var pubKeys = keyPairs.map(function(kp) { return kp.getPublicKey() })
    var redeemScript = scripts.multisigOutput(2, pubKeys)
    var scriptPubKey = scripts.scriptHashOutput(redeemScript.getHash())

    var multisigAddress = Address.fromOutputScript(scriptPubKey, networks.testnet).toString()

    // Attempt to send funds to the source address, providing some unspents for later
    helloblock.faucet.withdraw(multisigAddress, coldAmount, function(err) {
      if (err) return done(err)
    })

    // get latest unspents from the multisigAddress
    helloblock.addresses.getUnspents(multisigAddress, function(err, res, unspents) {
      if (err) return done(err)

      // use the oldest unspent
      var unspent = unspents[unspents.length - 1]
      var spendAmount = Math.min(unspent.value, outputAmount)

      // make a random key pair
      var targetAddress = ECPair.makeRandom({ network: networks.testnet }).getAddress().toString()

      var txb = new Transaction()
      txb.addInput(unspent.txHash, unspent.index)
      txb.addOutput(targetAddress, spendAmount)

      keyPairs.forEach(function(keyPair) {
        txb.sign(0, keyPair, redeemScript)
      })

      // broadcast our transaction
      helloblock.transactions.propagate(txb.build().toHex(), function(err) {
        // no err means that the transaction has been successfully propagated
        if (err) return done(err)

        console.log('addrs', targetAddress, multisigAddress)

        // Check that the funds (spendAmount Satoshis) indeed arrived at the intended address
        helloblock.addresses.get(targetAddress, function(err, res, addrInfo) {
          if (err) return done(err)

          assert.equal(addrInfo.balance, spendAmount)
          done()
        })
      })
    })
  })
})
