var assert = require('assert')
var base58 = require('../').base58

describe('base58', function() {
  var evec, dvec

  beforeEach(function() {
    // base58 encoded strings
    evec = [
      '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAbuatmU', // 0x00 WIF
      '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAnchuDf', // 0x01 WIF
      '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreQyNNN1W', // 0x7f WIF
      '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm', // uncompressed 0x01 address
      '1FB8cZijTpRQp3HX8AEkNuQJBqApqfTcX7' // uncompressed 0x7f address
    ]

    // decoded equivalent of above
    dvec = [
      '8000000000000000000000000000000000000000000000000000000000000000000565fba7',
      '800000000000000000000000000000000000000000000000000000000000000001a85aa87e',
      '80000000000000000000000000000000000000000000000000000000000000007f64046be9',
      '0091b24bf9f5288532960ac687abb035127b1d28a50074ffe0',
      '009b7c46977b68474e12066a370b169ec6b9b026444d210d6e'
    ].map(function(h) {
      return new Buffer(h, 'hex')
    })
  })

  describe('decode', function() {
    it('decodes the test vectors', function() {
      evec.forEach(function(x, i) {
        var actual = base58.decode(x)
        var expected = dvec[i]

        assert.deepEqual(expected, actual)
      })
    })
  })

  describe('encode', function() {
    it('encodes the test vectors', function() {
      dvec.forEach(function(x, i) {
        var actual = base58.encode(x)
        var expected = evec[i]

        assert.deepEqual(expected, actual)
      })
    })
  })
})
