var assert = require('assert')

var bitcoin = require('../../')
var crypto = bitcoin.crypto
var networks = bitcoin.networks
var scripts = bitcoin.scripts

var Address = bitcoin.Address
var ECKey = bitcoin.ECKey
var Transaction = bitcoin.Transaction
var Script = bitcoin.Script

var helloblock = require('helloblock-js')({
  network: 'testnet'
})

describe('Bitcoin-js', function() {
  this.timeout(10000)

  it('can spend from a 2-of-2 address', function(done) {
    var privKeys = [
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT'
    ].map(function(wif) {
      return ECKey.fromWIF(wif)
    })

    var coldAmount = 2e4
    var outputAmount = 1e4

    var pubKeys = privKeys.map(function(eck) { return eck.pub })
    var redeemScript = scripts.multisigOutput(2, pubKeys)
    var scriptPubKey = scripts.scriptHashOutput(redeemScript.getHash())

    var multisigAddress = Address.fromOutputScript(scriptPubKey, networks.testnet).toString()

    // Attempt to send funds to the source address, providing some unspents for later
    helloblock.faucet.withdraw(multisigAddress, coldAmount, function(err) {
      if (err) return done(err)
    })

    // make a random private key
    var targetAddress = ECKey.makeRandom().pub.getAddress(networks.testnet).toString()

    // get latest unspents from the multisigAddress
    helloblock.addresses.getUnspents(multisigAddress, function(err, resp, resource) {
      if (err) return done(err)

      // use the oldest unspent
      var unspent = resource[resource.length - 1]
      var spendAmount = Math.min(unspent.value, outputAmount)

      var tx = new Transaction()
      tx.addInput(unspent.txHash, unspent.index)
      tx.addOutput(targetAddress, spendAmount)

      var signatures = privKeys.map(function(privKey) {
        return tx.signInput(0, redeemScript, privKey)
      })

      var redeemScriptSig = scripts.multisigInput(signatures)
      var scriptSig = scripts.scriptHashInput(redeemScriptSig, redeemScript)
      tx.setInputScript(0, scriptSig)

      // broadcast our transaction
      helloblock.transactions.propagate(tx.toHex(), function(err, resp, resource) {
        // no err means that the transaction has been successfully propagated
        if (err) return done(err)

        // Check that the funds (spendAmount Satoshis) indeed arrived at the intended address
        helloblock.addresses.get(targetAddress, function(err, resp, resource) {
          if (err) return done(err)

          assert.equal(resource.balance, spendAmount)
          done()
        })
      })
    })
  })
})
