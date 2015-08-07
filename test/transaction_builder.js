/* global describe, it, beforeEach */

var assert = require('assert')
var ops = require('../src/opcodes')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var BigInteger = require('bigi')
var ECPair = require('../src/ecpair')
var Script = require('../src/script')
var Transaction = require('../src/transaction')
var TransactionBuilder = require('../src/transaction_builder')
var NETWORKS = require('../src/networks')

var fixtures = require('./fixtures/transaction_builder')

function construct (f, sign) {
  var network = NETWORKS[f.network]
  var txb = new TransactionBuilder(network)

  f.inputs.forEach(function (input) {
    var prevTxScript

    if (input.prevTxScript) {
      prevTxScript = Script.fromASM(input.prevTxScript)
    }

    txb.addInput(input.txId, input.vout, input.sequence, prevTxScript)
  })

  f.outputs.forEach(function (output) {
    var script = Script.fromASM(output.script)

    txb.addOutput(script, output.value)
  })

  if (sign === undefined || sign) {
    f.inputs.forEach(function (input, index) {
      input.signs.forEach(function (sign) {
        var keyPair = ECPair.fromWIF(sign.keyPair, network)
        var redeemScript

        if (sign.redeemScript) {
          redeemScript = Script.fromASM(sign.redeemScript)
        }

        txb.sign(index, keyPair, redeemScript, sign.hashType)
      })
    })
  }

  // FIXME: add support for locktime/version in TransactionBuilder API
  if (f.version !== undefined) {
    txb.tx.version = f.version
  }

  if (f.locktime !== undefined) {
    txb.tx.locktime = f.locktime
  }

  return txb
}

