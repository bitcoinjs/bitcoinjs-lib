/* global describe, it, beforeEach */

var assert = require('assert')
var bscript = require('../src/script')

var Transaction = require('../src/transaction')

var fixtures = require('./fixtures/transaction')

describe('Transaction', function () {
  function fromRaw (raw) {
    var tx = new Transaction()
    tx.version = raw.version
    tx.locktime = raw.locktime

    raw.ins.forEach(function (txIn) {
      var txHash
      if (txIn.txId) {
        txHash = [].reverse.call(new Buffer(txIn.txId, 'hex'))
      } else {
        txHash = new Buffer(txIn.hash, 'hex')
      }
      var scriptSig
      var witness

      if (txIn.data) {
        scriptSig = new Buffer(txIn.data, 'hex')
      } else if (txIn.script) {
        scriptSig = bscript.fromASM(txIn.script)
      }

      if (txIn.witness) {
        witness = txIn.witness.map(function (witnessChunkHex) { return new Buffer(witnessChunkHex, 'hex') })
      }

      tx.addInput(txHash, txIn.index, txIn.sequence, scriptSig, witness)
    })

    raw.outs.forEach(function (txOut) {
      var script

      if (txOut.data) {
        script = new Buffer(txOut.data, 'hex')
      } else if (txOut.script) {
        script = bscript.fromASM(txOut.script)
      }

      tx.addOutput(script, txOut.value)
    })

    return tx
  }

  describe('fromBuffer/fromHex', function () {
    fixtures.valid.forEach(function (f) {
      it('imports ' + f.description + ' (' + f.id + ')', function () {
        var actual = Transaction.fromHex(f.hex)

        assert.strictEqual(actual.toHex(), f.hex, 'actual.toHex() === hex')

        if (typeof f.hexWithWitness !== 'undefined') {
          var actualWithWitness = Transaction.fromHex(f.hexWithWitness)

          assert.strictEqual(actualWithWitness.toHex(), f.hex, 'actualWithWitness.toHex() === hex')
          assert.strictEqual(actualWithWitness.toHex(true), f.hexWithWitness, 'actualWithWitness.toHex(true) === hexWithWitness')
        }
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

        assert.strictEqual(actual.toHex(), f.hex, 'actual.toHex() === hex')
        if (typeof f.hexWithWitness !== 'undefined') {
          assert.strictEqual(actual.toHex(true), f.hexWithWitness, 'actual.toHex(true) === hexWithWitness')
        }
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

      assert.strictEqual(tx.ins[0].script.length, 0)
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
      assert.strictEqual(tx.addOutput(new Buffer(0), 0), 0)
      assert.strictEqual(tx.addOutput(new Buffer(0), 0), 1)
    })
  })

  describe('clone', function () {
    fixtures.valid.forEach(function (f) {
      var actual, expected

      beforeEach(function () {
        expected = Transaction.fromHex(f.hex)
        actual = expected.clone()
      })

      it('should have value equality (' + f.id + ')', function () {
        assert.deepEqual(actual, expected)
      })

      it('should not have reference equality (' + f.id + ')', function () {
        assert.notEqual(actual, expected)
      })
    })
  })

  describe('clone from hexWithWitness', function () {
    fixtures.valid.forEach(function (f) {
      var actual, expected

      if (typeof f.hexWithWitness === 'undefined') {
        return
      }

      beforeEach(function () {
        expected = Transaction.fromHex(f.hexWithWitness)
        actual = expected.clone()
      })

      it('should have value equality (' + f.id + ')', function () {
        assert.deepEqual(actual, expected)
      })

      it('should not have reference equality (' + f.id + ')', function () {
        assert.notEqual(actual, expected)
      })
    })
  })

  describe('getId', function () {
    fixtures.valid.forEach(function (f) {
      it('should return the id for ' + f.id, function () {
        var tx = Transaction.fromHex(f.hex)

        assert.strictEqual(tx.getId(), f.id, 'getId() === id')

        if (typeof f.hexWithWitness !== 'undefined') {
          var txWithWitness = Transaction.fromHex(f.hexWithWitness)

          assert.strictEqual(txWithWitness.getId(), f.id, 'txWithWitness.getId() === id')
        }
      })
    })
  })

  describe('getHash', function () {
    fixtures.valid.forEach(function (f) {
      it('should return the hash for ' + f.id, function () {
        var tx = Transaction.fromHex(f.hex)

        assert.strictEqual(tx.getHash().toString('hex'), f.hash, 'getHash() === hash')

        if (typeof f.hexWithWitness !== 'undefined') {
          var txWithWitness = Transaction.fromHex(f.hexWithWitness)

          assert.strictEqual(txWithWitness.getHash().toString('hex'), f.hash, 'txWithWitness.getHash() === hash')
        }
      })
    })
  })

  // TODO:
  //  hashForSignature: [Function],
})
