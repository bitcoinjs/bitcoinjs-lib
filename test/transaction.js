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
    })

    it('works', function() {
      var actual = Transaction.deserialize(serializedTx).serialize()
      var expected = convert.hexToBytes(serializedTx)
      assert.deepEqual(actual, expected)
    })
  })

})
