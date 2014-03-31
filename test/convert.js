var assert = require('assert')
var convert = require('../src/convert.js')

describe('convert', function() {
  describe('bytesToHex', function() {
    it('handles example 1', function() {
      assert.equal(convert.bytesToHex([0, 1, 2, 255]), '000102ff')
    })
  })

  describe('hexToBytes', function() {
    it('handles example 1', function() {
      assert.deepEqual(convert.hexToBytes('000102ff'), [0, 1, 2, 255])
    })
  })

  it('converts from bytes to hex and back', function() {
    var bytes = []
    for (var i=0 ; i<256 ; ++i) {
      bytes.push(i)
    }

    var hex = convert.bytesToHex(bytes)
    assert.equal(hex.length, 512)
    assert.deepEqual(convert.hexToBytes(hex), bytes)
  })

  describe('bytesToBase64', function() {
    it('passes RFC4648 test vectors', function() {
      // Test vectors from:
      // http://tools.ietf.org/html/rfc4648#page-12

      var b64 = function(s) {
        return convert.bytesToBase64(convert.stringToBytes(s))
      }

      assert.equal(b64(''), '')
      assert.equal(b64('f'), 'Zg==')
      assert.equal(b64('fo'), 'Zm8=')
      assert.equal(b64('foo'), 'Zm9v')
      assert.equal(b64('foob'), 'Zm9vYg==')
      assert.equal(b64('fooba'), 'Zm9vYmE=')
      assert.equal(b64('foobar'), 'Zm9vYmFy')
    })
  })

  describe('byte array and word array conversions', function(){
    var bytes, wordArray

    beforeEach(function(){
      bytes = [
        98, 233, 7, 177, 92, 191, 39, 213, 66, 83,
        153, 235, 246, 240, 251, 80, 235, 184, 143, 24
      ]
      wordArray = {
        words: [1659439025, 1556031445, 1112775147, -151979184, -340226280],
        sigBytes: 20
      }
    })

    describe('bytesToWords', function() {
      it('works', function() {
        assert.deepEqual(convert.bytesToWordArray(bytes), wordArray)
      })
    })

    describe('bytesToWords', function() {
      it('works', function() {
        assert.deepEqual(convert.wordArrayToBytes(wordArray), bytes)
      })
    })
  })

  describe('numToVarInt', function() {
    describe('works', function() {
      var data = [
        0, 128, 252, // 8-bit
        256, 512, 1024, // 16-bit
        65541, // 32-bit
        4294967299, // 64-bit
      ]
      var expected = [
        [0], [128], [252], // 8-bit
        [253, 0, 1], [253, 0, 2], [253, 0, 4], // 16-bit
        [254, 5, 0, 1, 0], // 32-bit
        [255, 3, 0, 0, 0, 1, 0, 0, 0] // 64-bit
      ]

      for (var i = 0; i < data.length; ++i) {
        var actual = convert.numToVarInt(data[i])
        assert.deepEqual(actual, expected[i])
      }
    })
  })

  describe('varIntToNum', function() {
    it('works on valid input', function() {
      var data = [
        [0], [128], [252], // 8-bit
        [253, 0, 1], [253, 0, 2], [253, 0, 4], // 16-bit
        [254, 5, 0, 1, 0], // 32-bit
        [255, 3, 0, 0, 0, 1, 0, 0, 0] // 64-bit
      ]
      var expected = [
        0, 128, 252, // 8-bit
        256, 512, 1024, // 16-bit
        65541, // 32-bit
        4294967299, // 64-bit
      ]

      for (var i = 0; i < data.length; ++i) {
        var actual = convert.varIntToNum(data[i])
        assert.equal(actual.number, expected[i])
        assert.deepEqual(actual.bytes, data[i])
      }
    })

    it('uses only what is necessary', function() {
      var data = [
        [0, 99],
        [253, 0, 1, 99],
        [254, 5, 0, 1, 0, 99],
        [255, 3, 0, 0, 0, 1, 0, 0, 0, 99]
      ]
      var expected = [0, 256, 65541, 4294967299]

      for (var i = 0; i < data.length; ++i) {
        var actual = convert.varIntToNum(data[i])
        assert.equal(actual.number, expected[i])
        assert.deepEqual(actual.bytes, data[i].slice(0, -1))
      }
    })
  })

  describe('reverseEndian', function() {
    it('works', function() {
      var bigEndian = "6a4062273ac4f9ea4ffca52d9fd102b08f6c32faa0a4d1318e3a7b2e437bb9c7"
      var littleEdian = "c7b97b432e7b3a8e31d1a4a0fa326c8fb002d19f2da5fc4feaf9c43a2762406a"
      assert.deepEqual(convert.reverseEndian(bigEndian), littleEdian)
      assert.deepEqual(convert.reverseEndian(littleEdian), bigEndian)
    })
  })
})