describe('TransactionBuilder', function () {
  var privAddress, privScript
  var prevTx, prevTxHash
  var keyPair
  var txb

  beforeEach(function () {
    txb = new TransactionBuilder()

    prevTx = new Transaction()
    prevTx.addOutput(Address.toOutputScript('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'), 0)
    prevTx.addOutput(Address.toOutputScript('1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP'), 1)
    prevTxHash = prevTx.getHash()

    keyPair = new ECPair(BigInteger.ONE)
    privAddress = keyPair.getAddress()
    privScript = Address.toOutputScript(privAddress)
  })

  describe('fromTransaction', function () {
    fixtures.valid.build.forEach(function (f) {
      it('builds the correct TransactionBuilder for ' + f.description, function () {
        var network = NETWORKS[f.network || 'bitcoin']
        var tx = Transaction.fromHex(f.txHex)
        var txb = TransactionBuilder.fromTransaction(tx, network)

        assert.strictEqual(txb.build().toHex(), f.txHex)
        assert.strictEqual(txb.network, network)
      })
    })

    fixtures.invalid.fromTransaction.forEach(function (f) {
      it('throws on ' + f.exception, function () {
        var tx = Transaction.fromHex(f.txHex)

        assert.throws(function () {
          TransactionBuilder.fromTransaction(tx)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('addInput', function () {
    it('accepts a txHash, index [and sequence number]', function () {
      var vin = txb.addInput(prevTxHash, 1, 54)
      assert.strictEqual(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.strictEqual(txIn.hash, prevTxHash)
      assert.strictEqual(txIn.index, 1)
      assert.strictEqual(txIn.sequence, 54)
      assert.strictEqual(txb.inputs[0].prevOutScript, undefined)
    })

    it('accepts a txHash, index [, sequence number and scriptPubKey]', function () {
      var vin = txb.addInput(prevTxHash, 1, 54, prevTx.outs[1].script)
      assert.strictEqual(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.strictEqual(txIn.hash, prevTxHash)
      assert.strictEqual(txIn.index, 1)
      assert.strictEqual(txIn.sequence, 54)
      assert.strictEqual(txb.inputs[0].prevOutScript, prevTx.outs[1].script)
    })

    it('accepts a prevTx, index [and sequence number]', function () {
      var vin = txb.addInput(prevTx, 1, 54)
      assert.strictEqual(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.deepEqual(txIn.hash, prevTxHash)
      assert.strictEqual(txIn.index, 1)
      assert.strictEqual(txIn.sequence, 54)
      assert.strictEqual(txb.inputs[0].prevOutScript, prevTx.outs[1].script)
    })

    it('returns the input index', function () {
      assert.strictEqual(txb.addInput(prevTxHash, 0), 0)
      assert.strictEqual(txb.addInput(prevTxHash, 1), 1)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function () {
      txb.addInput(prevTxHash, 0)
      txb.sign(0, keyPair)

      assert.throws(function () {
        txb.addInput(prevTxHash, 0)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('addOutput', function () {
    it('accepts an address string and value', function () {
      var vout = txb.addOutput(privAddress, 1000)
      assert.strictEqual(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, privScript)
      assert.strictEqual(txout.value, 1000)
    })

    it('accepts a ScriptPubKey and value', function () {
      var vout = txb.addOutput(privScript, 1000)
      assert.strictEqual(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, privScript)
      assert.strictEqual(txout.value, 1000)
    })

    it('throws if address is of the wrong network', function () {
      assert.throws(function () {
        txb.addOutput('2NGHjvjw83pcVFgMcA7QvSMh2c246rxLVz9', 1000)
      }, /2NGHjvjw83pcVFgMcA7QvSMh2c246rxLVz9 has no matching Script/)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function () {
      txb.addInput(prevTxHash, 0)
      txb.addOutput(privScript, 2000)
      txb.sign(0, keyPair)

      assert.throws(function () {
        txb.addOutput(privScript, 9000)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('sign', function () {
    fixtures.invalid.sign.forEach(function (f) {
      it('throws on ' + f.exception + (f.description ? ' (' + f.description + ')' : ''), function () {
        txb = construct(f, false)

        f.inputs.forEach(function (input, index) {
          input.signs.forEach(function (sign) {
            var keyPair = ECPair.fromWIF(sign.keyPair, NETWORKS[f.network])
            var redeemScript

            if (sign.redeemScript) {
              redeemScript = Script.fromASM(sign.redeemScript)
            }

            if (!sign.throws) {
              txb.sign(index, keyPair, redeemScript, sign.hashType)

            } else {
              assert.throws(function () {
                txb.sign(index, keyPair, redeemScript, sign.hashType)
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
        txb = construct(f)

        var tx = txb.build()
        assert.strictEqual(tx.toHex(), f.txHex)
      })
    })

    fixtures.invalid.build.forEach(function (f) {
      describe('for ' + (f.description || f.exception), function () {
        beforeEach(function () {
          if (f.txHex) {
            var tx = Transaction.fromHex(f.txHex)
            txb = TransactionBuilder.fromTransaction(tx)

          } else {
            txb = construct(f)
          }
        })

        it('throws', function () {
          assert.throws(function () {
            txb.build()
          }, new RegExp(f.exception))
        })

        if (f.alwaysThrows) return
        it("doesn't throw if building incomplete", function () {
          txb.buildIncomplete()
        })
      })
    })
  })

  describe('multisig', function () {
    fixtures.valid.multisig.forEach(function (f) {
      it(f.description, function () {
        txb = construct(f, false)

        var tx
        var network = NETWORKS[f.network]

        f.inputs.forEach(function (input, i) {
          var redeemScript = Script.fromASM(input.redeemScript)

          input.signs.forEach(function (sign) {
            // rebuild the transaction each-time after the first
            if (tx) {
              // do we filter OP_0's beforehand?
              if (sign.filterOP_0) {
                var scriptSig = tx.ins[i].script

                // ignore OP_0 on the front, ignore redeemScript
                var signatures = scriptSig.chunks.slice(1, -1).filter(function (x) { return x !== ops.OP_0 })

                // rebuild/replace the scriptSig without them
                var replacement = scripts.scriptHashInput(scripts.multisigInput(signatures), redeemScript)
                assert.strictEqual(replacement.toASM(), sign.scriptSigFiltered)
                sign.scriptSigFiltered = replacement.toASM()

                tx.ins[i].script = replacement
              }

              // now import it
              txb = TransactionBuilder.fromTransaction(tx, network)
            }

            var keyPair = ECPair.fromWIF(sign.keyPair, network)
            txb.sign(i, keyPair, redeemScript, sign.hashType)

            // update the tx
            tx = txb.buildIncomplete()

            // now verify the serialized scriptSig is as expected
            assert.strictEqual(tx.ins[i].script.toASM(), sign.scriptSig)
          })
        })

        tx = txb.build()
        assert.strictEqual(tx.toHex(), f.txHex)
      })
    })
  })

  describe('multisig edge case', function () {
    it('should handle badly pre-filled OP_0s', function () {
      var lameTx = Transaction.fromHex('0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd16010000483045022100daf0f4f3339d9fbab42b098045c1e4958ee3b308f4ae17be80b63808558d0adb02202f07e3d1f79dc8da285ae0d7f68083d769c11f5621ebd9691d6b48c0d4283d7d014cc952410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253aeffffffff01e8030000000000001976a914aa4d7985c57e011a8b3dd8e0e5a73aaef41629c588ac00000000')
      var network = NETWORKS.testnet

      txb = TransactionBuilder.fromTransaction(lameTx, network)

      var redeemScript = Script.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG')

      var keyPair = ECPair.fromWIF('91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe', network)
      txb.sign(0, keyPair, redeemScript)

      var tx = txb.build()
      assert.equal(tx.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd5e0100483045022100daf0f4f3339d9fbab42b098045c1e4958ee3b308f4ae17be80b63808558d0adb02202f07e3d1f79dc8da285ae0d7f68083d769c11f5621ebd9691d6b48c0d4283d7d01483045022100a346c61738304eac5e7702188764d19cdf68f4466196729db096d6c87ce18cdd022018c0e8ad03054b0e7e235cda6bedecf35881d7aa7d94ff425a8ace7220f38af0014cc952410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253aeffffffff01e8030000000000001976a914aa4d7985c57e011a8b3dd8e0e5a73aaef41629c588ac00000000')
    })
  })
})
