/* global describe, it, beforeEach */

var assert = require('assert')

var Transaction = require('../src/transaction')
var Script = require('../src/script')

var fixtures = require('./fixtures/transaction')

describe('Transaction', function () {
  function fromRaw (raw) {
    var tx = new Transaction()
    tx.version = raw.version
    tx.locktime = raw.locktime

    raw.ins.forEach(function (txIn) {
      var txHash = new Buffer(txIn.hash, 'hex')
      var script

      if (txIn.data) {
        var data = new Buffer(txIn.data, 'hex')
        script = new Script(data, [])
      } else if (txIn.script) {
        script = Script.fromASM(txIn.script)
      }

      tx.addInput(txHash, txIn.index, txIn.sequence, script)
    })

    raw.outs.forEach(function (txOut) {
      var script

      if (txOut.data) {
        var data = new Buffer(txOut.data, 'hex')
        script = new Script(data, [])
      } else if (txOut.script) {
        script = Script.fromASM(txOut.script)
      }

      tx.addOutput(script, txOut.value)
    })

    return tx
  }

  describe('fromBuffer/fromHex', function () {
    fixtures.valid.forEach(function (f) {
      it('imports ' + f.description + ' (' + f.id + ')', function () {
        var actual = Transaction.fromHex(f.hex)

        assert.strictEqual(actual.toHex(), f.hex, actual.toHex())
      })
    })

    fixtures.invalid.fromBuffer.forEach(function (f) {
      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          Transaction.fromHex(f.hex)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toBuffer/toHex', function () {
    fixtures.valid.forEach(function (f) {
      it('exports ' + f.description + ' (' + f.id + ')', function () {
        var actual = fromRaw(f.raw)

        assert.strictEqual(actual.toHex(), f.hex, actual.toHex())
      })
    })
  })

  describe('addInput', function () {
    var prevTxHash
    beforeEach(function () {
      var f = fixtures.valid[0]
      prevTxHash = new Buffer(f.hash, 'hex')
    })

    it('accepts a transaction hash', function () {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.deepEqual(tx.ins[0].hash, prevTxHash)
    })

    it('returns an index', function () {
      var tx = new Transaction()
      assert.strictEqual(tx.addInput(prevTxHash, 0), 0)
      assert.strictEqual(tx.addInput(prevTxHash, 0), 1)
    })

    it('defaults to DEFAULT_SEQUENCE', function () {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.strictEqual(tx.ins[0].sequence, Transaction.DEFAULT_SEQUENCE)
    })

    it('defaults to empty script', function () {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.strictEqual(tx.ins[0].script, Script.EMPTY)
    })

    fixtures.invalid.addInput.forEach(function (f) {
      it('throws on ' + f.exception, function () {
        var tx = new Transaction()
        var hash = new Buffer(f.hash, 'hex')

        assert.throws(function () {
          tx.addInput(hash, f.index)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('addOutput', function () {
    it('returns an index', function () {
      var tx = new Transaction()
      assert.strictEqual(tx.addOutput(Script.EMPTY, 0), 0)
      assert.strictEqual(tx.addOutput(Script.EMPTY, 0), 1)
    })
  })

  describe('clone', function () {
    fixtures.valid.forEach(function (f) {
      var actual, expected

      beforeEach(function () {
        expected = Transaction.fromHex(f.hex)
        actual = expected.clone()
      })

      it('should have value equality', function () {
        assert.deepEqual(actual, expected)
      })

      it('should not have reference equality', function () {
        assert.notEqual(actual, expected)
      })
    })
  })

  describe('getId', function () {
    fixtures.valid.forEach(function (f) {
      it('should return the id for ' + f.id, function () {
        var tx = Transaction.fromHex(f.hex)

        assert.strictEqual(tx.getId(), f.id)
      })
    })
  })

  describe('getHash', function () {
    fixtures.valid.forEach(function (f) {
      it('should return the hash for ' + f.id, function () {
        var tx = Transaction.fromHex(f.hex)

        assert.strictEqual(tx.getHash().toString('hex'), f.hash)
      })
    })
  })

  // TODO:
  //  hashForSignature: [Function],
})
