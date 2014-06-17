var assert = require('assert')
var networks = require('../src/networks')
var sinon = require('sinon')
var Transaction = require('../src/transaction')

describe('networks', function() {
  var txToBuffer
  before(function(){
    txToBuffer = sinon.stub(Transaction.prototype, "toBuffer")
  })

  after(function(){
    Transaction.prototype.toBuffer.restore()
  })

  describe('bitcoin', function() {
    describe('estimateFee', function() {
      var estimateFee = networks.bitcoin.estimateFee

      it('works at boundry', function() {
        txToBuffer.returns(new Buffer(1000))
        var tx = new Transaction()
        assert.equal(estimateFee(tx), 10000)
      })

      it('rounds up to the closest kb for estimation', function() {
        txToBuffer.returns(new Buffer(2800))
        var tx = new Transaction()
        assert.equal(estimateFee(tx), 30000)
      })
    })
  })

  describe('dogecoin', function() {
    describe('estimateFee', function() {
      var estimateFee = networks.dogecoin.estimateFee

      it('regular fee per kb applies when every output has value no less than DUST_SOFT_LIMIT', function() {
        txToBuffer.returns(new Buffer(1000))
        var tx = new Transaction()
        tx.outs[0] = { value: 100000000 }

        assert.equal(estimateFee(tx), 100000000)
      })

      it('applies additional fee on every output with value below DUST_SOFT_LIMIT', function() {
        txToBuffer.returns(new Buffer(1000))
        var tx = new Transaction()
        tx.outs[0] = { value: 99999999 }
        tx.outs[1] = { value: 99999999 }

        assert.equal(estimateFee(tx), 3 * 100000000)
      })

      it('rounds up to the closest kb for estimation', function() {
        txToBuffer.returns(new Buffer(2800))
        var tx = new Transaction()

        assert.equal(estimateFee(tx), 300000000)
      })
    })
  })

  describe('litecoin', function() {
    describe('estimateFee', function() {
      var estimateFee = networks.litecoin.estimateFee

      it('regular fee per kb applies when every output has value no less than DUST_SOFT_LIMIT', function() {
        txToBuffer.returns(new Buffer(1000))
        var tx = new Transaction()
        tx.outs[0] = { value: 100000 }

        assert.equal(estimateFee(tx), 100000)
      })

      it('applies additional fee on every output with value below DUST_SOFT_LIMIT', function() {
        txToBuffer.returns(new Buffer(1000))
        var tx = new Transaction()
        tx.outs[0] = { value: 99999 }
        tx.outs[1] = { value: 99999 }

        assert.equal(estimateFee(tx), 3 * 100000)
      })

      it('rounds up to the closest kb for estimation', function() {
        txToBuffer.returns(new Buffer(2800))
        var tx = new Transaction()

        assert.equal(estimateFee(tx), 300000)
      })
    })
  })
})
