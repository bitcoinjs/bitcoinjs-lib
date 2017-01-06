/* global describe, it, beforeEach */

var assert = require('assert')
var baddress = require('../src/address')
var bscript = require('../src/script')
var ops = require('bitcoin-ops')

var BigInteger = require('bigi')
var ECPair = require('../src/ecpair')
var Transaction = require('../src/transaction')
var TransactionBuilder = require('../src/transaction_builder')
var NETWORKS = require('../src/networks')

var fixtures = require('./fixtures/transaction_builder')

function construct (f, dontSign) {
  var network = NETWORKS[f.network]
  var txb = new TransactionBuilder(network)

  if (f.version !== undefined) txb.setVersion(f.version)
  if (f.locktime !== undefined) txb.setLockTime(f.locktime)

  f.inputs.forEach(function (input) {
    var prevTx
    if (input.txRaw) {
      var constructed = construct(input.txRaw)
      if (input.txRaw.incomplete) prevTx = constructed.buildIncomplete()
      else prevTx = constructed.build()
    } else if (input.txHex) {
      prevTx = Transaction.fromHex(input.txHex)
    } else {
      prevTx = input.txId
    }

    var prevTxScript
    if (input.prevTxScript) {
      prevTxScript = bscript.fromASM(input.prevTxScript)
    }

    txb.addInput(prevTx, input.vout, input.sequence, prevTxScript)
  })

  f.outputs.forEach(function (output) {
    if (output.address) {
      txb.addOutput(output.address, output.value)
    } else {
      txb.addOutput(bscript.fromASM(output.script), output.value)
    }
  })

  if (dontSign) return txb

  f.inputs.forEach(function (input, index) {
    if (!input.signs) return
    input.signs.forEach(function (sign) {
      var keyPair = ECPair.fromWIF(sign.keyPair, network)
      var redeemScript
      var witnessScript
      var value
      if (sign.redeemScript) {
        redeemScript = bscript.fromASM(sign.redeemScript)
      }
      if (sign.value) {
        value = sign.value
      }
      if (sign.witnessScript) {
        witnessScript = bscript.fromASM(sign.witnessScript)
      }
      txb.sign(index, keyPair, redeemScript, sign.hashType, value, witnessScript)
    })
  })

  return txb
}

