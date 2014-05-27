var assert = require('assert')

var bitcoin = require('../../')
var crypto = bitcoin.crypto
var networks = bitcoin.networks

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

    // how much to withdraw if we run dry
    var coldAmount = 2e4
    var outputAmount = 1e4

    var pubKeys = privKeys.map(function(eck) { return eck.pub })
    var redeemScript = Script.createMultisigScriptPubKey(2, pubKeys)
    var hash160 = crypto.hash160(new Buffer(redeemScript.buffer))
    var multisigAddress = new Address(hash160, networks.testnet.scriptHash).toString()

    // Send some testnet coins to the multisig address to ensure it has some unspents for later
    helloblock.faucet.withdraw(multisigAddress, coldAmount, function(err) {
      if (err) return done(err)
    })

    // make a random private key
    var targetAddress = ECKey.makeRandom().pub.getAddress(networks.testnet.pubKeyHash).toString()

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
        return tx.signScriptSig(0, redeemScript, privKey)
      })

      var redeemScriptSig = Script.createMultisigScriptSig(signatures)
      var scriptSig = Script.createP2SHScriptSig(redeemScriptSig, redeemScript)
      tx.setScriptSig(0, scriptSig)

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
