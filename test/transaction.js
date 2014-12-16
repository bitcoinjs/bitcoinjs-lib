var assert = require('assert')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var ECKey = require('../src/eckey')
var Transaction = require('../src/transaction')
var Script = require('../src/script')

var fixtures = require('./fixtures/transaction')

describe('Transaction', function() {
  function fromRaw(raw) {
    var tx = new Transaction()
    tx.version = raw.version
    tx.locktime = raw.locktime

    raw.ins.forEach(function(txIn) {
      var txHash = new Buffer(txIn.hash, 'hex')
      var script = txIn.script ? Script.fromASM(txIn.script) : undefined

      tx.addInput(txHash, txIn.index, txIn.sequence, script)
    })

    raw.outs.forEach(function(txOut) {
      tx.addOutput(Script.fromASM(txOut.script), txOut.value)
    })

    return tx
  }

  describe('fromBuffer/fromHex', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.id + ' correctly', function() {
        var actual = Transaction.fromHex(f.hex)

        assert.deepEqual(actual.toHex(), f.hex)
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
      it('exports ' + f.id + ' correctly', function() {
        var actual = fromRaw(f.raw)

        assert.deepEqual(actual.toHex(), f.hex)
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

    it('defaults to empty script', function() {
      var tx = new Transaction()
      tx.addInput(prevTxHash, 0)

      assert.equal(tx.ins[0].script, Script.EMPTY)
    })

    fixtures.valid.forEach(function(f) {
      it('should add the inputs for ' + f.id + ' correctly', function() {
        var tx = new Transaction()

        f.raw.ins.forEach(function(txIn, i) {
          var txHash = new Buffer(txIn.hash, 'hex')
          var script = txIn.script ? Script.fromASM(txIn.script) : undefined
          var j = tx.addInput(txHash, txIn.index, txIn.sequence, script)
          var sequence = txIn.sequence
          if (sequence === undefined || sequence === null ) {
            sequence = Transaction.DEFAULT_SEQUENCE
          }

          assert.equal(i, j)
          assert.equal(tx.ins[i].hash.toString('hex'), txIn.hash)
          assert.equal(tx.ins[i].index, txIn.index)
          assert.equal(tx.ins[i].sequence, sequence)
          assert.deepEqual(tx.ins[i].script, script || Script.EMPTY)
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
      it('should add the outputs for ' + f.id + ' correctly', function() {
        var tx = new Transaction()

        f.raw.outs.forEach(function(txOut, i) {
          var scriptPubKey = Script.fromASM(txOut.script)
          var j = tx.addOutput(scriptPubKey, txOut.value)

          assert.equal(i, j)
          assert.equal(tx.outs[i].script, scriptPubKey)
          assert.equal(tx.outs[i].value, txOut.value)
        })
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
      it('should return the id for ' + f.id, function() {
        var tx = Transaction.fromHex(f.hex)
        var actual = tx.getId()

        assert.equal(actual, f.id)
      })
    })
  })

  describe('getHash', function() {
    fixtures.valid.forEach(function(f) {
      it('should return the hash for ' + f.id, function() {
        var tx = Transaction.fromHex(f.hex)
        var actual = tx.getHash().toString('hex')

        assert.equal(actual, f.hash)
      })
    })
  })

  // TODO:
  //  hashForSignature: [Function],

  // FIXME: remove in 2.x.y
  describe('signInput/validateInput', function() {
    it('works for multi-sig redeem script', function() {
      var tx = new Transaction()
      tx.addInput('d6f72aab8ff86ff6289842a0424319bf2ddba85dc7c52757912297f948286389', 0)
      tx.addOutput('mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', 1)

      var privKeys = [
        '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAnchuDf',
        '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAvUcVfH'
      ].map(function(wif) {
        return ECKey.fromWIF(wif)
      })
      var pubKeys = privKeys.map(function(eck) { return eck.pub })
      var redeemScript = scripts.multisigOutput(2, pubKeys)

      var signatures = privKeys.map(function(privKey) {
        return tx.signInput(0, redeemScript, privKey)
      })

      var redeemScriptSig = scripts.multisigInput(signatures)
      var scriptSig = scripts.scriptHashInput(redeemScriptSig, redeemScript)
      tx.setInputScript(0, scriptSig)

      signatures.forEach(function(sig, i){
        assert(tx.validateInput(0, redeemScript, privKeys[i].pub, sig))
      })

      var expected = '010000000189632848f99722915727c5c75da8db2dbf194342a0429828f66ff88fab2af7d600000000fd1b0100483045022100e5be20d440b2bbbc886161f9095fa6d0bca749a4e41d30064f30eb97adc7a1f5022061af132890d8e4e90fedff5e9365aeeb77021afd8ef1d5c114d575512e9a130a0147304402205054e38e9d7b5c10481b6b4991fde5704cd94d49e344406e3c2ce4d18a43bf8e022051d7ba8479865b53a48bee0cce86e89a25633af5b2918aa276859489e232f51c014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0101000000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000'
      assert.equal(tx.toHex(), expected)
    })
  })
})
