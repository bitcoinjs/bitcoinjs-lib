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

  it('can create, propagate, retrieve and read a message with an OP_RETURN transaction', function(done) {

    helloblock.faucet.get(1, function(err, res, body) {
      if (err) return done(err)

      var key = bitcoin.ECKey.fromWIF(body.privateKeyWIF)
      var address = body.address
      var unspent = body.unspents[0]

      // generate a random string and encode as a data output
      var message = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5)
      var data = new Buffer(message)
      var dataScript = bitcoin.scripts.dataOutput(data)

      var txb = new TransactionBuilder()
      txb.addInput(unspent.txHash, unspent.index)
      txb.addOutput(address, unspent.value - 100)
      txb.addOutput(dataScript, 100)
      txb.sign(0, key)

      helloblock.transactions.propagate(txb.build().toHex(), function(err) {
        // no err means that the transaction has been successfully propagated
        if (err) return done(err)

        // Check that the message was propagated
        helloblock.addresses.getTransactions(address, function(err, res, transactions) {
          if (err) return done(err)

          var transaction = transactions[0]

          var messageCheck

          // Loop through the outputs and decode the message
          var outputs = transaction.outputs
          for (var j = outputs.length - 1; j >= 0; j--) {
            var output = outputs[j]
            var scriptPubKey = output.scriptPubKey
            var scriptPubKeyBuffer = new Buffer(scriptPubKey, 'hex')
            if (scriptPubKeyBuffer[0] == 106) {
              var messageBuffer = scriptPubKeyBuffer.slice(2,scriptPubKeyBuffer.length)
              messageCheck = messageBuffer.toString()
            }
          }

          assert.equal(message, messageCheck)
          done()
        })
      })
    })
  })

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
