var Blockchain = require('cb-http-client')
var httpify = require('httpify')

var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'

var mainnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/BTC', { api_key: BLOCKTRAIL_API_KEY })
var testnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/tBTC', { api_key: BLOCKTRAIL_API_KEY })
testnet.faucet = function faucet (address, amount, callback) {
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

module.exports = {
  m: mainnet,
  t: testnet
}
