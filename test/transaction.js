var assert = require('assert')

var Address = require('../src/address')
var Transaction = require('../src/transaction')

var fixtures = require('./fixtures/transaction')

// FIXME: what is a better way to do this, seems a bit odd
fixtures.valid.forEach(function(f) {
  var Script = require('../src/script')

  f.raw.ins.forEach(function(fin) {
    fin.hash = new Buffer(fin.hash, 'hex')
    fin.script = Script.fromHex(fin.script)
  })

  f.raw.outs.forEach(function(fout) {
    fout.script = Script.fromHex(fout.script)
  })
})

describe('Transaction', function() {
  describe('fromBuffer/fromHex', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.txid + ' correctly', function() {
        var actual = Transaction.fromHex(f.hex)

        assert.deepEqual(actual, f.raw)
      })
    })

    fixtures.invalid.fromBuffer.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        assert.throws(function() {
          Transaction.fromHex(f.hex)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toBuffer/toHex', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.txid + ' correctly', function() {
        var actual = Transaction.prototype.toBuffer.call(f.raw)

        assert.equal(actual.toString('hex'), f.hex)
      })
    })
  })

  describe('addInput', function() {
    // FIXME: not as pretty as could be
    // Probably a bit representative of the API
    var prevTxHash, prevTxId, prevTx
    beforeEach(function() {
      var f = fixtures.valid[0]
      prevTx = Transaction.fromHex(f.hex)
      prevTxHash = prevTx.getHash()
      prevTxId = prevTx.getId()
    })

    it('accepts a transaction id', function() {
      var tx = new Transaction()
      tx.addInput(prevTxId, 0)

      assert.deepEqual(tx.ins[0].hash, prevTxHash)
    })

    it('accepts a transaction hash', function() {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.deepEqual(tx.ins[0].hash, prevTxHash)
    })

    it('accepts a Transaction object', function() {
      var tx = new Transaction()
      tx.addInput(prevTx, 0)

      assert.deepEqual(tx.ins[0].hash, prevTxHash)
    })

    it('returns an index', function() {
      var tx = new Transaction()
      assert.equal(tx.addInput(prevTxHash, 0), 0)
      assert.equal(tx.addInput(prevTxHash, 0), 1)
    })

    it('defaults to DEFAULT_SEQUENCE', function() {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.equal(tx.ins[0].sequence, Transaction.DEFAULT_SEQUENCE)
    })

    fixtures.valid.forEach(function(f) {
      it('should add the inputs for ' + f.txid + ' correctly', function() {
        var tx = new Transaction()

        f.raw.ins.forEach(function(txIn, i) {
          var j = tx.addInput(txIn.hash, txIn.index, txIn.sequence)

          assert.equal(i, j)
          assert.deepEqual(tx.ins[i].hash, txIn.hash)
          assert.equal(tx.ins[i].index, txIn.index)

          var sequence = txIn.sequence
          if (sequence == undefined) sequence = Transaction.DEFAULT_SEQUENCE
          assert.equal(tx.ins[i].sequence, sequence)
        })
      })
    })

    fixtures.invalid.addInput.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        var tx = new Transaction()
        var hash = new Buffer(f.hash, 'hex')

        assert.throws(function() {
          tx.addInput(hash, f.index)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('addOutput', function() {
    // FIXME: not as pretty as could be
    // Probably a bit representative of the API
    var destAddressB58, destAddress, destScript
    beforeEach(function() {
      destAddressB58 = '15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3'
      destAddress = Address.fromBase58Check(destAddressB58)
      destScript = destAddress.toOutputScript()
    })

    it('accepts an address string', function() {
      var tx = new Transaction()
      tx.addOutput(destAddressB58, 40000)

      assert.deepEqual(tx.outs[0].script, destScript)
      assert.equal(tx.outs[0].value, 40000)
    })

    it('accepts an Address', function() {
      var tx = new Transaction()
      tx.addOutput(destAddress, 40000)

      assert.deepEqual(tx.outs[0].script, destScript)
      assert.equal(tx.outs[0].value, 40000)
    })

    it('accepts a scriptPubKey', function() {
      var tx = new Transaction()
      tx.addOutput(destScript, 40000)

      assert.deepEqual(tx.outs[0].script, destScript)
      assert.equal(tx.outs[0].value, 40000)
    })

    it('returns an index', function() {
      var tx = new Transaction()
      assert.equal(tx.addOutput(destScript, 40000), 0)
      assert.equal(tx.addOutput(destScript, 40000), 1)
    })

    fixtures.valid.forEach(function(f) {
      it('should add the outputs for ' + f.txid + ' correctly', function() {
        var tx = new Transaction()

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
      var expected = Transaction.fromHex(f.hex)
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
      it('should return the txid for ' + f.txid, function() {
        var tx = Transaction.fromHex(f.hex)
        var actual = tx.getId()

        assert.equal(actual, f.txid)
      })
    })
  })

  describe('getHash', function() {
    fixtures.valid.forEach(function(f) {
      it('should return the hash for ' + f.txid, function() {
        var tx = Transaction.fromHex(f.hex)
        var actual = tx.getHash().toString('hex')

        assert.equal(actual, f.hash)
      })
    })
  })

  // TODO:
  //  hashForSignature: [Function],
})
