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
      var txHash = new Buffer(txIn.hash, 'hex')
      var scriptSig

      if (txIn.data) {
        scriptSig = new Buffer(txIn.data, 'hex')
      } else if (txIn.script) {
        scriptSig = bscript.fromASM(txIn.script)
      }

      tx.addInput(txHash, txIn.index, txIn.sequence, scriptSig)
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

  describe('fromBuffer/fromHex (segwit) ', function () {
    fixtures.witness.forEach(function (f) {
      it('imports ' + f.description + ' (' + f.id + ')', function () {
        var actual = Transaction.fromHex(f.hex)
        var serialized = actual.toBufferWithWitness()
        assert.strictEqual(serialized.toString('hex'), f.hex, serialized.toString('hex'))
      })
    })
  })

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

    it('accepts target Buffer and offset parameters', function () {
      var f = fixtures.valid[0]
      var actual = fromRaw(f.raw)
      var byteLength = actual.byteLength()

      var target = new Buffer(byteLength * 2)
      var a = actual.toBuffer(target, 0)
      var b = actual.toBuffer(target, byteLength)

      assert.strictEqual(a.length, byteLength)
      assert.strictEqual(b.length, byteLength)
      assert.strictEqual(a.toString('hex'), f.hex)
      assert.strictEqual(b.toString('hex'), f.hex)
      assert.deepEqual(a, b)
      assert.deepEqual(a, target.slice(0, byteLength))
      assert.deepEqual(b, target.slice(byteLength))
    })
  })

  describe('transactionVersion', function () {
    it('should be interpreted as an int32le', function () {
      var txHex = 'ffffffff0000ffffffff'
      var tx = Transaction.fromHex(txHex)
      assert.equal(-1, tx.version)
      assert.equal(0xffffffff, tx.locktime)
    })
  })

  describe('addInput', function () {
    var prevTxHash
    beforeEach(function () {
      prevTxHash = new Buffer('ffffffff00ffff000000000000000000000000000000000000000000101010ff', 'hex')
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

  describe('isCoinbase', function () {
    fixtures.valid.forEach(function (f) {
      it('should return ' + f.coinbase + ' for ' + f.id, function () {
        var tx = Transaction.fromHex(f.hex)

        assert.strictEqual(tx.isCoinbase(), f.coinbase)
      })
    })
  })

  describe('hashForSignature', function () {
    fixtures.hashForSignature.forEach(function (f) {
      it('should return ' + f.hash + ' for ' + (f.description ? ('case "' + f.description + '"') : f.script), function () {
        var tx = Transaction.fromHex(f.txHex)
        var script = bscript.fromASM(f.script)

        assert.strictEqual(tx.hashForSignature(f.inIndex, script, f.type).toString('hex'), f.hash)
      })
    })
  })

  describe('hashForSignatureWitness', function () {
    fixtures.v1_sighash.forEach(function (f) {
      it('should return ' + f.expectedHash + ' for ' + (f.description ? ('case "' + f.description + '"') : ''), function () {
        var tx = Transaction.fromHex(f.unsignedTx)
        var inputToSign = f.inputToSign
        var valueSatoshis = f.outputValueBtc * 1e8
        var scriptCode = new Buffer(f.hashScriptCode, 'hex')
        var sigHashType = f.sigHashType

        assert.strictEqual(tx.hashForWitnessV0(inputToSign, scriptCode, valueSatoshis, sigHashType).toString('hex'), f.expectedHash)
      })
    })
  })

  describe('setWitness', function () {
    it('should be able to set the witness of an input', function () {
      var hash = new Buffer('abcd0123abcd0123abcd0123abcd0123abcd0123abcd0123abcd0123abcd0123', 'hex')
      var index = 1
      var sequence = 0xffffffff
      var scriptSig = new Buffer('41', 'hex')
      var tx = new Transaction()
      tx.addInput(hash, index, sequence, scriptSig)

      assert.strictEqual(hash, tx.ins[0].hash)
      assert.strictEqual(index, tx.ins[0].index)
      assert.strictEqual(sequence, tx.ins[0].sequence)
      assert.strictEqual(scriptSig, tx.ins[0].script)
      assert.equal(true, Array.isArray(tx.ins[0].witness))
      assert.equal(0, tx.ins[0].witness.length)

      var witness = [
        new Buffer('00', 'hex'),
        new Buffer('51', 'hex')
      ]
      tx.setWitness(0, witness)
      assert.strictEqual(witness, tx.ins[0].witness)
    })
  })

  describe('addWitnessInput', function () {
    it('should add a witness bearing input', function () {
      var hash = new Buffer('abcd0123abcd0123abcd0123abcd0123abcd0123abcd0123abcd0123abcd0123', 'hex')
      var index = 1
      var sequence = 0xffffffff
      var scriptSig = new Buffer('41', 'hex')
      var witness = [
        new Buffer('00', 'hex'),
        new Buffer('51', 'hex')
      ]

      var tx = new Transaction()
      tx.addWitnessInput(hash, index, sequence, scriptSig, witness)

      assert.strictEqual(hash, tx.ins[0].hash)
      assert.strictEqual(index, tx.ins[0].index)
      assert.strictEqual(sequence, tx.ins[0].sequence)
      assert.strictEqual(scriptSig, tx.ins[0].script)
      assert.strictEqual(witness, tx.ins[0].witness)
    })
  })
})
