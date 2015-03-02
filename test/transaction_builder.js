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
    prevTx.addOutput(Address.fromBase58Check('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH').toOutputScript(), 0)
    prevTx.addOutput(Address.fromBase58Check('1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP').toOutputScript(), 1)
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
    it('accepts an address string and value', function () {
      var vout = txb.addOutput(privAddress.toBase58Check(), 1000)
      assert.equal(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, privScript)
      assert.equal(txout.value, 1000)
    })

    it('accepts an Address object and value', function () {
      var vout = txb.addOutput(privAddress, 1000)
      assert.equal(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, privScript)
      assert.equal(txout.value, 1000)
    })

    it('accepts a ScriptPubKey and value', function () {
      var vout = txb.addOutput(privScript, 1000)
      assert.equal(vout, 0)

      var txout = txb.tx.outs[0]
      assert.deepEqual(txout.script, privScript)
      assert.equal(txout.value, 1000)
    })

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

    it('works for the out-of-order P2SH multisig case', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx'
      ].map(ECKey.fromWIF)
      var redeemScript = Script.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a OP_2 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
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

    /*
     * test if it can also sign out-of-order P2SH multisig where there are no OP_0 in place of the signature
     *  since a lot of other libraries don't follow the adding op OP_0
     */
    it('works for the out-of-order P2SH multisig with OP_0', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx'
      ].map(ECKey.fromWIF)
      var redeemScript = Script.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a OP_2 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[0], redeemScript)

      var tx = txb.buildIncomplete()

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      // mess up the order of the signatures and add an OP_0
      txb2.inputs[0].signatures = [bitcoin.opcodes.OP_0, txb2.inputs[0].signatures[0]]

      txb2.sign(0, privKeys[1], redeemScript)

      var tx2 = txb2.build()

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd1c01004830450221009c92c1ae1767ac04e424da7f6db045d979b08cde86b1ddba48621d59a109d818022004f5bb21ad72255177270abaeb2d7940ac18f1e5ca1f53db4f3fd1045647a8a8014830450221009418caa5bc18da87b188a180125c0cf06dce6092f75b2d3c01a29493466800fd02206ead65e7ca6e0f17eefe6f78457c084eab59af7c9882be1437de2e7116358eb9014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })

    /*
     * test if it can also sign out-of-order P2SH multisig where there are no OP_0 in place of the signature
     *  since a lot of other libraries don't follow the adding op OP_0
     */
    it('works for in-order P2SH 2of3 multisig', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe'
      ].map(ECKey.fromWIF)

      var redeemScript = bitcoin.scripts.multisigOutput(2, privKeys.map(function(privKey) { return privKey.pub }))

      assert.equal(redeemScript.toASM(), 'OP_2 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG');

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[0], redeemScript)

      var tx = txb.buildIncomplete()

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      txb2.sign(0, privKeys[1], redeemScript)

      var tx2 = txb2.build()

      assert(tx2.ins[0].script.chunks.slice(1, -1).every(function(signature) {
        return bitcoin.scripts.isCanonicalSignature(signature);
      }));

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd5d01004730440220345b5ec8451d2fd904d3e67411eaf43f540b9d87ed279a9e447602f5f15897f00220701678df40957a978dd9e3b20009ac4cb97ef73e931efe655629f55a6cfbec2f01483045022100def7a0f4849acaea79a0d6213591b484e10d91829cb63c07b7a7ef5c871e4edd022039830420e4e36256201057807f90c950836a0f93c3465a9a8d2660ba738f726d014cc9524104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })

    /*
     * test if it can also sign out-of-order P2SH multisig where there are no OP_0 in place of the signature
     *  since a lot of other libraries don't follow the adding op OP_0
     */
    it('works for out-of-order P2SH 2of3 multisig', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe'
      ].map(ECKey.fromWIF)

      var redeemScript = bitcoin.scripts.multisigOutput(2, privKeys.map(function(privKey) { return privKey.pub }))

      assert.equal(redeemScript.toASM(), 'OP_2 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG');

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[0], redeemScript)

      var tx = txb.buildIncomplete()

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      // sign with the THIRD key
      txb2.sign(0, privKeys[2], redeemScript)

      var tx2 = txb2.build()

      assert(tx2.ins[0].script.chunks.slice(1, -1).every(function(signature) {
        return bitcoin.scripts.isCanonicalSignature(signature);
      }));

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd5d01004730440220345b5ec8451d2fd904d3e67411eaf43f540b9d87ed279a9e447602f5f15897f00220701678df40957a978dd9e3b20009ac4cb97ef73e931efe655629f55a6cfbec2f014830450221009717e0d01216deaab7ee4caf3bdf8dedbd67f8329fe2c65381d07284393b6d2302201b34241c632cdfeb71bdc142b6d7fc1302a01da14bccccd03e123427c7ba00fc014cc9524104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })
  })
})
