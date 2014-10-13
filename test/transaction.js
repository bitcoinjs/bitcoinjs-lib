var assert = require('assert')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var BigInteger = require('bigi')
var ECPair = require('../src/ecpair')
var RawTransaction = require('../src/raw_transaction')
var Script = require('../src/script')
var Transaction = require('../src/transaction')

var fixtures = require('./fixtures/transaction')

describe('Transaction', function() {
  var privAddress, privScript
  var prevTx, prevTxHash, prevTxId
  var keyPair
  var txb
  var value

  beforeEach(function() {
    txb = new Transaction()

    var prevTxB = new Transaction()
    prevTxB.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',0)
    prevTxB.addOutput('1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP', 0)
    prevTx = prevTxB.buildIncomplete()
    prevTxHash = prevTx.getHash()
    prevTxId = prevTx.getId()

    keyPair = new ECPair(BigInteger.ONE, null, { compressed: false })
    privAddress = keyPair.getAddress()
    privScript = Address.toOutputScript(privAddress)
    value = 10000
  })

  describe('addInput', function() {
    it('accepts a txHash, index [and sequence number]', function() {
      var vin = txb.addInput(prevTxHash, 1, 54)
      assert.equal(vin, 0)

      var txin = txb.tx.ins[0]
      assert.equal(txin.hash, prevTxHash)
      assert.equal(txin.index, 1)
      assert.equal(txin.sequence, 54)
      assert.equal(txb.prevOutScripts[0], undefined)
    })

    it('accepts a txHash, index [, sequence number and scriptPubKey]', function() {
      var vin = txb.addInput(prevTxHash, 1, 54, prevTx.outs[1].script)
      assert.equal(vin, 0)

      var txin = txb.tx.ins[0]
      assert.equal(txin.hash, prevTxHash)
      assert.equal(txin.index, 1)
      assert.equal(txin.sequence, 54)
      assert.equal(txb.prevOutScripts[0], prevTx.outs[1].script)
    })

    it('accepts a RawTransaction, index [and sequence number]', function() {
      var vin = txb.addInput(prevTx, 1, 54)
      assert.equal(vin, 0)

      var txin = txb.tx.ins[0]
      assert.deepEqual(txin.hash, prevTxHash)
      assert.equal(txin.index, 1)
      assert.equal(txin.sequence, 54)
      assert.equal(txb.prevOutScripts[0], prevTx.outs[1].script)
    })

    it('returns the input index', function() {
      assert.equal(txb.addInput(prevTxHash, 0), 0)
      assert.equal(txb.addInput(prevTxHash, 1), 1)
    })

    it('throws if prevOutScript is not supported', function() {
      assert.throws(function() {
        txb.addInput(prevTxHash, 0, undefined, Script.EMPTY)
      }, /PrevOutScript not supported \(nonstandard\)/)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function() {
      txb.addInput(prevTxHash, 0)
      txb.sign(0, keyPair)

      assert.throws(function() {
        txb.addInput(prevTxHash, 0)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('addOutput', function() {
    it('accepts an address string and value', function() {
      var vout = txb.addOutput(privAddress, 1000)
      assert.equal(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, privScript)
      assert.equal(txout.value, 1000)
    })

    it('accepts a ScriptPubKey and value', function() {
      var vout = txb.addOutput(privScript, 1000)
      assert.equal(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, privScript)
      assert.equal(txout.value, 1000)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function() {
      txb.addInput(prevTxHash, 0)
      txb.addOutput(privScript, value)
      txb.sign(0, keyPair)

      assert.throws(function() {
        txb.addOutput(privScript, 9000)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('sign', function() {
    describe('when prevOutScript is undefined', function() {
      it('assumes pubKeyHash', function() {
        txb.addInput(prevTxHash, 0)
        txb.sign(0, keyPair)

        assert.strictEqual(txb.signatures[0].redeemScript, undefined)
        assert.equal(txb.signatures[0].scriptType, 'pubkeyhash')
      })
    })

    it('throws if scriptType doesn\'t support multiple signatures', function() {
      txb.addInput(prevTxHash, 0)
      txb.sign(0, keyPair)

      assert.throws(function() {
        txb.sign(0, keyPair)
      }, /pubkeyhash doesn\'t support multiple signatures/)
    })

    describe('when redeemScript is undefined', function() {
      it('throws if prevOutScript is P2SH', function() {
        var privScriptP2SH = scripts.scriptHashOutput(privScript.getHash())

        txb.addInput(prevTxHash, 0, undefined, privScriptP2SH)

        assert.throws(function() {
          txb.sign(0, keyPair)
        }, /PrevOutScript is P2SH, missing redeemScript/)
      })
    })

    describe('when redeemScript is defined', function() {
      it('assumes scriptHash', function() {
        txb.addInput(prevTxHash, 0)
        txb.sign(0, keyPair, privScript)

        assert.equal(txb.signatures[0].redeemScript, privScript)
      })

      it('throws if prevOutScript is not P2SH', function() {
        txb.addInput(prevTx, 0)

        assert.throws(function() {
          txb.sign(0, keyPair, privScript)
        }, /PrevOutScript must be P2SH/)
      })

      it('throws if redeemScript is P2SH', function() {
        txb.addInput(prevTxHash, 0)

        var privScriptP2SH = scripts.scriptHashOutput(privScript.getHash())

        assert.throws(function() {
          txb.sign(0, keyPair, privScriptP2SH)
        }, /RedeemScript can\'t be P2SH/)
      })

      it('throws if redeemScript not supported', function() {
        txb.addInput(prevTxHash, 0)

        assert.throws(function() {
          txb.sign(0, keyPair, Script.EMPTY)
        }, /RedeemScript not supported \(nonstandard\)/)
      })
    })
  })

  describe('build', function() {
    fixtures.valid.build.forEach(function(f) {
      it('builds the correct transaction', function() {
        f.inputs.forEach(function(input) {
          var prevTxScript

          if (input.prevTxScript) {
            prevTxScript = Script.fromASM(input.prevTxScript)
          }

          txb.addInput(input.prevTx, input.index, input.sequence, prevTxScript)
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
            var keyPair = ECPair.fromWIF(wif)

            txb.sign(index, keyPair, redeemScript)
          })
        })

        var tx = txb.build()

        assert.equal(tx.getId(), f.txid)
        assert.equal(tx.toHex(), f.txhex)
      })
    })

    fixtures.invalid.build.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        f.inputs.forEach(function(input) {
          var prevTxScript

          if (input.prevTxScript) {
            prevTxScript = Script.fromASM(input.prevTxScript)
          }

          txb.addInput(input.prevTx, input.index, input.sequence, prevTxScript)
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
            var keyPair = ECPair.fromWIF(wif)

            txb.sign(index, keyPair, redeemScript)
          })
        })

        assert.throws(function() {
          txb.build()
        }, new RegExp(f.exception))
      })
    })
  })

  describe('fromRawTransaction', function() {
    fixtures.valid.build.forEach(function(f) {
      it('builds the correct Transaction for ' + f.description, function() {
        var tx = RawTransaction.fromHex(f.txhex)
        var txb = Transaction.fromRawTransaction(tx)

        assert.equal(txb.build().toHex(), f.txhex)
      })
    })

    fixtures.invalid.fromRawTransaction.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        var tx = RawTransaction.fromHex(f.hex)

        assert.throws(function() {
          Transaction.fromRawTransaction(tx)
        }, new RegExp(f.exception))
      })
    })

    it('works for the P2SH multisig case', function() {
      var keyPairs = [
        "91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx",
        "91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT"
      ].map(function(wif) { return ECPair.fromWIF(wif) })
      var redeemScript = Script.fromASM("OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a OP_2 OP_CHECKMULTISIG")

      txb.addInput("4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf", 0)
      txb.addOutput("1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH", 10000)
      txb.sign(0, keyPairs[0], redeemScript)

      var tx = txb.buildIncomplete()

      // in another galaxy...
      // ... far, far away
      var txb2 = Transaction.fromRawTransaction(tx)

      // [you should] verify that Transaction is what you want...
      // ... then sign it
      txb2.sign(0, keyPairs[1], redeemScript)
      var tx2 = txb2.build()

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd1c01004830450221009c92c1ae1767ac04e424da7f6db045d979b08cde86b1ddba48621d59a109d818022004f5bb21ad72255177270abaeb2d7940ac18f1e5ca1f53db4f3fd1045647a8a8014830450221009418caa5bc18da87b188a180125c0cf06dce6092f75b2d3c01a29493466800fd02206ead65e7ca6e0f17eefe6f78457c084eab59af7c9882be1437de2e7116358eb9014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })
  })
})
