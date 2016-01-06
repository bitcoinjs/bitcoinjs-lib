var async = require('async')
var Blockchain = require('cb-http-client')
var httpify = require('httpify')

var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'

var mainnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/BTC', { api_key: BLOCKTRAIL_API_KEY })
var testnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/tBTC', { api_key: BLOCKTRAIL_API_KEY })

testnet.faucet = function faucet (address, amount, done) {
  async.retry(5, function (callback) {
    httpify({
      method: 'POST',
      url: 'https://api.blocktrail.com/v1/tBTC/faucet/withdrawl?api_key=' + BLOCKTRAIL_API_KEY,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address,
        amount: amount
      })
    }, function (err) {
      if (err) return callback(err)

      testnet.addresses.unspents(address, function (err, result) {
        if (err) return callback(err)

        var unspent = result.filter(function (unspent) {
          return unspent.value > 1e3
        }).pop()

        if (!unspent) return callback(new Error('No unspent given'))

        testnet.transactions.get(unspent.txId, function (err, tx) {
          if (err) return callback(err)

          testnet.transactions.propagate(tx.txHex, function (err) {
            if (err) return callback(err)

            callback(null, unspent)
          })
        })
      })
    })
  }, done)
}

module.exports = {
  m: mainnet,
  t: testnet
}
