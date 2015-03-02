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

    it('works for in-order P2SH 2of2 multisig', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT'
      ].map(ECKey.fromWIF)
      var redeemScript = Script.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a OP_2 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[0], redeemScript)

      var tx = txb.buildIncomplete()

      assert(bitcoin.scripts.isCanonicalSignature(tx.ins[0].script.chunks[1]))
      assert.equal(tx.ins[0].script.chunks[2], bitcoin.opcodes.OP_0)

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      // [you should] verify that Transaction is what you want...
      // ... then sign it
      txb2.sign(0, privKeys[1], redeemScript)
      var tx2 = txb2.build()

      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[1]))
      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[2]))

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd1c01004830450221009c92c1ae1767ac04e424da7f6db045d979b08cde86b1ddba48621d59a109d818022004f5bb21ad72255177270abaeb2d7940ac18f1e5ca1f53db4f3fd1045647a8a8014830450221009418caa5bc18da87b188a180125c0cf06dce6092f75b2d3c01a29493466800fd02206ead65e7ca6e0f17eefe6f78457c084eab59af7c9882be1437de2e7116358eb9014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })

    it('works for out-of-order P2SH 2of2 multisig', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT'
      ].map(ECKey.fromWIF)
      var redeemScript = Script.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a OP_2 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[1], redeemScript)

      var tx = txb.buildIncomplete()

      assert.equal(tx.ins[0].script.chunks[1], bitcoin.opcodes.OP_0)
      assert(bitcoin.scripts.isCanonicalSignature(tx.ins[0].script.chunks[2]))

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      // [you should] verify that Transaction is what you want...
      // ... then sign it
      txb2.sign(0, privKeys[0], redeemScript)
      var tx2 = txb2.build()

      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[1]))
      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[2]))

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd1c01004830450221009c92c1ae1767ac04e424da7f6db045d979b08cde86b1ddba48621d59a109d818022004f5bb21ad72255177270abaeb2d7940ac18f1e5ca1f53db4f3fd1045647a8a8014830450221009418caa5bc18da87b188a180125c0cf06dce6092f75b2d3c01a29493466800fd02206ead65e7ca6e0f17eefe6f78457c084eab59af7c9882be1437de2e7116358eb9014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })

    it('can fix signature order for messed up P2SH 2of2 multisig', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT'
      ].map(ECKey.fromWIF)
      var redeemScript = Script.fromASM('OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a OP_2 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[0], redeemScript)

      var tx = txb.buildIncomplete()

      assert(bitcoin.scripts.isCanonicalSignature(tx.ins[0].script.chunks[1]))
      assert.equal(tx.ins[0].script.chunks[2], bitcoin.opcodes.OP_0)

      // 'manually' messing up the order
      tx.ins[0].script.chunks.splice(1, 2,
        tx.ins[0].script.chunks[2],
        tx.ins[0].script.chunks[1]
      )

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      // without forcing fixSignatureOrder it should fail
      assert.throws(function () {
        txb2.sign(0, privKeys[1], redeemScript)
      })

      // with forcing fixSignatureOrder it should succeed
      txb2.sign(0, privKeys[1], redeemScript, null, true)
      var tx2 = txb2.build()

      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[1]))
      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[2]))

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd1c01004830450221009c92c1ae1767ac04e424da7f6db045d979b08cde86b1ddba48621d59a109d818022004f5bb21ad72255177270abaeb2d7940ac18f1e5ca1f53db4f3fd1045647a8a8014830450221009418caa5bc18da87b188a180125c0cf06dce6092f75b2d3c01a29493466800fd02206ead65e7ca6e0f17eefe6f78457c084eab59af7c9882be1437de2e7116358eb9014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })

    it('works for in-order P2SH 2of3 multisig', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe'
      ].map(ECKey.fromWIF)

      var redeemScript = bitcoin.scripts.multisigOutput(2, privKeys.map(function (privKey) { return privKey.pub }))

      assert.equal(redeemScript.toASM(), 'OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[0], redeemScript)

      var tx = txb.buildIncomplete()

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      txb2.sign(0, privKeys[1], redeemScript)

      var tx2 = txb2.buildIncomplete()

      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[1]))
      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[2]))
      assert.equal(tx2.ins[0].script.chunks[3], bitcoin.opcodes.OP_0)

      var tx3 = txb2.build()

      assert(tx3.ins[0].script.chunks.slice(1, -1).every(function (signature) {
        return bitcoin.scripts.isCanonicalSignature(signature)
      }))

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd5e0100483045022100b160c1556add6314f106b23bdc539630797ace9c7a574b51bb80e46891cda5e9022077e95273a509f5dd83dad1fa6736ca1e2b87272b53c2323b6dc65297eb8ea798014730440221008aa2f7357350a5e13a619f32bfadb0b3d2f9fc23dd18c089e88c2c789c91a710021f65f6704372438b82ef31e1251e905626a65fee320196d9aa4da5f790ea93a301004cc952410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })

    it('works for gapped, out-of-order P2SH 2of3 multisig', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe'
      ].map(ECKey.fromWIF)

      var redeemScript = bitcoin.scripts.multisigOutput(2, privKeys.map(function (privKey) { return privKey.pub }))

      assert.equal(redeemScript.toASM(), 'OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[2], redeemScript)

      var tx = txb.buildIncomplete()

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      txb2.sign(0, privKeys[0], redeemScript)

      var tx2 = txb2.buildIncomplete()

      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[1]))
      assert.equal(tx2.ins[0].script.chunks[2], bitcoin.opcodes.OP_0)
      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[3]))

      var tx3 = txb2.build()

      assert(tx3.ins[0].script.chunks.slice(1, -1).every(function (signature) {
        return bitcoin.scripts.isCanonicalSignature(signature)
      }))

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd5f0100483045022100b160c1556add6314f106b23bdc539630797ace9c7a574b51bb80e46891cda5e9022077e95273a509f5dd83dad1fa6736ca1e2b87272b53c2323b6dc65297eb8ea7980100483045022100aa15c49494d2102237bfaa1d5ce1a5475a1d5c10cd42fb62181761575ae20a6802206186bd667c1b5a283d09a1f35da3b6cbc1f2b4d7739626b0c9c92761edea1196014cc952410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })

    it('works for gapped, out-of-order P2SH 2of3 multisig without OP_0', function () {
      var privKeys = [
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgww7vXtT',
        '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgx3cTMqe'
      ].map(ECKey.fromWIF)

      var redeemScript = bitcoin.scripts.multisigOutput(2, privKeys.map(function (privKey) { return privKey.pub }))

      assert.equal(redeemScript.toASM(), 'OP_2 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8 04c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a 04f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672 OP_3 OP_CHECKMULTISIG')

      txb.addInput('4971f016798a167331bcbc67248313fbc444c6e92e4416efd06964425588f5cf', 0)
      txb.addOutput('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 10000)
      txb.sign(0, privKeys[2], redeemScript)

      var tx = txb.buildIncomplete()

      // 'manually' removing the OP_0s to simulate other libraries being the source of the incomplete TX
      tx.ins[0].script.chunks.splice(0, 2)

      // in another galaxy...
      // ... far, far away
      var txb2 = TransactionBuilder.fromTransaction(tx)

      txb2.sign(0, privKeys[0], redeemScript)

      var tx2 = txb2.buildIncomplete()

      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[1]))
      assert.equal(tx2.ins[0].script.chunks[2], bitcoin.opcodes.OP_0)
      assert(bitcoin.scripts.isCanonicalSignature(tx2.ins[0].script.chunks[3]))

      var tx3 = txb2.build()

      assert(tx3.ins[0].script.chunks.slice(1, -1).every(function (signature) {
        return bitcoin.scripts.isCanonicalSignature(signature)
      }))

      assert.equal(tx2.toHex(), '0100000001cff58855426469d0ef16442ee9c644c4fb13832467bcbc3173168a7916f0714900000000fd5f0100483045022100b160c1556add6314f106b23bdc539630797ace9c7a574b51bb80e46891cda5e9022077e95273a509f5dd83dad1fa6736ca1e2b87272b53c2323b6dc65297eb8ea7980100483045022100aa15c49494d2102237bfaa1d5ce1a5475a1d5c10cd42fb62181761575ae20a6802206186bd667c1b5a283d09a1f35da3b6cbc1f2b4d7739626b0c9c92761edea1196014cc952410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a4104f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e67253aeffffffff0110270000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000')
    })
  })
})
