var assert = require('assert')
var networks = require('../src/networks')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var ECKey = require('../src/eckey')
var Transaction = require('../src/transaction')
var Script = require('../src/script')

var fixtureTxes = require('./fixtures/mainnet_tx')
var fixtureTx1Hex = fixtureTxes.prevTx
var fixtureTx2Hex = fixtureTxes.tx
var fixtureTxBigHex = fixtureTxes.bigTx

describe('Transaction', function() {
  describe('toBuffer', function() {
    it('matches the expected output', function() {
      var expected = '010000000189632848f99722915727c5c75da8db2dbf194342a0429828f66ff88fab2af7d600000000fd1b0100483045022100e5be20d440b2bbbc886161f9095fa6d0bca749a4e41d30064f30eb97adc7a1f5022061af132890d8e4e90fedff5e9365aeeb77021afd8ef1d5c114d575512e9a130a0147304402205054e38e9d7b5c10481b6b4991fde5704cd94d49e344406e3c2ce4d18a43bf8e022051d7ba8479865b53a48bee0cce86e89a25633af5b2918aa276859489e232f51c014c8752410479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b84104c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee51ae168fea63dc339a3c58419466ceaeef7f632653266d0e1236431a950cfe52a52aeffffffff0101000000000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac00000000'

      var actual = Transaction.fromHex(expected).toHex()

      assert.equal(actual, expected)
    })
  })

  describe('fromBuffer', function() {
    var tx, serializedTx
    beforeEach(function() {
      serializedTx = '0100000001344630cbff61fbc362f7e1ff2f11a344c29326e4ee96e787dc0d4e5cc02fd069000000004a493046022100ef89701f460e8660c80808a162bbf2d676f40a331a243592c36d6bd1f81d6bdf022100d29c072f1b18e59caba6e1f0b8cadeb373fd33a25feded746832ec179880c23901ffffffff0100f2052a010000001976a914dd40dedd8f7e37466624c4dacc6362d8e7be23dd88ac00000000'
      tx = Transaction.fromHex(serializedTx)
    })

    it('does not mutate the input buffer', function() {
      var buffer = new Buffer(serializedTx, 'hex')
      Transaction.fromBuffer(buffer)

      assert.equal(buffer.toString('hex'), serializedTx)
    })

    it('decodes version correctly', function() {
      assert.equal(tx.version, 1)
    })

    it('decodes locktime correctly', function() {
      assert.equal(tx.locktime, 0)
    })

    it('decodes inputs correctly', function() {
      assert.equal(tx.ins.length, 1)

      var input = tx.ins[0]
      assert.equal(input.sequence, 4294967295)

      assert.equal(input.index, 0)
      assert.equal(input.hash.toString('hex'), "344630cbff61fbc362f7e1ff2f11a344c29326e4ee96e787dc0d4e5cc02fd069")

      assert.equal(input.script.toHex(), "493046022100ef89701f460e8660c80808a162bbf2d676f40a331a243592c36d6bd1f81d6bdf022100d29c072f1b18e59caba6e1f0b8cadeb373fd33a25feded746832ec179880c23901")
    })

    it('decodes outputs correctly', function() {
      assert.equal(tx.outs.length, 1)

      var output = tx.outs[0]

      assert.equal(output.value, 5000000000)
      assert.deepEqual(output.script, Address.fromBase58Check('n1gqLjZbRH1biT5o4qiVMiNig8wcCPQeB9').toOutputScript())
    })

    it('decodes large inputs correctly', function() {
      // transaction has only 1 input
      var tx = new Transaction()
      tx.addInput("0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57", 0)
      tx.addOutput("15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3", 100)

      var buffer = tx.toBuffer()

      // we're going to replace the 8bit VarInt for tx.ins.length with a stretched 32bit equivalent
      var mutated = Buffer.concat([
        buffer.slice(0, 4),
        new Buffer([254, 1, 0, 0, 0]),
        buffer.slice(5)
      ])

      // the deserialized-serialized transaction should return to its non-mutated state (== tx)
      var buffer2 = Transaction.fromBuffer(mutated).toBuffer()
      assert.deepEqual(buffer, buffer2)
    })
  })

  describe('creating a transaction', function() {
    var tx, prevTx
    beforeEach(function() {
      prevTx = Transaction.fromHex(fixtureTx1Hex)
      tx = new Transaction()
    })

    describe('addInput', function() {
      it('accepts a transaction hash', function() {
        var prevTxHash = prevTx.getId()

        tx.addInput(prevTxHash, 0)
        verifyTransactionIn()
      })

      it('accepts a Transaction object', function() {
        tx.addInput(prevTx, 0)
        verifyTransactionIn()
      })

      it('returns an index', function() {
        assert.equal(tx.addInput(prevTx, 0), 0)
        assert.equal(tx.addInput(prevTx, 0), 1)
      })

      function verifyTransactionIn() {
        assert.equal(tx.ins.length, 1)

        var input = tx.ins[0]
        assert.equal(input.sequence, 4294967295)

        assert.equal(input.index, 0)
        assert.equal(input.hash.toString('hex'), "576bc3c3285dbdccd8c3cbd8c03e10d7f77a5c839c744f34c3eb00511059b80c")

        assert.equal(input.script, Script.EMPTY)
      }
    })

    describe('addOutput', function() {
      it('accepts an address string', function() {
        var dest = '15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3'

        tx.addOutput(dest, 40000)
        verifyTransactionOut()
      })

      it('accepts an Address', function() {
        var dest = Address.fromBase58Check('15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3')

        tx.addOutput(dest, 40000)
        verifyTransactionOut()
      })

      it('accepts a scriptPubKey', function() {
        var dest = Address.fromBase58Check('15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3').toOutputScript()

        tx.addOutput(dest, 40000)
        verifyTransactionOut()
      })

      it('returns an index', function() {
        var dest = '15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3'

        assert.equal(tx.addOutput(dest, 40000), 0)
        assert.equal(tx.addOutput(dest, 40000), 1)
      })

      function verifyTransactionOut() {
        assert.equal(tx.outs.length, 1)

        var output = tx.outs[0]
        assert.equal(output.value, 40000)
        assert.equal(output.script.toHex(), "76a9143443bc45c560866cfeabf1d52f50a6ed358c69f288ac")
      }
    })

    describe('sign', function() {
      it('works', function() {
        tx.addInput("0cb859105100ebc3344f749c835c7af7d7103ec0d8cbc3d8ccbd5d28c3c36b57", 0)
        tx.addOutput("15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3", 40000)
        tx.addOutput("1Bu3bhwRmevHLAy1JrRB6AfcxfgDG2vXRd", 50000)

        var key = ECKey.fromWIF('L44f7zxJ5Zw4EK9HZtyAnzCYz2vcZ5wiJf9AuwhJakiV4xVkxBeb')
        tx.sign(0, key)

        var script = prevTx.outs[0].script
        var sig = new Buffer(tx.ins[0].script.chunks[0])

        assert.equal(tx.validateInput(0, script, key.pub, sig), true)
      })
    })

    describe('validateInput', function() {
      var validTx

      beforeEach(function() {
        validTx = Transaction.fromHex(fixtureTx2Hex)
      })

      it('returns true for valid signature', function() {
        var key = ECKey.fromWIF('L44f7zxJ5Zw4EK9HZtyAnzCYz2vcZ5wiJf9AuwhJakiV4xVkxBeb')
        var script = prevTx.outs[0].script
        var sig = new Buffer(validTx.ins[0].script.chunks[0])

        assert.equal(validTx.validateInput(0, script, key.pub, sig), true)
      })
    })
  })

  describe('signInput', function() {
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

  describe('getId', function() {
    it('returns the expected txid', function() {
      var tx = new Transaction()
      tx.addInput('d6f72aab8ff86ff6289842a0424319bf2ddba85dc7c52757912297f948286389', 0)
      tx.addOutput('mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', 1)

      assert.equal(tx.getId(), '7c3275f1212fd1a2add614f47a1f1f7b6d9570a97cb88e0e2664ab1752976e9f')
    })
  })

  describe('clone', function() {
    it('creates a new object', function() {
      var txA = new Transaction()
      txA.addInput('d6f72aab8ff86ff6289842a0424319bf2ddba85dc7c52757912297f948286389', 0)
      txA.addOutput('mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', 1000)

      var txB = txA.clone()

      // Enforce value equality
      assert.deepEqual(txA, txB)

      // Enforce reference inequality
      assert.notEqual(txA.ins[0], txB.ins[0])
      assert.notEqual(txA.outs[0], txB.outs[0])
    })
  })
})

