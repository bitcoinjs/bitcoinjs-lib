var assert = require('assert')
var networks = require('../src/networks')
var sinon = require('sinon')
var Transaction = require('../src/transaction')

var fixtures = require('./fixtures/network')

describe('networks', function() {
  var txToBuffer
  before(function(){
    txToBuffer = sinon.stub(Transaction.prototype, "toBuffer")
  })

  after(function(){
    Transaction.prototype.toBuffer.restore()
  })

  fixtures.valid.forEach(function(f) {
    describe(f.network + ' estimateFee', function() {
      var network = networks[f.network]

      it('calculates the fee correctly for ' + f.description, function() {
        var buffer = new Buffer(f.txSize)
        txToBuffer.returns(buffer)

        var estimateFee = network.estimateFee
        var tx = new Transaction()
        tx.outs = f.outputs || []

        assert.equal(estimateFee(tx), f.fee)
      })
    })
  })
})
