var assert = require('assert')
var convert = require('..').convert

describe('convert', function() {
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

  describe('reverseEndian', function() {
    it('works', function() {
      var bigEndian = "6a4062273ac4f9ea4ffca52d9fd102b08f6c32faa0a4d1318e3a7b2e437bb9c7"
      var littleEdian = "c7b97b432e7b3a8e31d1a4a0fa326c8fb002d19f2da5fc4feaf9c43a2762406a"
      assert.deepEqual(convert.reverseEndian(bigEndian), littleEdian)
      assert.deepEqual(convert.reverseEndian(littleEdian), bigEndian)
    })
  })
})
