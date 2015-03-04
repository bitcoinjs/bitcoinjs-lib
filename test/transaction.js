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
        script = new Script(new Buffer(txIn.data, 'hex'), [])
      } else if (txIn.script) {
        script = Script.fromASM(txIn.script)
      }

      tx.addInput(txHash, txIn.index, txIn.sequence, script)
    })

    raw.outs.forEach(function (txOut) {
      tx.addOutput(Script.fromASM(txOut.script), txOut.value)
    })

    return tx
  }

  describe('fromBuffer/fromHex', function () {
    fixtures.valid.forEach(function (f) {
      it('imports ' + f.id + ' correctly', function () {
        var actual = Transaction.fromHex(f.hex)

        assert.deepEqual(actual.toHex(), f.hex)
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
      it('exports ' + f.id + ' correctly', function () {
        var actual = fromRaw(f.raw)

        assert.deepEqual(actual.toHex(), f.hex)
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
      assert.equal(tx.addInput(prevTxHash, 0), 0)
      assert.equal(tx.addInput(prevTxHash, 0), 1)
    })

    it('defaults to DEFAULT_SEQUENCE', function () {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.equal(tx.ins[0].sequence, Transaction.DEFAULT_SEQUENCE)
    })

    it('defaults to empty script', function () {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.equal(tx.ins[0].script, Script.EMPTY)
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
    fixtures.valid.forEach(function (f) {
      it('should add the outputs for ' + f.id + ' correctly', function () {
        var tx = new Transaction()

        f.raw.outs.forEach(function (txOut, i) {
          var scriptPubKey = Script.fromASM(txOut.script)
          var j = tx.addOutput(scriptPubKey, txOut.value)

          assert.equal(i, j)
          assert.equal(tx.outs[i].script, scriptPubKey)
          assert.equal(tx.outs[i].value, txOut.value)
        })
      })
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

        assert.equal(tx.getId(), f.id)
      })
    })
  })

  describe('getHash', function () {
    fixtures.valid.forEach(function (f) {
      it('should return the hash for ' + f.id, function () {
        var tx = Transaction.fromHex(f.hex)

        assert.deepEqual(tx.getHash().toString('hex'), f.hash)
      })
    })
  })

  // TODO:
  //  hashForSignature: [Function],
})
