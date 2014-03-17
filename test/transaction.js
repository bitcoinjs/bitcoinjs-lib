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

  describe('creating a transaction', function() {
    var tx, inTx, expectedTx
    beforeEach(function() {
      inTx = Transaction.deserialize('0100000001e0214ebebb0fd3414d3fdc0dbf3b0f4b247a296cafc984558622c3041b0fcc9b010000008b48304502206becda98cecf7a545d1a640221438ff8912d9b505ede67e0138485111099f696022100ccd616072501310acba10feb97cecc918e21c8e92760cd35144efec7622938f30141040cd2d2ce17a1e9b2b3b2cb294d40eecf305a25b7e7bfdafae6bb2639f4ee399b3637706c3d377ec4ab781355add443ae864b134c5e523001c442186ea60f0eb8ffffffff03a0860100000000001976a91400ea3576c8fcb0bc8392f10e23a3425ae24efea888ac40420f00000000001976a91477890e8ec967c5fd4316c489d171fd80cf86997188acf07cd210000000001976a9146fb93c557ee62b109370fd9003e456917401cbfa88ac00000000')
      expectedTx = Transaction.deserialize('0100000001576bc3c3285dbdccd8c3cbd8c03e10d7f77a5c839c744f34c3eb00511059b80c000000006b483045022100a82a31607b837c1ae510ae3338d1d3c7cbd57c15e322ab6e5dc927d49bffa66302205f0db6c90f1fae3c8db4ebfa753d7da1b2343d653ce0331aa94ed375e6ba366c0121020497bfc87c3e97e801414fed6a0db4b8c2e01c46e2cf9dff59b406b52224a76bffffffff02409c0000000000001976a9143443bc45c560866cfeabf1d52f50a6ed358c69f288ac50c30000000000001976a91477890e8ec967c5fd4316c489d171fd80cf86997188ac00000000')
      tx = new Transaction()
    })

    describe('addInput', function(){
      it('allows a Transaction object to be passed in', function(){
        tx.addInput(inTx, 0)
        verifyTransactionIn()
      })

      it('allows a Transaction hash to be passed in', function(){
        tx.addInput("0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57", 0)
        verifyTransactionIn()
      })

      it('allows a TransactionIn object to be passed in', function(){
        var txCopy = tx.clone()
        txCopy.addInput(inTx, 0)
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
        assert.equal(input.sequence, 4294967295)

        assert.equal(input.outpoint.index, 0)
        assert.equal(input.outpoint.hash, "0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57")

        assert.deepEqual(input.script.buffer, [])
      }

    })
  })

})

