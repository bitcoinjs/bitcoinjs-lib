var assert = require('assert')
var networks = require('../src/networks')
var Transaction = require('../src/transaction')

var fixtureTxes = require('./fixtures/mainnet_tx')
var fixtureTx1Hex = fixtureTxes.prevTx
var fixtureTxBigHex = fixtureTxes.bigTx

describe('bitcoin', function() {
  describe('estimateFee', function() {
    var estimateFee = networks.bitcoin.estimateFee

    it('works for fixture tx 1', function() {
      var tx = Transaction.fromHex(fixtureTx1Hex)
      assert.equal(estimateFee(tx.toBuffer().length), 10000)
    })

    it('works for fixture big tx', function() {
      var tx = Transaction.fromHex(fixtureTxBigHex)
      assert.equal(estimateFee(tx.toBuffer().length), 30000)
    })
  })
})
