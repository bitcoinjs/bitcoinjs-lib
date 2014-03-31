var T = require('../src/transaction')
var Transaction = T.Transaction
var TransactionOut = T.TransactionOut
var convert = require('../src/convert')
var ECKey = require('../src/eckey').ECKey
var Script = require('../src/script')
var assert = require('assert')

var fixtureTxes = require('./fixtures/mainnet_tx')
var fixtureTx1Hex = fixtureTxes.prevTx
var fixtureTx2Hex = fixtureTxes.tx
var fixtureTxBigHex = fixtureTxes.bigTx

describe('Transaction', function() {
  describe('deserialize', function() {
    var tx, serializedTx
    beforeEach(function() {
      serializedTx = [
        '0100000001344630cbff61fbc362f7e1ff2f11a344c29326e4ee96e78',
        '7dc0d4e5cc02fd069000000004a493046022100ef89701f460e8660c8',
        '0808a162bbf2d676f40a331a243592c36d6bd1f81d6bdf022100d29c0',
        '72f1b18e59caba6e1f0b8cadeb373fd33a25feded746832ec179880c2',
        '3901ffffffff0100f2052a010000001976a914dd40dedd8f7e3746662',
        '4c4dacc6362d8e7be23dd88ac00000000'
      ].join('')
      tx = Transaction.deserialize(serializedTx)
    })

    it('returns the original after serialized again', function() {
      var actual = tx.serialize()
      var expected = convert.hexToBytes(serializedTx)
      assert.deepEqual(actual, expected)
    })

    it('decodes version correctly', function(){
      assert.equal(tx.version, 1)
    })

    it('decodes locktime correctly', function(){
      assert.equal(tx.locktime, 0)
    })

    it('decodes inputs correctly', function(){
      assert.equal(tx.ins.length, 1)

      var input = tx.ins[0]
      assert.deepEqual(input.sequence, [255, 255, 255, 255])

      assert.equal(input.outpoint.index, 0)
      assert.equal(input.outpoint.hash, "69d02fc05c4e0ddc87e796eee42693c244a3112fffe1f762c3fb61ffcb304634")

      assert.equal(convert.bytesToHex(input.script.buffer),
                   "493046022100ef89701f460e8660c80808a162bbf2d676f40a331a243592c36d6bd1f81d6bdf022100d29c072f1b18e59caba6e1f0b8cadeb373fd33a25feded746832ec179880c23901")
    })

    it('decodes outputs correctly', function(){
      assert.equal(tx.outs.length, 1)

      var output = tx.outs[0]

      assert.equal(output.value, 5000000000)
      assert.equal(convert.bytesToHex(output.script.toScriptHash()), "dd40dedd8f7e37466624c4dacc6362d8e7be23dd")
      // assert.equal(output.address.toString(), "n1gqLjZbRH1biT5o4qiVMiNig8wcCPQeB9")
      // TODO: address is wrong because it's a testnet transaction. Transaction needs to support testnet
    })

    it('assigns hash to deserialized object', function(){
      var hashHex = "a9d4599e15b53f3eb531608ddb31f48c695c3d0b3538a6bda871e8b34f2f430c"
      assert.deepEqual(tx.hash, convert.hexToBytes(hashHex))
    })

    it('decodes large inputs correctly', function() {
      // transaction has only 1 input
      var tx = new Transaction()
      tx.addInput("0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57", 0)
      tx.addOutput("15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3", 100)

      // but we're going to replace the tx.ins.length VarInt with a 32-bit equivalent
      // however the same resultant number of inputs (1)
      var bytes = tx.serialize()
      var mutated = bytes.slice(0, 4).concat([254, 1, 0, 0, 0], bytes.slice(5))

      // the deserialized-serialized transaction should return to its original state (== tx)
      var bytes2 = Transaction.deserialize(mutated).serialize()
      assert.deepEqual(bytes, bytes2)
    })
  })

  describe('creating a transaction', function() {
    var tx, prevTx
    beforeEach(function() {
      prevTx = Transaction.deserialize(fixtureTx1Hex)
      tx = new Transaction()
    })

    describe('addInput', function(){
      it('allows a Transaction object to be passed in', function(){
        tx.addInput(prevTx, 0)
        verifyTransactionIn()
      })

      it('allows a Transaction hash to be passed in', function(){
        tx.addInput("0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57", 0)
        verifyTransactionIn()
      })

      it('allows a TransactionIn object to be passed in', function(){
        var txCopy = tx.clone()
        txCopy.addInput(prevTx, 0)
        var transactionIn = txCopy.ins[0]

        tx.addInput(transactionIn)
        verifyTransactionIn()
      })

      it('allows a string in the form of txhash:index to be passed in', function(){
        tx.addInput("0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57:0")
        verifyTransactionIn()
      })

      function verifyTransactionIn(){
        assert.equal(tx.ins.length, 1)

        var input = tx.ins[0]
        assert.deepEqual(input.sequence, [255, 255, 255, 255])

        assert.equal(input.outpoint.index, 0)
        assert.equal(input.outpoint.hash, "0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57")

        assert.deepEqual(input.script.buffer, [])
      }
    })

    describe('addOutput', function(){
      it('allows an address and a value to be passed in', function(){
        tx.addOutput("15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3", 40000)
        verifyTransactionOut()
      })

      it('allows a string in the form of address:index to be passed in', function(){
        tx.addOutput("15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3:40000")
        verifyTransactionOut()
      })

      it('allows a TransactionOut object to be passed in', function(){
        var txCopy = tx.clone()
        txCopy.addOutput("15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3:40000")
        var transactionOut = txCopy.outs[0]

        tx.addOutput(transactionOut)
        verifyTransactionOut()
      })

      function verifyTransactionOut(){
        assert.equal(tx.outs.length, 1)

        var output = tx.outs[0]
        assert.equal(output.value, 40000)
        assert.deepEqual(convert.bytesToHex(output.script.buffer), "76a9143443bc45c560866cfeabf1d52f50a6ed358c69f288ac")
      }
    })

    describe('sign', function(){
      it('works', function(){
        tx.addInput("0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57:0")
        tx.addOutput("15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3:40000")
        tx.addOutput("1Bu3bhwRmevHLAy1JrRB6AfcxfgDG2vXRd:50000")

        var key = new ECKey('L44f7zxJ5Zw4EK9HZtyAnzCYz2vcZ5wiJf9AuwhJakiV4xVkxBeb')
        tx.sign(0, key)

        var pub = key.getPub().toBytes()
        var script = prevTx.outs[0].script.buffer
        var sig = tx.ins[0].script.chunks[0]

        assert.equal(tx.validateSig(0, script, sig, pub), true)
      })
    })

    describe('validateSig', function(){
      var validTx

      beforeEach(function() {
        validTx = Transaction.deserialize(fixtureTx2Hex)
      })

      it('returns true for valid signature', function(){
        var key = new ECKey('L44f7zxJ5Zw4EK9HZtyAnzCYz2vcZ5wiJf9AuwhJakiV4xVkxBeb')
        var pub = key.getPub().toBytes()
        var script = prevTx.outs[0].script.buffer
        var sig = validTx.ins[0].script.chunks[0]

        assert.equal(validTx.validateSig(0, script, sig, pub), true)
      })
    })

    describe('estimateFee', function(){
      it('works for fixture tx 1', function(){
        var tx = Transaction.deserialize(fixtureTx1Hex)
        assert.equal(tx.estimateFee(), 20000)
      })

      it('works for fixture big tx', function(){
        var tx = Transaction.deserialize(fixtureTxBigHex)
        assert.equal(tx.estimateFee(), 60000)
      })

      it('allow feePerKb to be passed in as an argument', function(){
        var tx = Transaction.deserialize(fixtureTx2Hex)
        assert.equal(tx.estimateFee(10000), 10000)
      })

      it('allow feePerKb to be set to 0', function(){
        var tx = Transaction.deserialize(fixtureTx2Hex)
        assert.equal(tx.estimateFee(0), 0)
      })
    })
  })

  describe('TransactionOut', function() {
    describe('scriptPubKey', function() {
      it('returns hex string', function() {
        var txOut = new TransactionOut({
          value: 50000,
          script: Script.createOutputScript("1AZpKpcfCzKDUeTFBQUL4MokQai3m3HMXv")
        })

        assert.equal(txOut.scriptPubKey(), "76a91468edf28474ee22f68dfe7e56e76c017c1701b84f88ac")
      })
    })
  })
})

