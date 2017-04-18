var bitcoin = require('../../')
var Blockchain = require('cb-http-client')
var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'
var coinSelect = require('coinselect')
var typeforce = require('typeforce')
var types = require('../../src/types')

var mainnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/BTC', { api_key: BLOCKTRAIL_API_KEY })
var testnet = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/tBTC', { api_key: BLOCKTRAIL_API_KEY })

var kpNetwork = bitcoin.networks.testnet
var keyPair = bitcoin.ECPair.fromWIF('cQqjeq2rxqwnqwMewJhkNtJDixtX8ctA4bYoWHdxY4xRPVvAEjmk', kpNetwork)
var kpAddress = keyPair.getAddress()

function fundAddress (unspents, outputs, callback) {
  // avoid too-long-mempool-chain
  unspents = unspents.filter(function (x) {
    return x.confirmations > 0
  })

  var result = coinSelect(unspents, outputs, 10)
  if (!result.inputs) return callback(new Error('Faucet empty'))

  var txb = new bitcoin.TransactionBuilder(kpNetwork)
  result.inputs.forEach(function (x) {
    txb.addInput(x.txId, x.vout)
  })

  result.outputs.forEach(function (x) {
    txb.addOutput(x.address || kpAddress, x.value)
  })

  result.inputs.forEach(function (_, i) {
    txb.sign(i, keyPair)
  })

  var tx = txb.build()
  var txId = tx.getId()

  testnet.transactions.propagate(tx.toHex(), function (err) {
    if (err) return callback(err)

    // FIXME: @blocktrail can be very slow, give it time
    setTimeout(() => {
      callback(null, outputs.map(function (_, i) {
        return { txId: txId, vout: i }
      }))
    }, 3000)
  })
}

testnet.faucetMany = function faucetMany (outputs, callback) {
  testnet.addresses.unspents(kpAddress, function (err, unspents) {
    if (err) return callback(err)

    typeforce([{
      txId: types.Hex,
      vout: types.UInt32,
      value: types.Satoshi
    }], unspents)

    fundAddress(unspents, outputs, callback)
  })
}

testnet.faucet = function faucet (address, value, callback) {
  testnet.faucetMany([{ address: address, value: value }], function (err, unspents) {
    callback(err, unspents && unspents[0])
  })
}

testnet.RETURN = kpAddress

module.exports = {
  m: mainnet,
  t: testnet
}
