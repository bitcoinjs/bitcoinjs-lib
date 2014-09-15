var assert = require('assert')

var Address = require('../src/address')
var RawTransaction = require('../src/raw_transaction')

var fixtures = require('./fixtures/raw_transaction')

fixtures.valid.forEach(function(f) {
  var Script = require('../src/script')

  f.hash = new Buffer(f.hash, 'hex')

  f.raw.ins.forEach(function(fin) {
    fin.hash = new Buffer(fin.hash, 'hex')
    fin.script = Script.fromHex(fin.script)
  })

  f.raw.outs.forEach(function(fout) {
    fout.script = Script.fromHex(fout.script)
  })
})

fixtures.invalid.addInput.forEach(function(f) {
  f.hash = new Buffer(f.hash, 'hex')
})

describe('RawTransaction', function() {
  describe('fromBuffer/fromHex', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.id + ' correctly', function() {
        var actual = RawTransaction.fromHex(f.hex)

        assert.deepEqual(actual, f.raw)
      })
    })

    fixtures.invalid.fromBuffer.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        assert.throws(function() {
          RawTransaction.fromHex(f.hex)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toBuffer/toHex', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.id + ' correctly', function() {
        var actual = RawTransaction.prototype.toBuffer.call(f.raw)

        assert.equal(actual.toString('hex'), f.hex)
      })
    })
  })

  describe('addInput', function() {
    var prevTxHash
    beforeEach(function() {
      var f = fixtures.valid[0]
      prevTxHash = f.hash
    })

    it('accepts a transaction hash', function() {
      var tx = new RawTransaction()
      tx.addInput(prevTxHash, 0)

      assert.deepEqual(tx.ins[0].hash, prevTxHash)
    })

    it('returns an index', function() {
      var tx = new RawTransaction()
      assert.equal(tx.addInput(prevTxHash, 0), 0)
      assert.equal(tx.addInput(prevTxHash, 0), 1)
    })

    it('defaults to DEFAULT_SEQUENCE', function() {
      var tx = new RawTransaction()
      tx.addInput(prevTxHash, 0)

      assert.equal(tx.ins[0].sequence, RawTransaction.DEFAULT_SEQUENCE)
    })

    fixtures.valid.forEach(function(f) {
      it('should add the inputs for ' + f.id + ' correctly', function() {
        var tx = new RawTransaction()

        f.raw.ins.forEach(function(txIn, i) {
          var j = tx.addInput(txIn.hash, txIn.index, txIn.sequence)

          assert.equal(i, j)
          assert.deepEqual(tx.ins[i].hash, txIn.hash)
          assert.equal(tx.ins[i].index, txIn.index)

          var sequence = txIn.sequence
          if (sequence === undefined) sequence = RawTransaction.DEFAULT_SEQUENCE
          assert.equal(tx.ins[i].sequence, sequence)
        })
      })
    })

    fixtures.invalid.addInput.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        var tx = new RawTransaction()

        assert.throws(function() {
          tx.addInput(f.hash, f.index)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('addOutput', function() {
    var destScript
    beforeEach(function() {
      destScript = Address.fromBase58Check('15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3').toOutputScript()
    })

    it('accepts a scriptPubKey', function() {
      var tx = new RawTransaction()
      tx.addOutput(destScript, 40000)

      assert.deepEqual(tx.outs[0].script, destScript)
      assert.equal(tx.outs[0].value, 40000)
    })

    it('returns an index', function() {
      var tx = new RawTransaction()
      assert.equal(tx.addOutput(destScript, 40000), 0)
      assert.equal(tx.addOutput(destScript, 40000), 1)
    })

    fixtures.valid.forEach(function(f) {
      it('should add the outputs for ' + f.id + ' correctly', function() {
        var tx = new RawTransaction()

        f.raw.outs.forEach(function(txOut, i) {
          var j = tx.addOutput(txOut.script, txOut.value)

          assert.equal(i, j)
        })

        assert.deepEqual(tx.outs, f.raw.outs)
      })
    })
  })

  describe('clone', function() {
    fixtures.valid.forEach(function(f) {
      var expected = RawTransaction.fromHex(f.hex)
      var actual = expected.clone()

      it('should have value equality', function() {
        assert.deepEqual(actual, expected)
      })

      it('should not have reference equality', function() {
        assert.notEqual(actual, expected)
      })
    })
  })

  describe('getId', function() {
    fixtures.valid.forEach(function(f) {
      it('should return the txId for ' + f.id, function() {
        var tx = RawTransaction.fromHex(f.hex)

        assert.equal(tx.getId(), f.id)
      })
    })
  })

  describe('getHash', function() {
    fixtures.valid.forEach(function(f) {
      it('should return the hash for ' + f.id, function() {
        var tx = RawTransaction.fromHex(f.hex)

        assert.deepEqual(tx.getHash(), f.hash)
      })
    })
  })

  // TODO:
  //  hashForSignature: [Function],
})
