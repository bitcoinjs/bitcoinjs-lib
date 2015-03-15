/* global describe, it, before, after */

var assert = require('assert')
var networks = require('../src/networks')
var sinon = require('sinon')

var HDNode = require('../src/hdnode')
var Transaction = require('../src/transaction')

var fixtures = require('./fixtures/network')

describe('networks', function () {
  var txByteLength
  before(function () {
    txByteLength = sinon.stub(Transaction.prototype, 'byteLength')
  })

  after(function () {
    Transaction.prototype.byteLength.restore()
  })

  describe('constants', function () {
    fixtures.valid.constants.forEach(function (f) {
      var network = networks[f.network]

      Object.keys(f.bip32).forEach(function (name) {
        var extb58 = f.bip32[name]

        it('resolves ' + extb58 + ' to ' + f.network, function () {
          assert.equal(HDNode.fromBase58(extb58).network, network)
        })
      })
    })
  })

  describe('estimateFee', function () {
    fixtures.valid.estimateFee.forEach(function (f) {
      describe('(' + f.network + ')', function () {
        var network = networks[f.network]

        it('calculates the fee correctly for ' + f.description, function () {
          txByteLength.returns(f.txSize)

          var estimateFee = network.estimateFee
          var tx = new Transaction()
          tx.outs = f.outputs || []

          assert.equal(estimateFee(tx), f.fee)
        })
      })
    })
  })
})
