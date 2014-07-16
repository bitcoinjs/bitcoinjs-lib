var assert = require('assert')
var ecdsa = require('../src/ecdsa')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var BigInteger = require('bigi')
var ECKey = require('../src/eckey')
var Script = require('../src/script')
var Transaction = require('../src/transaction')
var TransactionBuilder = require('../src/transaction_builder')

var fixtures = require('./fixtures/transaction_builder')

describe('TransactionBuilder', function() {
  var privAddress, privScript
  var prevTx, prevTxHash
  var privKey
  var txb

  beforeEach(function() {
    txb = new TransactionBuilder()

    prevTx = new Transaction()
    prevTx.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 0)
    prevTx.addOutput('1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP', 1)
    prevTxHash = prevTx.getHash()
    prevTxId = prevTx.getId()

    privKey = new ECKey(BigInteger.ONE, false)
    privAddress = privKey.pub.getAddress()
    privScript = privAddress.toOutputScript()
    value = 10000
  })

  describe('addInput', function() {
    it('accepts a txHash and index', function() {
      var vin = txb.addInput(prevTxHash, 1)
      assert.equal(vin, 0)

      var txin = txb.tx.ins[0]
      assert.equal(txin.hash, prevTxHash)
      assert.equal(txin.index, 1)
      assert.equal(txb.prevOutScripts[0], undefined)
    })

    it('accepts a txHash, index and scriptPubKey', function() {
      var vin = txb.addInput(prevTxHash, 1, prevTx.outs[1].script)
      assert.equal(vin, 0)

      var txin = txb.tx.ins[0]
      assert.equal(txin.hash, prevTxHash)
      assert.equal(txin.index, 1)
      assert.equal(txb.prevOutScripts[0], prevTx.outs[1].script)
    })

    it('accepts a prevTx and index', function() {
      var vin = txb.addInput(prevTx, 1)
      assert.equal(vin, 0)

      var txin = txb.tx.ins[0]
      assert.deepEqual(txin.hash, prevTxHash)
      assert.equal(txin.index, 1)
      assert.equal(txb.prevOutScripts[0], prevTx.outs[1].script)
    })

    it('returns the input index', function() {
      assert.equal(txb.addInput(prevTxHash, 0), 0)
      assert.equal(txb.addInput(prevTxHash, 1), 1)
    })

    it('throws if a Tx and prevOutScript is given', function() {
      assert.throws(function() {
        txb.addInput(prevTx, 0, privScript)
      }, /Unnecessary Script provided/)
    })

    it('throws if prevOutScript is not supported', function() {
      assert.throws(function() {
        txb.addInput(prevTxHash, 0, Script.EMPTY)
      }, /PrevOutScript not supported \(nonstandard\)/)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function() {
      txb.addInput(prevTxHash, 0)
      txb.sign(0, privKey)

      assert.throws(function() {
        txb.addInput(prevTxHash, 0)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('addOutput', function() {
    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function() {
      txb.addInput(prevTxHash, 0)
      txb.addOutput(privScript, value)
      txb.sign(0, privKey)

      assert.throws(function() {
        txb.addOutput(privScript, 9000)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('sign', function() {
    describe('when prevOutScript is undefined', function() {
      it('assumes pubKeyHash', function() {
        txb.addInput(prevTxHash, 0)
        txb.sign(0, privKey)

        assert.strictEqual(txb.signatures[0].redeemScript, undefined)
        assert.equal(txb.signatures[0].scriptType, 'pubkeyhash')
      })
    })

    describe('when redeemScript is defined', function() {
      it('assumes scriptHash', function() {
        txb.addInput(prevTxHash, 0)
        txb.sign(0, privKey, privScript)

        assert.equal(txb.signatures[0].redeemScript, privScript)
      })

      it('throws if prevOutScript is not P2SH', function() {
        txb.addInput(prevTx, 0)

        assert.throws(function() {
          txb.sign(0, privKey, privScript)
        }, /PrevOutScript must be P2SH/)
      })

      it('throws if redeemScript is P2SH', function() {
        txb.addInput(prevTxHash, 0)

        var privScriptP2SH = scripts.scriptHashOutput(privScript.getHash())

        assert.throws(function() {
          txb.sign(0, privKey, privScriptP2SH)
        }, /RedeemScript can\'t be P2SH/)
      })

      it('throws if redeemScript not supported', function() {
        txb.addInput(prevTxHash, 0)

        assert.throws(function() {
          txb.sign(0, privKey, Script.EMPTY)
        }, /RedeemScript not supported \(nonstandard\)/)
      })
    })
  })

  describe('build', function() {
    fixtures.valid.build.forEach(function(f) {
      it('builds the correct transaction', function() {
        f.inputs.forEach(function(input) {
          var prevTx
          if (input.prevTx.length === 64) {
            prevTx = input.prevTx
          } else {
            prevTx = Transaction.fromHex(input.prevTx)
          }

          txb.addInput(prevTx, input.index)
        })

        f.outputs.forEach(function(output) {
          var script = Script.fromASM(output.script)

          txb.addOutput(script, output.value)
        })

        f.inputs.forEach(function(input, index) {
          var redeemScript

          if (input.redeemScript) {
            redeemScript = Script.fromASM(input.redeemScript)
          }

          input.privKeys.forEach(function(wif) {
            var privKey = ECKey.fromWIF(wif)

            txb.sign(index, privKey, redeemScript)
          })
        })

        var tx = txb.build()

        assert.equal(tx.getId(), f.txid)
      })
    })

    fixtures.invalid.build.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        f.inputs.forEach(function(input) {
          var prevTx
          if (input.prevTx.length === 64) {
            prevTx = input.prevTx
          } else {
            prevTx = Transaction.fromHex(input.prevTx)
          }

          txb.addInput(prevTx, input.index)
        })

        f.outputs.forEach(function(output) {
          var script = Script.fromASM(output.script)

          txb.addOutput(script, output.value)
        })

        f.inputs.forEach(function(input, index) {
          var redeemScript

          if (input.redeemScript) {
            redeemScript = Script.fromASM(input.redeemScript)
          }

          input.privKeys.forEach(function(wif) {
            var privKey = ECKey.fromWIF(wif)

            txb.sign(index, privKey, redeemScript)
          })
        })

        assert.throws(function() {
          txb.build()
        }, new RegExp(f.exception))
      })
    })
  })
})
