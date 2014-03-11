var util = require('../src/util.js')
var assert = require('assert')

describe('util', function() {

  describe('byte array and word array conversions', function(){
    var bytes, wordArray;

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
        assert.deepEqual(util.bytesToWordArray(bytes), wordArray)
      })
    })

    describe('bytesToWords', function() {
      it('works', function() {
        assert.deepEqual(util.wordArrayToBytes(wordArray), bytes)
      })
    })
  })

})
