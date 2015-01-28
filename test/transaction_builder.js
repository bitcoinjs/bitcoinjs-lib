var assert = require('assert')
var scripts = require('../src/scripts')

var BigInteger = require('bigi')
var ECKey = require('../src/eckey')
var Script = require('../src/script')
var Transaction = require('../src/transaction')
var TransactionBuilder = require('../src/transaction_builder')

var fixtures = require('./fixtures/transaction_builder')

function construct(txb, f, sign) {
  f.inputs.forEach(function(input) {
    var prevTxScript

    if (input.prevTxScript) {
      prevTxScript = Script.fromASM(input.prevTxScript)
    }

    txb.addInput(input.txId, input.vout, input.sequence, prevTxScript)
  })

  f.outputs.forEach(function(output) {
    var script = Script.fromASM(output.script)

    txb.addOutput(script, output.value)
  })

  if (sign === undefined || sign) {
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
  }

  // FIXME: add support for locktime/version in TransactionBuilder API
  if (f.version !== undefined) txb.tx.version = f.version
  if (f.locktime !== undefined) txb.tx.locktime = f.locktime
}

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

    privKey = new ECKey(BigInteger.ONE, false)
    privAddress = privKey.pub.getAddress()
    privScript = privAddress.toOutputScript()
  })

  describe('addInput', function() {
    it('accepts a txHash, index [and sequence number]', function() {
      var vin = txb.addInput(prevTxHash, 1, 54)
      assert.equal(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.equal(txIn.hash, prevTxHash)
      assert.equal(txIn.index, 1)
      assert.equal(txIn.sequence, 54)
      assert.equal(txb.inputs[0].prevOutScript, undefined)
    })

    it('accepts a txHash, index [, sequence number and scriptPubKey]', function() {
      var vin = txb.addInput(prevTxHash, 1, 54, prevTx.outs[1].script)
      assert.equal(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.equal(txIn.hash, prevTxHash)
      assert.equal(txIn.index, 1)
      assert.equal(txIn.sequence, 54)
      assert.equal(txb.inputs[0].prevOutScript, prevTx.outs[1].script)
    })

    it('accepts a prevTx, index [and sequence number]', function() {
      var vin = txb.addInput(prevTx, 1, 54)
      assert.equal(vin, 0)

      var txIn = txb.tx.ins[0]
      assert.deepEqual(txIn.hash, prevTxHash)
      assert.equal(txIn.index, 1)
      assert.equal(txIn.sequence, 54)
      assert.equal(txb.inputs[0].prevOutScript, prevTx.outs[1].script)
    })

    it('returns the input index', function() {
      assert.equal(txb.addInput(prevTxHash, 0), 0)
      assert.equal(txb.addInput(prevTxHash, 1), 1)
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
      txb.addOutput(privScript, 2000)
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

        assert.equal(txb.inputs[0].scriptType, 'pubkeyhash')
        assert.equal(txb.inputs[0].redeemScript, undefined)
      })
    })

    describe('when redeemScript is defined', function() {
      it('assumes scriptHash', function() {
        txb.addInput(prevTxHash, 0)
        txb.sign(0, privKey, privScript)

        assert.equal(txb.inputs[0].prevOutType, 'scripthash')
        assert.equal(txb.inputs[0].redeemScript, privScript)
      })

      it('throws if hashType is inconsistent', function() {
        var redeemScript = scripts.multisigOutput(1, [privKey.pub])

        txb.addInput(prevTxHash, 0)
        txb.sign(0, privKey, redeemScript, 83)

        assert.throws(function() {
          txb.sign(0, privKey, redeemScript, 82)
        }, /Inconsistent hashType/)
      })

      it('throws if redeemScript is inconsistent', function() {
        var firstScript = scripts.multisigOutput(1, [privKey.pub])
        var otherScript = scripts.multisigOutput(2, [privKey.pub, privKey.pub])

        txb.addInput(prevTxHash, 0)
        txb.sign(0, privKey, firstScript)

        assert.throws(function() {
          txb.sign(0, privKey, otherScript)
        }, /Inconsistent redeemScript/)
      })
    })

    fixtures.invalid.sign.forEach(function(f) {
      it('throws on ' + f.exception + ' (' + f.description + ')', function() {
        construct(txb, f, false)

        f.inputs.forEach(function(input, index) {
          var redeemScript

          if (input.redeemScript) {
            redeemScript = Script.fromASM(input.redeemScript)
          }

          input.privKeys.forEach(function(wif, i) {
            var privKey = ECKey.fromWIF(wif)

            if (input.throws !== i) {
              txb.sign(index, privKey, redeemScript)

            } else {
              assert.throws(function() {
                txb.sign(index, privKey, redeemScript)
              }, new RegExp(f.exception))
            }
          })
        })
      })
    })
  })

  describe('build', function() {
    fixtures.valid.build.forEach(function(f) {
      it('builds \"' + f.description + '\"', function() {
        construct(txb, f)

        var tx = txb.build()
        assert.equal(tx.toHex(), f.txHex)
      })
    })

    fixtures.invalid.build.forEach(function(f) {
      describe('for ' + f.description, function() {
        beforeEach(function() {
          if (f.txHex) {
            var tx = Transaction.fromHex(f.txHex)
            txb = TransactionBuilder.fromTransaction(tx)

          } else {
            construct(txb, f)
          }
        })

        it('throws on ' + f.exception, function() {
          assert.throws(function() {
            txb.build()
          }, new RegExp(f.exception))
        })

        if (f.alwaysThrows) return
        it('doesn\'t throw if building incomplete', function() {
          txb.buildIncomplete()
        })
      })
    })
  })

  describe('fromTransaction', function() {
    fixtures.valid.build.forEach(function(f) {
      it('builds the correct TransactionBuilder for ' + f.description, function() {
        var tx = Transaction.fromHex(f.txHex)
        var txb = TransactionBuilder.fromTransaction(tx)

        assert.equal(txb.build().toHex(), f.txHex)
      })
    })

    fixtures.invalid.fromTransaction.forEach(function(f) {
      it('throws on ' + f.exception, function() {
        var tx = Transaction.fromHex(f.txHex)

        assert.throws(function() {
          TransactionBuilder.fromTransaction(tx)
        }, new RegExp(f.exception))
      })
    })

    it('works for the out-of-order P2SH multisig case', function() {
      var privKeys = [
        "91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT",
        "91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx"
      ].map(ECKey.fromWIF)
      var redeemScript = Script.fromASM("OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a OP_2 OP_CHECKMULTISIG")

      txb.addInput("4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf", 0)
      txb.addOutput("1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH", 10000)
      txb.sign(0, privKeys[0], redeemScript)

      var tx = txb.buildIncomplete()

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      // [you should] verify that Transaction is what you want...
      // ... then sign it
      txb2.sign(0, privKeys[1], redeemScript)
      var tx2 = txb2.build()

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd1c01004830450221009c92c1ae1767ac04e424da7f6db045d979b08cde86b1ddba48621d59a109d818022004f5bb21ad72255177270abaeb2d7940ac18f1e5ca1f53db4f3fd1045647a8a8014830450221009418caa5bc18da87b188a180125c0cf06dce6092f75b2d3c01a29493466800fd02206ead65e7ca6e0f17eefe6f78457c084eab59af7c9882be1437de2e7116358eb9014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })
  })
})
