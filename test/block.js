var assert = require('assert')

var Block = require('../src/block')

var fixtures = require('./fixtures/block')

describe('Block', function() {
  describe('fromBuffer/fromHex', function() {
    fixtures.valid.forEach(function(f) {
      it('imports the block: ' + f.description + ' correctly', function() {
        var block = Block.fromHex(f.hex)

        assert.equal(block.version, f.version)
        assert.equal(block.prevHash.toString('hex'), f.prevHash)
        assert.equal(block.merkleRoot.toString('hex'), f.merkleRoot)
        assert.equal(block.timestamp, f.timestamp)
        assert.equal(block.bits, f.bits)
        assert.equal(block.nonce, f.nonce)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        assert.throws(function() {
          Block.fromHex(f.hex)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toBuffer/toHex', function() {
    fixtures.valid.forEach(function(f) {
      var block

      beforeEach(function() {
        block = Block.fromHex(f.hex)
      })

      it('exports the block: ' + f.description + ' correctly', function() {
        assert.equal(block.toHex(), f.hex)
      })
    })
  })

  describe('getHash', function() {
    fixtures.valid.forEach(function(f) {
      var block

      beforeEach(function() {
        block = Block.fromHex(f.hex)
      })

      it('calculates ' + f.hash + ' for the block: ' + f.description, function() {
        assert.equal(block.getHash().toString('hex'), f.hash)
      })
    })
  })

  describe('getId', function() {
    fixtures.valid.forEach(function(f) {
      var block

      beforeEach(function() {
        block = Block.fromHex(f.hex)
      })

      it('calculates ' + f.id + ' for the block: ' + f.description, function() {
        assert.equal(block.getId(), f.id)
      })
    })
  })

  describe('getUTCDate', function() {
    fixtures.valid.forEach(function(f) {
      var block

      beforeEach(function() {
        block = Block.fromHex(f.hex)
      })

      it('returns UTC date of ' + f.id, function() {
        var utcDate = block.getUTCDate().getTime()

        assert.equal(utcDate, f.timestamp * 1e3)
      })
    })
  })
})
