var https = require('https')

function faucetWithdraw (address, amount, done) {
  var url = 'https://coconut-macaroon.herokuapp.com/withdrawal?address=' + address + '&amount=' + amount
  https.get(url, function (res) {
    res.statusCode === 200 ? done(null) : done(new Error('non-200 status: ' + res.statusCode))
  }).on('error', done)
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