describe('TransactionBuilder', function () {
  // constants
  var keyPair = new ECPair(BigInteger.ONE)
  var scripts = [
    '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
    '1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP'
  ].map(function (x) {
    return baddress.toOutputScript(x)
  })
  var txHash = new Buffer('0e7cea811c0be9f73c0aca591034396e7264473fc25c1ca45195d7417b36cbe2', 'hex')

  describe('fromTransaction', function () {
    fixtures.valid.build.forEach(function (f) {
      it('returns TransactionBuilder, with ' + f.description, function () {
        var network = NETWORKS[f.network || 'bitcoin']

        var tx = Transaction.fromHex(f.txHex)
        var txb = TransactionBuilder.fromTransaction(tx, network)
        assert.strictEqual(txb.build().toHex(), f.txHex)
        assert.strictEqual(txb.network, network)
      })
    })

    fixtures.valid.fromTransaction.forEach(function (f) {
      it('returns TransactionBuilder, with ' + f.description, function () {
        var tx = new Transaction()

        f.inputs.forEach(function (input) {
          var txHash2 = new Buffer(input.txId, 'hex').reverse()

          tx.addInput(txHash2, input.vout, undefined, bscript.fromASM(input.scriptSig))
        })

        f.outputs.forEach(function (output) {
          tx.addOutput(bscript.fromASM(output.script), output.value)
        })

        var txb = TransactionBuilder.fromTransaction(tx)
        var txAfter = f.incomplete ? txb.buildIncomplete() : txb.build()

        txAfter.ins.forEach(function (input, i) {
          assert.equal(bscript.toASM(input.script), f.inputs[i].scriptSigAfter)
        })

        txAfter.outs.forEach(function (output, i) {
          assert.equal(bscript.toASM(output.script), f.outputs[i].script)
        })
      })
    })

    fixtures.invalid.fromTransaction.forEach(function (f) {
      it('throws ' + f.exception, function () {
        var tx = Transaction.fromHex(f.txHex)

        assert.throws(function () {
          TransactionBuilder.fromTransaction(tx)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('addInput', function () {
    var txb
    beforeEach(function () {
      txb = new TransactionBuilder()
    })

    it('accepts a txHash, index [and sequence number]', function () {
      var vin = txb.addInput(txHash, 1, 54)
      assert.strictEqual(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.strictEqual(txIn.hash, txHash)
      assert.strictEqual(txIn.index, 1)
      assert.strictEqual(txIn.sequence, 54)
      assert.strictEqual(txb.inputs[0].prevOutScript, undefined)
    })

    it('accepts a txHash, index [, sequence number and scriptPubKey]', function () {
      var vin = txb.addInput(txHash, 1, 54, scripts[1])
      assert.strictEqual(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.strictEqual(txIn.hash, txHash)
      assert.strictEqual(txIn.index, 1)
      assert.strictEqual(txIn.sequence, 54)
      assert.strictEqual(txb.inputs[0].prevOutScript, scripts[1])
    })

    it('accepts a prevTx, index [and sequence number]', function () {
      var prevTx = new Transaction()
      prevTx.addOutput(scripts[0], 0)
      prevTx.addOutput(scripts[1], 1)

      var vin = txb.addInput(prevTx, 1, 54)
      assert.strictEqual(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.deepEqual(txIn.hash, prevTx.getHash())
      assert.strictEqual(txIn.index, 1)
      assert.strictEqual(txIn.sequence, 54)
      assert.strictEqual(txb.inputs[0].prevOutScript, scripts[1])
    })

    it('returns the input index', function () {
      assert.strictEqual(txb.addInput(txHash, 0), 0)
      assert.strictEqual(txb.addInput(txHash, 1), 1)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function () {
      txb.addInput(txHash, 0)
      txb.sign(0, keyPair)

      assert.throws(function () {
        txb.addInput(txHash, 0)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('addOutput', function () {
    var txb
    beforeEach(function () {
      txb = new TransactionBuilder()
    })

    it('accepts an address string and value', function () {
      var vout = txb.addOutput(keyPair.getAddress(), 1000)
      assert.strictEqual(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, scripts[0])
      assert.strictEqual(txout.value, 1000)
    })

    it('accepts a ScriptPubKey and value', function () {
      var vout = txb.addOutput(scripts[0], 1000)
      assert.strictEqual(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, scripts[0])
      assert.strictEqual(txout.value, 1000)
    })

    it('throws if address is of the wrong network', function () {
      assert.throws(function () {
        txb.addOutput('2NGHjvjw83pcVFgMcA7QvSMh2c246rxLVz9', 1000)
      }, /2NGHjvjw83pcVFgMcA7QvSMh2c246rxLVz9 has no matching Script/)
    })

    it('add second output after signed first input with SIGHASH_NONE', function () {
      txb.addInput(txHash, 0)
      txb.addOutput(scripts[0], 2000)
      txb.sign(0, keyPair, undefined, Transaction.SIGHASH_NONE)
      assert.equal(txb.addOutput(scripts[1], 9000), 1)
    })

    it('add first output after signed first input with SIGHASH_NONE', function () {
      txb.addInput(txHash, 0)
      txb.sign(0, keyPair, undefined, Transaction.SIGHASH_NONE)
      assert.equal(txb.addOutput(scripts[0], 2000), 0)
    })

    it('add second output after signed first input with SIGHASH_SINGLE', function () {
      txb.addInput(txHash, 0)
      txb.addOutput(scripts[0], 2000)
      txb.sign(0, keyPair, undefined, Transaction.SIGHASH_SINGLE)
      assert.equal(txb.addOutput(scripts[1], 9000), 1)
    })

    it('add first output after signed first input with SIGHASH_SINGLE', function () {
      txb.addInput(txHash, 0)
      txb.sign(0, keyPair, undefined, Transaction.SIGHASH_SINGLE)
      assert.throws(function () {
        txb.addOutput(scripts[0], 2000)
      }, /No, this would invalidate signatures/)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function () {
      txb.addInput(txHash, 0)
      txb.addOutput(scripts[0], 2000)
      txb.sign(0, keyPair)

      assert.throws(function () {
        txb.addOutput(scripts[1], 9000)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('setLockTime', function () {
    it('throws if if there exist any scriptSigs', function () {
      var txb = new TransactionBuilder()
      txb.addInput(txHash, 0)
      txb.sign(0, keyPair)

      assert.throws(function () {
        txb.setLockTime(65535)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('sign', function () {
    fixtures.invalid.sign.forEach(function (f) {
      it('throws on ' + f.exception + (f.description ? ' (' + f.description + ')' : ''), function () {
        var txb = construct(f, true)

        f.inputs.forEach(function (input, index) {
          input.signs.forEach(function (sign) {
            var keyPairNetwork = NETWORKS[sign.network || f.network]
            var keyPair2 = ECPair.fromWIF(sign.keyPair, keyPairNetwork)
            var redeemScript

            if (sign.redeemScript) {
              redeemScript = bscript.fromASM(sign.redeemScript)
            }

            if (!sign.throws) {
              txb.sign(index, keyPair2, redeemScript, sign.hashType, sign.value)
            } else {
              assert.throws(function () {
                txb.sign(index, keyPair2, redeemScript, sign.hashType, sign.value)
              }, new RegExp(f.exception))
            }
          })
        })
      })
    })
  })

  describe('build', function () {
    fixtures.valid.build.forEach(function (f) {
      it('builds "' + f.description + '"', function () {
        var txb = construct(f)
        var tx = txb.build()
        assert.strictEqual(tx.toHex(), f.txHex)
      })
    })

    // TODO: remove duplicate test code
    fixtures.invalid.build.forEach(function (f) {
      describe('for ' + (f.description || f.exception), function () {
        it('throws ' + f.exception, function () {
          assert.throws(function () {
            var txb
            if (f.txHex) {
              txb = TransactionBuilder.fromTransaction(Transaction.fromHex(f.txHex))
            } else {
              txb = construct(f)
            }

            txb.build()
          }, new RegExp(f.exception))
        })

        // if throws on incomplete too, enforce that
        if (f.incomplete) {
          it('throws ' + f.exception, function () {
            assert.throws(function () {
              var txb
              if (f.txHex) {
                txb = TransactionBuilder.fromTransaction(Transaction.fromHex(f.txHex))
              } else {
                txb = construct(f)
              }

              txb.buildIncomplete()
            }, new RegExp(f.exception))
          })
        } else {
          it('does not throw if buildIncomplete', function () {
            var txb
            if (f.txHex) {
              txb = TransactionBuilder.fromTransaction(Transaction.fromHex(f.txHex))
            } else {
              txb = construct(f)
            }

            txb.buildIncomplete()
          })
        }
      })
    })
  })

  describe('multisig', function () {
    fixtures.valid.multisig.forEach(function (f) {
      it(f.description, function () {
        var txb = construct(f, true)
        var tx
        var network = NETWORKS[f.network]

        f.inputs.forEach(function (input, i) {
          var redeemScript = bscript.fromASM(input.redeemScript)

          input.signs.forEach(function (sign) {
            // rebuild the transaction each-time after the first
            if (tx) {
              // do we filter OP_0's beforehand?
              if (sign.filterOP_0) {
                var scriptSig = tx.ins[i].script

                // ignore OP_0 on the front, ignore redeemScript
                var signatures = bscript.decompile(scriptSig).slice(1, -1).filter(function (x) { return x !== ops.OP_0 })

                // rebuild/replace the scriptSig without them
                var replacement = bscript.scriptHash.input.encode(bscript.multisig.input.encode(signatures), redeemScript)
                assert.strictEqual(bscript.toASM(replacement), sign.scriptSigFiltered)

                tx.ins[i].script = replacement
              }
              // now import it
              txb = TransactionBuilder.fromTransaction(tx, network)
            }

            var keyPair2 = ECPair.fromWIF(sign.keyPair, network)
            txb.sign(i, keyPair2, redeemScript, sign.hashType)

            // update the tx
            tx = txb.buildIncomplete()
            // now verify the serialized scriptSig is as expected
            assert.strictEqual(bscript.toASM(tx.ins[i].script), sign.scriptSig)
          })
        })

        tx = txb.build()
        assert.strictEqual(tx.toHex(), f.txHex)
      })
    })
  })

  describe('multisig edge case', function () {
    var network = NETWORKS.testnet

    it('should handle badly pre-filled OP_0s', function () {
      // OP_0 is used where a signature is missing
      var redeemScripSig = bscript.fromASM('OP_0 OP_0 3045022100daf0f4f3339d9fbab42b098045c1e4958ee3b308f4ae17be80b63808558d0adb02202f07e3d1f79dc8da285ae0d7f68083d769c11f5621ebd9691d6b48c0d4283d7d01 52410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253ae')
      var redeemScript = bscript.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG')

      var tx = new Transaction()
      tx.addInput(new Buffer('cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f07149', 'hex'), 0, undefined, redeemScripSig)
      tx.addOutput(new Buffer('76a914aa4d7985c57e011a8b3dd8e0e5a73aaef41629c588ac', 'hex'), 1000)

      // now import the Transaction
      var txb = TransactionBuilder.fromTransaction(tx, NETWORKS.testnet)

      var keyPair2 = ECPair.fromWIF('91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe', network)
      txb.sign(0, keyPair2, redeemScript)

      var tx2 = txb.build()
      assert.equal(tx2.getId(), 'eab59618a564e361adef6d918bd792903c3d41bcf1220137364fb847880467f9')
      assert.equal(bscript.toASM(tx2.ins[0].script), 'OP_0 3045022100daf0f4f3339d9fbab42b098045c1e4958ee3b308f4ae17be80b63808558d0adb02202f07e3d1f79dc8da285ae0d7f68083d769c11f5621ebd9691d6b48c0d4283d7d01 3045022100a346c61738304eac5e7702188764d19cdf68f4466196729db096d6c87ce18cdd022018c0e8ad03054b0e7e235cda6bedecf35881d7aa7d94ff425a8ace7220f38af001 52410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253ae')
    })
  })
})
