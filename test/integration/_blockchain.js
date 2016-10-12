var bitcoin = require('../../')
var Blockchain = require('cb-http-client')
var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'
var coinSelect = require('coinselect')
var typeforce = require('typeforce')
var types = require('../../src/types')

var mainnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/BTC', { api_key: BLOCKTRAIL_API_KEY })
var testnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/tBTC', { api_key: BLOCKTRAIL_API_KEY })

var kpNetwork = bitcoin.networks.testnet
var keyPair = bitcoin.ECPair.fromWIF(process.env.BITCOINJS_TESTNET_WIF, kpNetwork)
var kpAddress = keyPair.getAddress()

function fundAddress (unspents, address, amount, callback) {
  var result = coinSelect(unspents, [{
    address: address,
    value: amount
  }], 10)

  if (!result.inputs) return callback(new Error('Faucet empty'))

  var txb = new bitcoin.TransactionBuilder(kpNetwork)
  result.inputs.forEach(function (x) {
    txb.addInput(x.txId, x.vout)
  })

  result.outputs.forEach(function (x) {
    txb.addOutput(x.address || kpAddress, x.value)
  })

  result.inputs.forEach(function (x, i) {
    txb.sign(i, keyPair)
  })

  var tx = txb.build()
  testnet.transactions.propagate(tx.toHex(), function (err) {
    callback(err, {
      txId: tx.getId(),
      vout: 0
    }, 0)
  })
}

testnet.faucet = function faucet (address, amount, done) {
  testnet.addresses.unspents(kpAddress, function (err, unspents) {
    if (err) return done(err)
    typeforce([{
      txId: types.Hex,
      vout: types.UInt32,
      value: types.Satoshi
    }], unspents)

    fundAddress(unspents, address, amount, done)
  })
}

module.exports = {
  m: mainnet,
  t: testnet
}
