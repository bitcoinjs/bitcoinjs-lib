/* global describe, it, beforeEach */

var assert = require('assert')

var networks = require('../src/networks')
var Block = require('../src/block')

var fixtures = require('./fixtures/block')

describe('Block', function () {
  describe('fromBuffer/fromHex', function () {
    fixtures.valid.forEach(function (f) {
      it('imports the block: ' + f.description + ' correctly', function () {
        var block = Block.fromHex(f.hex, networks[f.network])

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
          Block.fromHex(f.hex, networks[f.network])
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toBuffer/toHex', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex, networks[f.network])
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
        block = Block.fromHex(f.hex, networks[f.network])
      })

      it('calculates ' + f.hash + ' for the block: ' + f.description, function () {
        assert.strictEqual(block.getHash().toString('hex'), f.hash)
      })
    })
  })

  describe('getId', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex, networks[f.network])
      })

      it('calculates ' + f.id + ' for the block: ' + f.description, function () {
        assert.strictEqual(block.getId(), f.id)
      })
    })
  })

  describe('getUTCDate', function () {
    fixtures.valid.forEach(function (f) {
      var block

      beforeEach(function () {
        block = Block.fromHex(f.hex, networks[f.network])
      })

      it('returns UTC date of ' + f.id, function () {
        var utcDate = block.getUTCDate().getTime()

        assert.strictEqual(utcDate, f.timestamp * 1e3)
      })
    })
  })
})
