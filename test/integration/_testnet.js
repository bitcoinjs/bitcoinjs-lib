var async = require('async')
var bitcoin = require('../../')
var Blockchain = require('cb-http-client')
var coinSelect = require('coinselect')
var dhttp = require('dhttp/200')
var typeforce = require('typeforce')
var types = require('../../src/types')

var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'
var blockchain = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/tBTC', { api_key: BLOCKTRAIL_API_KEY })
var kpNetwork = bitcoin.networks.testnet
var keyPair = bitcoin.ECPair.fromWIF('cQqjeq2rxqwnqwMewJhkNtJDixtX8ctA4bYoWHdxY4xRPVvAEjmk', kpNetwork)
var kpAddress = keyPair.getAddress()
var conflicts = {}

function fundAddress (unspents, outputs, callback) {
  // avoid too-long-mempool-chain
  unspents = unspents.filter(function (x) {
    return x.confirmations > 0 && !conflicts[x.txId + x.vout]
  })

  var result = coinSelect(unspents, outputs, 10)
  if (!result.inputs) return callback(new Error('Faucet empty'))

  var txb = new bitcoin.TransactionBuilder(kpNetwork)
  result.inputs.forEach(function (x) {
    conflicts[x.txId + x.vout] = true
    txb.addInput(x.txId, x.vout)
  })

  result.outputs.forEach(function (x) {
    if (x.address) console.warn('funding ' + x.address + ' w/ ' + x.value)
    txb.addOutput(x.address || kpAddress, x.value)
  })

  result.inputs.forEach(function (_, i) {
    txb.sign(i, keyPair)
  })

  var tx = txb.build()

  blockchain.transactions.propagate(tx.toHex(), function (err) {
    if (err) return callback(err)

    var txId = tx.getId()
    callback(null, outputs.map(function (x, i) {
      return { txId: txId, vout: i, value: x.value }
    }))
  })
}

blockchain.faucetMany = function faucetMany (outputs, callback) {
  blockchain.addresses.unspents(kpAddress, function (err, unspents) {
    if (err) return callback(err)

    typeforce([{
      txId: types.Hex,
      vout: types.UInt32,
      value: types.Satoshi
    }], unspents)

    fundAddress(unspents, outputs, callback)
  })
}

blockchain.faucet = function faucet (address, value, callback) {
  blockchain.faucetMany([{ address: address, value: value }], function (err, unspents) {
    callback(err, unspents && unspents[0])
  })
}

// verify TX was accepted
blockchain.verify = function verify (address, txId, value, done) {
  async.retry(5, function (callback) {
    setTimeout(function () {
      // check that the above transaction included the intended address
      dhttp({
        method: 'POST',
        url: 'https://api.ei8ht.com.au:9443/3/txs',
        body: [txId]
      }, function (err, result) {
        if (err) return callback(err)
        if (!result[txId]) return callback(new Error('Could not find ' + txId))
        callback()
      })
    }, 400)
  }, done)
}

blockchain.transactions.propagate = function broadcast (txHex, callback) {
  dhttp({
    method: 'POST',
    url: 'https://api.ei8ht.com.au:9443/3/pushtx',
    body: txHex
  }, callback)
}

blockchain.RETURN_ADDRESS = kpAddress
module.exports = blockchain
