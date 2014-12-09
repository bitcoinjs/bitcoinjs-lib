var assert = require('assert')
var bitcoin = require('../../')
var blockchain = new (require('cb-helloblock'))('testnet')

describe('bitcoinjs-lib (advanced)', function() {
  it('can sign a Bitcoin message', function() {
    var key = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
    var message = 'This is an example of a signed message.'

    var signature = bitcoin.Message.sign(key, message)
    assert.equal(signature.toString('base64'), 'G9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=')
  })

  it('can verify a Bitcoin message', function() {
    var address = '1HZwkjkeaoZfTSaJxDw6aKkxp45agDiEzN'
    var signature = 'HJLQlDWLyb1Ef8bQKEISzFbDAKctIlaqOpGbrk3YVtRsjmC61lpE5ErkPRUFtDKtx98vHFGUWlFhsh3DiW6N0rE'
    var message = 'This is an example of a signed message.'

    assert(bitcoin.Message.verify(address, signature, message))
  })

  it('can create an OP_RETURN transaction', function(done) {
    this.timeout(20000)

    var key = bitcoin.ECKey.fromWIF("L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy")
    var address = key.pub.getAddress(bitcoin.networks.testnet).toString()

    blockchain.addresses.__faucetWithdraw(address, 2e4, function(err) {
      if (err) return done(err)

      blockchain.addresses.unspents(address, function(err, unspents) {
        if (err) return done(err)

        // filter small unspents
        unspents = unspents.filter(function(unspent) { return unspent.value > 1e4 })

        // use the oldest unspent
        var unspent = unspents.pop()

        var tx = new bitcoin.TransactionBuilder()

        var data = new Buffer('cafedeadbeef', 'hex')
        var dataScript = bitcoin.scripts.nullDataOutput(data)

        tx.addInput(unspent.txId, unspent.vout)
        tx.addOutput(dataScript, 1000)
        tx.sign(0, key)

        blockchain.transactions.propagate(tx.build().toHex(), function(err) {
          if (err) return done(err)

          // check that the message was propagated
          blockchain.addresses.transactions(address, function(err, transactions) {
            if (err) return done(err)

            var transaction = bitcoin.Transaction.fromHex(transactions[0].txHex)
            var dataScript2 = transaction.outs[0].script
            var data2 = dataScript2.chunks[1]

            assert.deepEqual(dataScript, dataScript2)
            assert.deepEqual(data, data2)

            done()
          })
        })
      })
    })
  })
})
