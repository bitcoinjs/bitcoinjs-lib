var assert = require('assert');

var Address = require('../../src/address');
var ECKey = require('../../src/eckey').ECKey;
var T = require('../../src/transaction');
var Transaction = T.Transaction;
var Script = require('../../src/script');
var network = require('../../src/network');
var crypto = require('../../src/crypto');

var helloblock = require('helloblock-js')({
  network: 'testnet'
});

describe('p2sh', function() {
  this.timeout(10000);

  it('spends from a 2-of-2 address', function(done) {
    var privKeys = [
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
      '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT'
    ].map(function(wif) {
      return ECKey.fromWIF(wif)
    })

    var pubKeys = privKeys.map(function(eck) {
      return eck.pub
    })
    var pubKeyBuffers = pubKeys.map(function(q) {
      return q.toBuffer()
    })
    var redeemScript = Script.createMultisigOutputScript(2, pubKeyBuffers)
    var hash160 = crypto.hash160(redeemScript.buffer)
    var multisigAddress = new Address(hash160, network.testnet.scriptHash)

    // Check what our target address's starting value is
    var targetAddress = 'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r';
    helloblock.addresses.get(targetAddress, function(err, resp, resource) {
      if (err) done(err);
      var startingBalance = resource.balance

      // Send some testnet coins to the multisig address so we ensure it has some unspents
      helloblock.faucet.withdraw(multisigAddress.toString(), 100000, function(err, resp, resource) {
        if (err) done(err);

        // Get latest unspents from the mutlsigAddress
        helloblock.addresses.getUnspents(multisigAddress.toString(), function(err, resp, resource) {
          if (err) done(err);

          var tx = new Transaction()
          var unspent = resource[0];
          tx.addInput(unspent.txHash, unspent.index)
          tx.addOutput(targetAddress, 100000, network.testnet)

          var signatures = privKeys.map(function(privKey) {
            return tx.signScriptSig(0, redeemScript, privKey)
          })

          var scriptSig = Script.createP2SHMultisigScriptSig(signatures, redeemScript)
          tx.setScriptSig(0, scriptSig)

          // Send from mutlsigAddress to targetAddress
          helloblock.transactions.propagate(tx.serializeHex(), function(err, resp, resource) {
            // no err means that transaction has been successfully propagated
            if (err) done(err);

            // Check that the funds (100000) indeed arrived at the intended target address
            helloblock.addresses.get(targetAddress, function(err, resp, resource) {
              if (err) done(err);
              assert.equal(resource.balance, startingBalance + 100000)
              done()
            })
          })
        })
      })
    })
  })
})
