/* global describe, it, beforeEach */

var assert = require('assert')

var Address = require('../src/address')
var BigInteger = require('bigi')
var bitcoin = require('../src')
var ECKey = require('../src/eckey')
var Script = require('../src/script')
var Transaction = require('../src/transaction')
var TransactionBuilder = require('../src/transaction_builder')

var fixtures = require('./fixtures/transaction_builder')

function construct (txb, f, sign) {
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
        var privKey = ECKey.fromWIF(sign.privKey)
        var redeemScript

        if (sign.redeemScript) {
          redeemScript = Script.fromASM(sign.redeemScript)
        }

        txb.sign(index, privKey, redeemScript, sign.hashType)
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
}

describe('TransactionBuilder', function () {
  var privAddress, privScript
  var prevTx, prevTxHash
  var privKey
  var txb

  beforeEach(function () {
    txb = new TransactionBuilder()

    prevTx = new Transaction()
    prevTx.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 0)
    prevTx.addOutput('1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP', 1)
    prevTxHash = prevTx.getHash()

    privKey = new ECKey(BigInteger.ONE, false)
    privAddress = privKey.pub.getAddress()
    privScript = privAddress.toOutputScript()
  })

  describe('addInput', function () {
    it('accepts a txHash, index [and sequence number]', function () {
      var vin = txb.addInput(prevTxHash, 1, 54)
      assert.equal(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.equal(txIn.hash, prevTxHash)
      assert.equal(txIn.index, 1)
      assert.equal(txIn.sequence, 54)
      assert.equal(txb.inputs[0].prevOutScript, undefined)
    })

    it('accepts a txHash, index [, sequence number and scriptPubKey]', function () {
      var vin = txb.addInput(prevTxHash, 1, 54, prevTx.outs[1].script)
      assert.equal(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.equal(txIn.hash, prevTxHash)
      assert.equal(txIn.index, 1)
      assert.equal(txIn.sequence, 54)
      assert.equal(txb.inputs[0].prevOutScript, prevTx.outs[1].script)
    })

    it('accepts a prevTx, index [and sequence number]', function () {
      var vin = txb.addInput(prevTx, 1, 54)
      assert.equal(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.deepEqual(txIn.hash, prevTxHash)
      assert.equal(txIn.index, 1)
      assert.equal(txIn.sequence, 54)
      assert.equal(txb.inputs[0].prevOutScript, prevTx.outs[1].script)
    })

    it('returns the input index', function () {
      assert.equal(txb.addInput(prevTxHash, 0), 0)
      assert.equal(txb.addInput(prevTxHash, 1), 1)
    })

    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function () {
      txb.addInput(prevTxHash, 0)
      txb.sign(0, privKey)

      assert.throws(function () {
        txb.addInput(prevTxHash, 0)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('addOutput', function () {
    it('throws if SIGHASH_ALL has been used to sign any existing scriptSigs', function () {
      txb.addInput(prevTxHash, 0)
      txb.addOutput(privScript, 2000)
      txb.sign(0, privKey)

      assert.throws(function () {
        txb.addOutput(privScript, 9000)
      }, /No, this would invalidate signatures/)
    })
  })

  describe('sign', function () {
    fixtures.invalid.sign.forEach(function (f) {
      it('throws on ' + f.exception + ' (' + f.description + ')', function () {
        construct(txb, f, false)

        f.inputs.forEach(function (input, index) {
          input.signs.forEach(function (sign) {
            var privKey = ECKey.fromWIF(sign.privKey)
            var redeemScript

            if (sign.redeemScript) {
              redeemScript = Script.fromASM(sign.redeemScript)
            }

            if (!sign.throws) {
              txb.sign(index, privKey, redeemScript, sign.hashType)
            } else {
              assert.throws(function () {
                txb.sign(index, privKey, redeemScript, sign.hashType)
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
        construct(txb, f)

        var tx = txb.build()
        assert.equal(tx.toHex(), f.txHex)
      })
    })

    fixtures.invalid.build.forEach(function (f) {
      describe('for ' + (f.description || f.exception), function () {
        beforeEach(function () {
          if (f.txHex) {
            var tx = Transaction.fromHex(f.txHex)
            txb = TransactionBuilder.fromTransaction(tx)
          } else {
            construct(txb, f)
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
        var signs = 0
        f.inputs.forEach(function (input) {
          txb.addInput(input.txId, input.vout)
          signs = Math.max(signs, input.signs.length)
        })

        f.outputs.forEach(function (output) {
          txb.addOutput(Script.fromASM(output.script), output.value)
        })

        f.inputs.forEach(function (input) {
          var redeemScript = bitcoin.scripts.multisigOutput(input.n, input.pubKeys.map(bitcoin.ECPubKey.fromHex))
          assert.equal(redeemScript.toASM(), input.redeemScript)
        })

        var tx

        for (var i = 0; i < signs; i++) {
          if (tx) {
            txb = TransactionBuilder.fromTransaction(tx)
          }

          f.inputs.forEach(function (input, index) {
            var privKey = bitcoin.ECKey.fromWIF(input.signs[i].privKey)
            var redeemScript = bitcoin.Script.fromASM(input.redeemScript)
            txb.sign(index, privKey, redeemScript)
          })

          tx = txb.buildIncomplete()

          f.inputs.forEach(function (input, index) {
            assert(bitcoin.scripts.isCanonicalSignature(tx.ins[index].script.chunks[input.signs[i].pubKeyIndex + 1]))
            assert(tx.ins[index].script.chunks.slice(1, -1).every(function (chunk) {
              return chunk === bitcoin.opcodes.OP_0 || bitcoin.scripts.isCanonicalSignature(chunk)
            }))
          })

          // manually mess up the signatures
          f.inputs.forEach(function (input, index) {
            // remove all OP_0s
            if (input.signs[i].removeOp0s) {
              tx.ins[index].script.chunks = tx.ins[index].script.chunks.filter(function (chunk) {
                return chunk !== bitcoin.opcodes.OP_0
              })

              // we removed one OP_0 too many, gotta add it back
              tx.ins[index].script.chunks.unshift(bitcoin.opcodes.OP_0)
            }
          })
        }

        assert.equal(tx.toHex(), f.txHexIncomplete, 'txHexIncomplete')

        tx = txb.build()
        assert.equal(tx.toHex(), f.txHexComplete, 'txHexComplete')
      })
    })
  })

  describe('fromTransaction', function () {
    fixtures.valid.build.forEach(function (f) {
      it('builds the correct TransactionBuilder for ' + f.description, function () {
        var tx = Transaction.fromHex(f.txHex)
        var txb = TransactionBuilder.fromTransaction(tx)

        assert.equal(txb.build().toHex(), f.txHex)
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
})
