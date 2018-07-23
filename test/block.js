const { describe, it, beforeEach } = require('mocha')
const assert = require('assert')
const Block = require('../src/block')

const fixtures = require('./fixtures/block')

describe('Block', function () {
  describe('version', function () {
    it('should be interpreted as an int32le', function () {
      const blockHex = 'ffffffff0000000000000000000000000000000000000000000000000000000000000000414141414141414141414141414141414141414141414141414141414141414101000000020000000300000000'
      const block = Block.fromHex(blockHex)
      assert.equal(-1, block.version)
      assert.equal(1, block.timestamp)
    })
  })

  describe('calculateTarget', function () {
    fixtures.targets.forEach(function (f) {
      it('returns ' + f.expected + ' for 0x' + f.bits, function () {
        const bits = parseInt(f.bits, 16)

        assert.equal(Block.calculateTarget(bits).toString('hex'), f.expected)
      })
    })
  })

  describe('fromBuffer/fromHex', function () {
    fixtures.valid.forEach(function (f) {
      it('imports ' + f.description, function () {
        const block = Block.fromHex(f.hex)

        assert.strictEqual(block.version, f.version)
        assert.strictEqual(block.prevHash.toString('hex'), f.prevHash)
        assert.strictEqual(block.merkleRoot.toString('hex'), f.merkleRoot)
        assert.strictEqual(block.timestamp, f.timestamp)
        assert.strictEqual(block.bits, f.bits)
        assert.strictEqual(block.nonce, f.nonce)
        assert.strictEqual(!block.transactions, f.hex.length === 160)
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
      let block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('exports ' + f.description, function () {
        assert.strictEqual(block.toHex(true), f.hex.slice(0, 160))
        assert.strictEqual(block.toHex(), f.hex)
      })
    })
  })

  describe('getHash/getId', function () {
    fixtures.valid.forEach(function (f) {
      let block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns ' + f.id + ' for ' + f.description, function () {
        assert.strictEqual(block.getHash().toString('hex'), f.hash)
        assert.strictEqual(block.getId(), f.id)
      })
    })
  })

  describe('getUTCDate', function () {
    fixtures.valid.forEach(function (f) {
      let block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns UTC date of ' + f.id, function () {
        const utcDate = block.getUTCDate().getTime()

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

      let block

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

      let block

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
      let block

      beforeEach(function () {
        block = Block.fromHex(f.hex)
      })

      it('returns ' + f.valid + ' for ' + f.id, function () {
        assert.strictEqual(block.checkProofOfWork(), f.valid)
      })
    })
  })
})
