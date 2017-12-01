/* global describe, it, beforeEach */

var assert = require('assert')
var baddress = require('../src/address')
var bscript = require('../src/script')
var btemplates = require('../src/templates')
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

  var stages = f.stages && f.stages.concat()
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

      if (sign.stage) {
        var tx = txb.buildIncomplete()
        assert.strictEqual(tx.toHex(), stages.shift())
        txb = TransactionBuilder.fromTransaction(tx, network)
      }
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
  var txHash = Buffer.from('0e7cea811c0be9f73c0aca591034396e7264473fc25c1ca45195d7417b36cbe2', 'hex')

  describe('fromTransaction', function () {
    fixtures.valid.build.forEach(function (f) {
      it('returns TransactionBuilder, with ' + f.description, function () {
        var network = NETWORKS[f.network || 'bitcoin']

        var tx = Transaction.fromHex(f.txHex)
        var txb = TransactionBuilder.fromTransaction(tx, network)
        var txAfter = f.incomplete ? txb.buildIncomplete() : txb.build()

        assert.strictEqual(txAfter.toHex(), f.txHex)
        assert.strictEqual(txb.network, network)
      })
    })

    fixtures.valid.fromTransaction.forEach(function (f) {
      it('returns TransactionBuilder, with ' + f.description, function () {
        var tx = new Transaction()

        f.inputs.forEach(function (input) {
          var txHash2 = Buffer.from(input.txId, 'hex').reverse()

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

    it('correctly classifies transaction inputs', function () {
      var tx = Transaction.fromHex(fixtures.valid.classification.hex)
      var txb = TransactionBuilder.fromTransaction(tx)
      txb.inputs.forEach(function (i) {
        assert.strictEqual(i.prevOutType, 'scripthash')
        assert.strictEqual(i.redeemScriptType, 'multisig')
        assert.strictEqual(i.signType, 'multisig')
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
    it('supports the alternative abstract interface { publicKey, sign }', function () {
      var keyPair = {
        publicKey: Buffer.alloc(33, 0x03),
        sign: function (hash) { return Buffer.alloc(64) }
      }

      var txb = new TransactionBuilder()
      txb.addInput('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 1)
      txb.addOutput('1111111111111111111114oLvT2', 100000)
      txb.sign(0, keyPair)
      assert.equal(txb.build().toHex(), '0100000001ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff010000002c0930060201000201000121030303030303030303030303030303030303030303030303030303030303030303ffffffff01a0860100000000001976a914000000000000000000000000000000000000000088ac00000000')
    })

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
        var tx = f.incomplete ? txb.buildIncomplete() : txb.build()

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
          it('throws if ' + f.exception, function () {
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

    it('for incomplete with 0 signatures', function () {
      var randomTxData = '0100000000010100010000000000000000000000000000000000000000000000000000000000000000000000ffffffff01e8030000000000001976a9144c9c3dfac4207d5d8cb89df5722cb3d712385e3f88ac02483045022100aa5d8aa40a90f23ce2c3d11bc845ca4a12acd99cbea37de6b9f6d86edebba8cb022022dedc2aa0a255f74d04c0b76ece2d7c691f9dd11a64a8ac49f62a99c3a05f9d01232103596d3451025c19dbbdeb932d6bf8bfb4ad499b95b6f88db8899efac102e5fc71ac00000000'
      var randomAddress = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'

      var randomTx = Transaction.fromHex(randomTxData)
      var tx = new TransactionBuilder()
      tx.addInput(randomTx, 0)
      tx.addOutput(randomAddress, 1000)
      tx = tx.buildIncomplete()
      assert(tx)
    })

    it('for incomplete P2SH with 0 signatures', function () {
      var inp = Buffer.from('010000000173120703f67318aef51f7251272a6816d3f7523bb25e34b136d80be959391c100000000000ffffffff0100c817a80400000017a91471a8ec07ff69c6c4fee489184c462a9b1b9237488700000000', 'hex') // arbitrary P2SH input
      var inpTx = Transaction.fromBuffer(inp)

      var txb = new TransactionBuilder(NETWORKS.testnet)
      txb.addInput(inpTx, 0)
      txb.addOutput('2NAkqp5xffoomp5RLBcakuGpZ12GU4twdz4', 1e8) // arbitrary output

      txb.buildIncomplete()
    })

    it('for incomplete P2WPKH with 0 signatures', function () {
      var inp = Buffer.from('010000000173120703f67318aef51f7251272a6816d3f7523bb25e34b136d80be959391c100000000000ffffffff0100c817a8040000001600141a15805e1f4040c9f68ccc887fca2e63547d794b00000000', 'hex')
      var inpTx = Transaction.fromBuffer(inp)

      var txb = new TransactionBuilder(NETWORKS.testnet)
      txb.addInput(inpTx, 0)
      txb.addOutput('2NAkqp5xffoomp5RLBcakuGpZ12GU4twdz4', 1e8) // arbitrary output

      txb.buildIncomplete()
    })

    it('for incomplete P2WSH with 0 signatures', function () {
      var inpTx = Transaction.fromBuffer(Buffer.from('010000000173120703f67318aef51f7251272a6816d3f7523bb25e34b136d80be959391c100000000000ffffffff0100c817a80400000022002072df76fcc0b231b94bdf7d8c25d7eef4716597818d211e19ade7813bff7a250200000000', 'hex'))

      var txb = new TransactionBuilder(NETWORKS.testnet)
      txb.addInput(inpTx, 0)
      txb.addOutput('2NAkqp5xffoomp5RLBcakuGpZ12GU4twdz4', 1e8) // arbitrary output

      txb.buildIncomplete()
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
                var replacement = btemplates.scriptHash.input.encode(btemplates.multisig.input.encode(signatures), redeemScript)
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

  describe('various edge case', function () {
    var network = NETWORKS.testnet

    it('should warn of high fee for segwit transaction based on VSize, not Size', function () {
      var rawtx = '01000000000104fdaac89627208b4733484ca56bc291f4cf4fa8d7c5f29893c52b46788a0a' +
      '1df90000000000fffffffffdaac89627208b4733484ca56bc291f4cf4fa8d7c5f29893c52b46788a0a1df9' +
      '0100000000ffffffffa2ef7aaab316a3e5b5b0a78d1d35c774b95a079f9f0c762277a49caf1f26bca40000' +
      '000000ffffffffa2ef7aaab316a3e5b5b0a78d1d35c774b95a079f9f0c762277a49caf1f26bca401000000' +
      '00ffffffff0100040000000000001976a914cf307285359ab7ef6a2daa0522c7908ddf5fe7a988ac024730' +
      '440220113324438816338406841775e079b04c50d04f241da652a4035b1017ea1ecf5502205802191eb49c' +
      '54bf2a5667aea72e51c3ca92085efc60f12d1ebda3a64aff343201210283409659355b6d1cc3c32decd5d5' +
      '61abaac86c37a353b52895a5e6c196d6f44802483045022100dc2892874e6d8708e3f5a058c5c9263cdf03' +
      '969492270f89ee4933caf6daf8bb0220391dfe61a002709b63b9d64422d3db09b727839d1287e10a128a5d' +
      'b52a82309301210283409659355b6d1cc3c32decd5d561abaac86c37a353b52895a5e6c196d6f448024830' +
      '450221009e3ed3a6ae93a018f443257b43e47b55cf7f7f3547d8807178072234686b22160220576121cfe6' +
      '77c7eddf5575ea0a7c926247df6eca723c4f85df306e8bc08ea2df01210283409659355b6d1cc3c32decd5' +
      'd561abaac86c37a353b52895a5e6c196d6f44802473044022007be81ffd4297441ab10e740fc9bab9545a2' +
      '194a565cd6aa4cc38b8eaffa343402201c5b4b61d73fa38e49c1ee68cc0e6dfd2f5dae453dd86eb142e87a' +
      '0bafb1bc8401210283409659355b6d1cc3c32decd5d561abaac86c37a353b52895a5e6c196d6f44800000000'
      var txb = TransactionBuilder.fromTransaction(Transaction.fromHex(rawtx))
      txb.inputs[0].value = 241530
      txb.inputs[1].value = 241530
      txb.inputs[2].value = 248920
      txb.inputs[3].value = 248920

      assert.throws(function () {
        txb.build()
      }, new RegExp('Transaction has absurd fees'))
    })

    it('should classify witness inputs with witness = true during multisigning', function () {
      var keyPair = ECPair.fromWIF('cRAwuVuVSBZMPu7hdrYvMCZ8eevzmkExjFbaBLhqnDdrezxN3nTS', network)
      var witnessScript = Buffer.from('522102bbbd6eb01efcbe4bd9664b886f26f69de5afcb2e479d72596c8bf21929e352e22102d9c3f7180ef13ec5267723c9c2ffab56a4215241f837502ea8977c8532b9ea1952ae', 'hex')
      var redeemScript = Buffer.from('002024376a0a9abab599d0e028248d48ebe817bc899efcffa1cd2984d67289daf5af', 'hex')
      var scriptPubKey = Buffer.from('a914b64f1a3eacc1c8515592a6f10457e8ff90e4db6a87', 'hex')
      var txb = new TransactionBuilder(network)
      txb.addInput('a4696c4b0cd27ec2e173ab1fa7d1cc639a98ee237cec95a77ca7ff4145791529', 1, 0xffffffff, scriptPubKey)
      txb.addOutput(scriptPubKey, 99000)
      txb.sign(0, keyPair, redeemScript, null, 100000, witnessScript)
      // 2-of-2 signed only once
      var tx = txb.buildIncomplete()
      // Only input is segwit, so txid should be accurate with the final tx
      assert.equal(tx.getId(), 'f15d0a65b21b4471405b21a099f8b18e1ae4d46d55efbd0f4766cf11ad6cb821')
      var txHex = tx.toHex()
      var newTxb = TransactionBuilder.fromTransaction(Transaction.fromHex(txHex))
      // input should have the key 'witness' set to true
      assert.equal(newTxb.inputs[0].witness, true)
    })

    it('should handle badly pre-filled OP_0s', function () {
      // OP_0 is used where a signature is missing
      var redeemScripSig = bscript.fromASM('OP_0 OP_0 3045022100daf0f4f3339d9fbab42b098045c1e4958ee3b308f4ae17be80b63808558d0adb02202f07e3d1f79dc8da285ae0d7f68083d769c11f5621ebd9691d6b48c0d4283d7d01 52410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253ae')
      var redeemScript = bscript.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG')

      var tx = new Transaction()
      tx.addInput(Buffer.from('cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f07149', 'hex'), 0, undefined, redeemScripSig)
      tx.addOutput(Buffer.from('76a914aa4d7985c57e011a8b3dd8e0e5a73aaef41629c588ac', 'hex'), 1000)

      // now import the Transaction
      var txb = TransactionBuilder.fromTransaction(tx, NETWORKS.testnet)

      var keyPair2 = ECPair.fromWIF('91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe', network)
      txb.sign(0, keyPair2, redeemScript)

      var tx2 = txb.build()
      assert.equal(tx2.getId(), 'eab59618a564e361adef6d918bd792903c3d41bcf1220137364fb847880467f9')
      assert.equal(bscript.toASM(tx2.ins[0].script), 'OP_0 3045022100daf0f4f3339d9fbab42b098045c1e4958ee3b308f4ae17be80b63808558d0adb02202f07e3d1f79dc8da285ae0d7f68083d769c11f5621ebd9691d6b48c0d4283d7d01 3045022100a346c61738304eac5e7702188764d19cdf68f4466196729db096d6c87ce18cdd022018c0e8ad03054b0e7e235cda6bedecf35881d7aa7d94ff425a8ace7220f38af001 52410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253ae')
    })

    it('should not classify blank scripts as nonstandard', function () {
      var tx = new TransactionBuilder()
      tx.addInput('aa94ab02c182214f090e99a0d57021caffd0f195a81c24602b1028b130b63e31', 0)

      var incomplete = tx.buildIncomplete().toHex()
      var keyPair = ECPair.fromWIF('L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy')

      // sign, as expected
      tx.addOutput('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 15000)
      tx.sign(0, keyPair)
      var txId = tx.build().getId()
      assert.equal(txId, '54f097315acbaedb92a95455da3368eb45981cdae5ffbc387a9afc872c0f29b3')

      // and, repeat
      tx = TransactionBuilder.fromTransaction(Transaction.fromHex(incomplete))
      tx.addOutput('1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK', 15000)
      tx.sign(0, keyPair)
      var txId2 = tx.build().getId()
      assert.equal(txId, txId2)
    })
  })
})
