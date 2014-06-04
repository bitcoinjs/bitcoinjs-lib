var assert = require('assert')
var convert = require('../src/convert')

var fixtures = require('./fixtures/convert')

describe('convert', function() {
  describe('bufferToWordArray', function() {
    fixtures.valid.forEach(function(f) {
      it('converts ' + f.hex + ' correctly', function() {
        var buffer = new Buffer(f.hex, 'hex')
        var result = convert.bufferToWordArray(buffer)

        assert.deepEqual(result, f.wordArray)
      })
    })
  })

  describe('wordArrayToBuffer', function() {
    fixtures.valid.forEach(function(f) {
      it('converts to ' + f.hex + ' correctly', function() {
        var resultHex = convert.wordArrayToBuffer(f.wordArray).toString('hex')

        assert.deepEqual(resultHex, f.hex)
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
