/* global describe, it, beforeEach */

var assert = require('assert')
var bscript = require('../src/script')
var bcrypto = require('../src/crypto')
var bufferReverse = require('buffer-reverse')
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

  describe('fromBuffer/fromHex', function () {
    function importExport (f) {
      var id = f.id || f.hash
      var txHex = f.hex || f.txHex

      if (f.hasWitness) {
        it('imports ' + f.description + ' (' + id + ') as witness', function () {
          var actual = Transaction.fromHex(f.witnessHex)

          assert.strictEqual(actual.toHex(), f.witnessHex, actual.toHex())
        })
      }

      it('imports ' + f.description + ' (' + id + ')', function () {
        var actual = Transaction.fromHex(txHex)

        assert.strictEqual(actual.toHex(), txHex, actual.toHex())
      })
    }

    fixtures.valid.forEach(importExport)
    fixtures.witness.forEach(importExport)
    fixtures.hashForSignature.forEach(importExport)
    fixtures.hashForWitnessV0.forEach(importExport)

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

    it('returns an index', function () {
      var tx = new Transaction()
      assert.strictEqual(tx.addInput(prevTxHash, 0), 0)
      assert.strictEqual(tx.addInput(prevTxHash, 0), 1)
    })

    it('defaults to empty script, witness and 0xffffffff SEQUENCE number', function () {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.strictEqual(tx.ins[0].script.length, 0)
      assert.strictEqual(tx.ins[0].witness.length, 0)
      assert.strictEqual(tx.ins[0].sequence, 0xffffffff)
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

  describe('hashForWitnessV0', function () {
    fixtures.hashForWitnessV0.forEach(function (f) {
      it('should return ' + f.hash + ' for ' + (f.description ? ('case "' + f.description + '"') : ''), function () {
        var tx = Transaction.fromHex(f.txHex)
        var script = bscript.fromASM(f.script)

        assert.strictEqual(tx.hashForWitnessV0(f.inIndex, script, f.value, f.type).toString('hex'), f.hash)
      })
    })
  })

  describe('signature hashing', function () {
    function unsignedTransactionFromRaw (raw) {
      var unsigned = new Transaction()
      unsigned.version = raw.version
      unsigned.ins = raw.ins.map(function (input) {
        return {
          hash: bufferReverse(new Buffer(input.hash, 'hex')),
          index: input.index,
          script: new Buffer(0), // Empty for now
          witness: [],           // Empty for now
          sequence: 4294967295
        }
      })
      unsigned.outs = raw.outs.map(function (output) {
        return {
          value: output.value,
          script: new Buffer(output.scriptHex, 'hex')
        }
      })
      unsigned.locktime = 0
      return unsigned
    }

    function checkInputsMatchSigHash (f) {
      var unsigned = unsignedTransactionFromRaw(f.raw)

      f.raw.ins.forEach(function (input) {
        it('determines the correct sighash for all inputs', function () {
          var prevOutScript = new Buffer(input.scriptPubKey, 'hex')
          var valueOut = input.value ? input.value : 0
          var redeemScript = input.redeemScript ? new Buffer(input.redeemScript, 'hex') : undefined
          var witnessScript = input.witnessScript ? new Buffer(input.witnessScript, 'hex') : undefined
          var expectedSigHash = new Buffer(input.sigHash, 'hex')
          var tx = unsigned

          // This is example usage of solveOutput

          var sigVersion = 0
          var solution = bscript.solveOutput(prevOutScript)
          if (solution.type === bscript.types.P2SH) {
            // This line is useless given the example, but illustrates usage
            if (solution.solvedBy.equals(bcrypto.hash160(redeemScript))) {
              solution = bscript.solveOutput(redeemScript)
            }
          }

          // We again use solvedBy (result of the script.*.output.decode() function)
          // But notice, here we don't know if it's witness due to (i) scriptPubKey or (ii) redeemScript
          // so it's nice solveOutput also returns solvedBy
          if (solution.type === bscript.types.P2WPKH) {
            sigVersion = 1
            solution = bscript.solveOutput(bscript.pubKeyHash.output.encode(solution.solvedBy))
          } else if (solution.type === bscript.types.P2WSH) {
            sigVersion = 1
            solution = bscript.solveOutput(witnessScript)
          }

          assert([bscript.types.P2PKH, bscript.types.P2PK, bscript.types.MULTISIG].indexOf(solution.type) !== -1, 'should have found a signable type')

          var hash = sigVersion === 1
            ? tx.hashForWitnessV0(0, solution.script, valueOut, Transaction.SIGHASH_ALL)
            : tx.hashForSignature(0, solution.script, Transaction.SIGHASH_ALL)

          assert.equal(hash.toString('hex'), expectedSigHash.toString('hex'))
        })
      })
    }

    fixtures.witness.forEach(checkInputsMatchSigHash)
  })
})
