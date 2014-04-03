var assert = require('assert')
var base58check = require('../').base58check

describe('base58check', function() {
  var evec, dvec

  beforeEach(function() {
    function fromHex(h) { return new Buffer(h, 'hex') }

    // base58check encoded strings
    evec = [
      '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAbuatmU', // 0x00 WIF
      '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAnchuDf', // 0x01 WIF
      '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreQyNNN1W', // 0x7f WIF
      '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm', // uncompressed 0x01 address
      '1FB8cZijTpRQp3HX8AEkNuQJBqApqfTcX7' // uncompressed 0x7f address
    ]

    // decoded equivalent of above
    dvec = [
      {
        version: 0x80,
        payload: '0000000000000000000000000000000000000000000000000000000000000000',
        checksum: '0565fba7'
      },
      {
        version: 0x80,
        payload: '0000000000000000000000000000000000000000000000000000000000000001',
        checksum: 'a85aa87e',
      },
      {
        version: 0x80,
        payload: '000000000000000000000000000000000000000000000000000000000000007f',
        checksum: '64046be9',
      },
      {
        version: 0x00,
        payload: '91b24bf9f5288532960ac687abb035127b1d28a5',
        checksum: '0074ffe0',
      },
      {
        version: 0x00,
        payload: '9b7c46977b68474e12066a370b169ec6b9b02644',
        checksum: '4d210d6e'
      }
    ].map(function(x) {
      return {
        version: x.version,
        payload: fromHex(x.payload),
        checksum: fromHex(x.checksum)
      }
    })
  })

  describe('decode', function() {
    it('decodes the test vectors', function() {
      evec.forEach(function(x, i) {
        var actual = base58check.decode(x)
        var expected = dvec[i]

        assert.deepEqual(expected, actual)
      })
    })
  })

  describe('encode', function() {
    it('encodes the test vectors', function() {
      dvec.forEach(function(x, i) {
        var actual = base58check.encode(x.payload, x.version)
        var expected = evec[i]

        assert.deepEqual(expected, actual)
      })
    })
  })
})
