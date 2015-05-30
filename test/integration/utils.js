var https = require('https')

function faucetWithdraw(address, amount, done) {
  var url = "https://coconut-macaroon.herokuapp.com/bitcoin/testnet/withdrawal?address=" + address + "&amount=" + amount
  https.get(url, function(res) {
    res.statusCode == 200 ? done(null) : done(new Error("non-200 status: " + res.statusCode))
  }).on('error', done)
}

module.exports = {
  faucetWithdraw: faucetWithdraw
}
