var httpify = require('httpify')

var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'

function faucetWithdraw (address, amount, callback) {
  httpify({
    method: 'POST',
    url: 'https://api.blocktrail.com/v1/tBTC/faucet/withdrawl?api_key=' + BLOCKTRAIL_API_KEY,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: address,
      amount: amount
    })
  }, callback)
}

function pollUnspent (blockchain, address, done) {
  blockchain.addresses.unspents(address, function (err, unspents) {
    if (err) return done(err)

    if (!unspents || unspents.length === 0) {
      return setTimeout(function () {
        pollUnspent(blockchain, address, done)
      }, 200)
    }

    done(null, unspents)
  })
}

function pollSummary (blockchain, address, done) {
  blockchain.addresses.summary(address, function (err, result) {
    if (err) return done(err)

    if (result.balance === 0) {
      return setTimeout(function () {
        pollSummary(blockchain, address, done)
      }, 200)
    }

    done(null, result)
  })
}

module.exports = {
  faucetWithdraw: faucetWithdraw,
  pollUnspent: pollUnspent,
  pollSummary: pollSummary
}
