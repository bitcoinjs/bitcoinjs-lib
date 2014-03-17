var Transaction = require('../src/transaction.js').Transaction
var convert = require('../src/convert.js')
var assert = require('assert')

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
      assert.equal(input.sequence, 4294967295)

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
  })

})

