var assert = require('assert')
var networks = require('../src/networks')
var Transaction = require('../src/transaction')

var fixtureTxes = require('./fixtures/mainnet_tx')
var fixtureTx1Hex = fixtureTxes.prevTx
var fixtureTxBigHex = fixtureTxes.bigTx

describe('networks', function() {
  describe('bitcoin', function() {
    describe('estimateFee', function() {
      var estimateFee = networks.bitcoin.estimateFee

      it('works for fixture tx 1', function() {
        var tx = Transaction.fromHex(fixtureTx1Hex)
        assert.equal(estimateFee(tx), 10000)
      })

      it('works for fixture big tx', function() {
        var tx = Transaction.fromHex(fixtureTxBigHex)
        assert.equal(estimateFee(tx), 30000)
      })
    })
  })

  describe('dogecoin', function() {
    describe('estimateFee', function() {
      var estimateFee = networks.dogecoin.estimateFee

      it('regular fee per kb applies when every output has value no less than DUST_SOFT_LIMIT', function() {
        var tx = Transaction.fromHex(fixtureTx1Hex)
        tx.outs.forEach(function(e){
          e.value = 100000000
        })

        assert.equal(estimateFee(tx), 100000000)
      })

      it('applies additional fee on every output with value below DUST_SOFT_LIMIT', function() {
        var tx = Transaction.fromHex(fixtureTx1Hex)
        tx.outs.forEach(function(e){
          e.value = 99999999
        })

        assert.equal(estimateFee(tx), 4 * 100000000) // 3 outs in total
      })

      it('works for fixture big tx', function() {
        var tx = Transaction.fromHex(fixtureTxBigHex)
        tx.outs.forEach(function(e){
          e.value = 100000000
        })
        assert.equal(estimateFee(tx), 300000000)
      })
    })
  })

  describe('litecoin', function() {
    describe('estimateFee', function() {
      var estimateFee = networks.litecoin.estimateFee

      it('regular fee per kb applies when every output has value no less than DUST_SOFT_LIMIT', function() {
        var tx = Transaction.fromHex(fixtureTx1Hex)
        tx.outs.forEach(function(e){
          e.value = 100000
        })

        assert.equal(estimateFee(tx), 100000)
      })

      it('applies additional fee on every output with value below DUST_SOFT_LIMIT', function() {
        var tx = Transaction.fromHex(fixtureTx1Hex)
        tx.outs.forEach(function(e){
          e.value = 99999
        })

        assert.equal(estimateFee(tx), 4 * 100000) // 3 outs in total
      })

      it('works for fixture big tx', function() {
        var tx = Transaction.fromHex(fixtureTxBigHex)
        tx.outs.forEach(function(e){
          e.value = 100000
        })
        assert.equal(estimateFee(tx), 300000)
      })
    })
  })
})
