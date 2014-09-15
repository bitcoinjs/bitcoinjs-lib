var assert = require('assert')
var networks = require('../src/networks')
var sinon = require('sinon')
var RawTransaction = require('../src/raw_transaction')

var fixtures = require('./fixtures/network')

describe('networks', function() {
  var txToBuffer
  before(function(){
    txToBuffer = sinon.stub(RawTransaction.prototype, "toBuffer")
  })

  after(function(){
    RawTransaction.prototype.toBuffer.restore()
  })

  fixtures.valid.forEach(function(f) {
    describe(f.network + ' estimateFee', function() {
      var network = networks[f.network]

      it('calculates the fee correctly for ' + f.description, function() {
        var buffer = new Buffer(f.txSize)
        txToBuffer.returns(buffer)

        var estimateFee = network.estimateFee
        var tx = new RawTransaction()
        tx.outs = f.outputs || []

        assert.equal(estimateFee(tx), f.fee)
      })
    })
  })
})
