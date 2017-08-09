var async = require('async')
var bitcoin = require('../../')
var Blockchain = require('cb-http-client')
var coinSelect = require('coinselect')
var typeforce = require('typeforce')
var types = require('../../src/types')

var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'
var blockchain = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/tBTC', { api_key: BLOCKTRAIL_API_KEY })
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

  blockchain.transactions.propagate(tx.toHex(), function (err) {
    if (err) return callback(err)

    // FIXME: @blocktrail can be very slow, give it time
    setTimeout(function () {
      callback(null, outputs.map(function (_, i) {
        return { txId: txId, vout: i }
      }))
    }, 3000)
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
blockchain.verify = function (address, txId, value, done) {
  async.retry(5, function (callback) {
    setTimeout(function () {
      // check that the above transaction included the intended address
      blockchain.addresses.unspents(blockchain.RETURN_ADDRESS, function (err, unspents) {
        if (err) return callback(err)
        if (!unspents.some(function (x) {
          return x.txId === txId && x.value === value
        })) return callback(new Error('Could not find unspent'))

        callback()
      })
    }, 600)
  }, done)
}

blockchain.RETURN_ADDRESS = kpAddress
module.exports = blockchain
