/* global describe, it, beforeEach */

var assert = require('assert')
var Block = require('../src/block')

var fixtures = require('./fixtures/block')

describe('Block', function () {
  describe('calculateTarget', function () {
    fixtures.targets.forEach(function (f) {
      it('returns ' + f.expected + ' for 0x' + f.bits, function () {
        var bits = parseInt(f.bits, 16)

        assert.equal(Block.calculateTarget(bits).toString('hex'), f.expected)
      })
    })
  })

  describe('fromBuffer/fromHex', function () {
    fixtures.valid.forEach(function (f) {
      it('imports the block: ' + f.description + ' correctly', function () {
        var block = Block.fromHex(f.hex)

        assert.strictEqual(block.version, f.version)
        assert.strictEqual(block.prevHash.toString('hex'), f.prevHash)
        assert.strictEqual(block.merkleRoot.toString('hex'), f.merkleRoot)
        assert.strictEqual(block.timestamp, f.timestamp)
        assert.strictEqual(block.bits, f.bits)
        assert.strictEqual(block.nonce, f.nonce)
      })
    })

    fixtures.invalid.forEach(function (f) {
      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          Block.fromHex(f.hex)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toBuffer/toHex', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('exports the block: ' + f.description + ' correctly', function () {
        assert.strictEqual(block.toHex(), f.hex)
      })
    })
  })

  describe('getHash', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns ' + f.hash + ' for the block: ' + f.description, function () {
        assert.strictEqual(block.getHash().toString('hex'), f.hash)
      })
    })
  })

  describe('getId', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns ' + f.id + ' for the block: ' + f.description, function () {
        assert.strictEqual(block.getId(), f.id)
      })
    })
  })

  describe('getUTCDate', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns UTC date of ' + f.id, function () {
        var utcDate = block.getUTCDate().getTime()

        assert.strictEqual(utcDate, f.timestamp * 1e3)
      })
    })
  })

  describe('calculateMerkleRoot', function () {
    it('should throw on zero-length transaction array', function () {
      assert.throws(function () {
        Block.calculateMerkleRoot([])
      }, /Cannot compute merkle root for zero transactions/)
    })

    fixtures.valid.forEach(function (f) {
      if (f.hex.length === 160) return

      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns ' + f.merkleRoot + ' for ' + f.id, function () {
        assert.strictEqual(Block.calculateMerkleRoot(block.transactions).toString('hex'), f.merkleRoot)
      })
    })
  })

  describe('checkMerkleRoot', function () {
    fixtures.valid.forEach(function (f) {
      if (f.hex.length === 160) return

      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns ' + f.valid + ' for ' + f.id, function () {
        assert.strictEqual(block.checkMerkleRoot(), true)
      })
    })
  })

  describe('checkProofOfWork', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns ' + f.valid + ' for ' + f.id, function () {
        assert.strictEqual(block.checkProofOfWork(), f.valid)
      })
    })
  })
})
