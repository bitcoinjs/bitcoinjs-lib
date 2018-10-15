const { describe, it, beforeEach } = require('mocha')
const assert = require('assert')
const baddress = require('../src/address')
const bscript = require('../src/script')
const payments = require('../src/payments')

const ECPair = require('../src/ecpair')
const Transaction = require('../src/transaction')
const TransactionBuilder = require('../src/transaction_builder')
const NETWORKS = require('../src/networks')

const fixtures = require('./fixtures/transaction_builder')

function constructSign (f, txb) {
  const network = NETWORKS[f.network]
  const stages = f.stages && f.stages.concat()

  f.inputs.forEach(function (input, index) {
    if (!input.signs) return
    input.signs.forEach(function (sign) {
      const keyPair = ECPair.fromWIF(sign.keyPair, network)
      let redeemScript
      let witnessScript
      let value

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
        const tx = txb.buildIncomplete()
        assert.strictEqual(tx.toHex(), stages.shift())
        txb = TransactionBuilder.fromTransaction(tx, network)
      }
    })
  })

  return txb
}

function construct (f, dontSign) {
  const network = NETWORKS[f.network]
  const txb = new TransactionBuilder(network)

  if (Number.isFinite(f.version)) txb.setVersion(f.version)
  if (f.locktime !== undefined) txb.setLockTime(f.locktime)

  f.inputs.forEach(function (input) {
    let prevTx
    if (input.txRaw) {
      const constructed = construct(input.txRaw)
      if (input.txRaw.incomplete) prevTx = constructed.buildIncomplete()
      else prevTx = constructed.build()
    } else if (input.txHex) {
      prevTx = Transaction.fromHex(input.txHex)
    } else {
      prevTx = input.txId
    }

    let prevTxScript
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
  return constructSign(f, txb)
}

describe('TransactionBuilder', function () {
  // constants
  const keyPair = ECPair.fromPrivateKey(Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'))
  const scripts = [
    '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
    '1cMh228HTCiwS8ZsaakH8A8wze1JR5ZsP'
  ].map(function (x) {
    return baddress.toOutputScript(x)
  })
  const txHash = Buffer.from('0e7cea811c0be9f73c0aca591034396e7264473fc25c1ca45195d7417b36cbe2', 'hex')

  describe('fromTransaction', () => {
    fixtures.valid.build.forEach(f => {
      it('returns TransactionBuilder, with ' + f.description, function () {
        const network = NETWORKS[f.network || 'bitcoin']

        const tx = Transaction.fromHex(f.txHex)
        const txb = TransactionBuilder.fromTransaction(tx, network)
        assert(txb instanceof TransactionBuilder)
      })
    })

    fixtures.valid.fromTransaction.forEach(f => {
      it('returns TransactionBuilder, with ' + f.description, () => {
        const tx = new Transaction()

        f.inputs.forEach(input => {
          const txHash2 = Buffer.from(input.txId, 'hex').reverse()

          tx.addInput(txHash2, input.vout, undefined, bscript.fromASM(input.scriptSig))
        })

        f.outputs.forEach(output => {
          tx.addOutput(bscript.fromASM(output.script), output.value)
        })

        const txb = TransactionBuilder.fromTransaction(tx)

        assert(txb instanceof TransactionBuilder)
      })
    })

    fixtures.valid.fromTransactionSequential.forEach(f => {
      it('returns a TransactionBuilder, with ' + f.description, () => {
        const network = NETWORKS[f.network]
        const tx = Transaction.fromHex(f.txHex)
        const txb = TransactionBuilder.fromTransaction(tx, network)

        assert(txb instanceof TransactionBuilder)
      })
    })
  })

  describe('addInput', () => {
    let txb
    beforeEach(() => {
      txb = new TransactionBuilder()
    })

    it('accepting a txHash, index [and sequence number], it returns an integer', () => {
      const vin = txb.addInput(txHash, 1, 54)
      assert(Number.isInteger(vin))
    })

    it('accepting a txHash, index [, sequence number and scriptPubKey], ' +
      'it returns an integer', () => {
      const vin = txb.addInput(txHash, 1, 54, scripts[1])
      assert(Number.isInteger(vin))
    })

    it('accepting a prevTx, index [and sequence number], it return an integer', () => {
      const prevTx = new Transaction()
      prevTx.addOutput(scripts[0], 0)
      prevTx.addOutput(scripts[1], 1)

      const vin = txb.addInput(prevTx, 1, 54)
      assert(Number.isInteger(vin))
    })
  })

  describe('addOutput', () => {
    let txb
    beforeEach(function () {
      txb = new TransactionBuilder()
    })

    it('accepting an address string and value, it returns an integer', () => {
      const { address } = payments.p2pkh({ pubkey: keyPair.publicKey })
      const vout = txb.addOutput(address, 1000)
      assert(Number.isInteger(vout))
    })

    it('accepting a ScriptPubKey and value, it returns an integer', () => {
      const vout = txb.addOutput(scripts[0], 1000)
      assert(Number.isInteger(vout))
    })
  })

  describe('setLockTime', () => {
    it('returns nothing', () => {
      const txb = new TransactionBuilder()
      txb.addInput(txHash, 0)
      txb.addOutput(scripts[0], 100)

      const res = txb.setLockTime(65535)
      assert(typeof res === 'undefined')
    })
  })

  describe('setVersion', () => {
    it('returns nothing', () => {
      const txb = new TransactionBuilder()
      const res = txb.setVersion(1)
      assert(typeof res === 'undefined')
    })
  })

  describe('sign', () => {
    it('returns nothing', () => {
      const keyPair = {
        publicKey: ECPair.makeRandom({ rng: function () { return Buffer.alloc(32, 1) } }).publicKey,
        sign: function (hash) { return Buffer.alloc(64, 0x5f) }
      }

      const txb = new TransactionBuilder()
      txb.setVersion(1)
      txb.addInput('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 1)
      txb.addOutput('1111111111111111111114oLvT2', 100000)
      const res = txb.sign(0, keyPair)
      assert(typeof res === 'undefined')
    })
  })

  describe('build', () => {
    fixtures.valid.build.forEach(f => {
      it('builds "' + f.description + '", returning a Transaction', () => {
        const txb = construct(f)
        const tx = f.incomplete ? txb.buildIncomplete() : txb.build()

        assert(tx instanceof Transaction)
      })
    })

    it('builds incompletely with 0 signatures, returning an Transaction', () => {
      const randomTxData = '0100000000010100010000000000000000000000000000000000000000000000000000000000000000000000ffffffff01e8030000000000001976a9144c9c3dfac4207d5d8cb89df5722cb3d712385e3f88ac02483045022100aa5d8aa40a90f23ce2c3d11bc845ca4a12acd99cbea37de6b9f6d86edebba8cb022022dedc2aa0a255f74d04c0b76ece2d7c691f9dd11a64a8ac49f62a99c3a05f9d01232103596d3451025c19dbbdeb932d6bf8bfb4ad499b95b6f88db8899efac102e5fc71ac00000000'
      const randomAddress = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'

      const randomTx = Transaction.fromHex(randomTxData)
      let tx = new TransactionBuilder()
      tx.addInput(randomTx, 0)
      tx.addOutput(randomAddress, 1000)
      tx = tx.buildIncomplete()
      assert(tx instanceof Transaction)
    })

    it('builds a P2SH incompletely with 0 signatures', function () {
      const inp = Buffer.from('010000000173120703f67318aef51f7251272a6816d3f7523bb25e34b136d80be959391c100000000000ffffffff0100c817a80400000017a91471a8ec07ff69c6c4fee489184c462a9b1b9237488700000000', 'hex') // arbitrary P2SH input
      const inpTx = Transaction.fromBuffer(inp)

      const txb = new TransactionBuilder(NETWORKS.testnet)
      txb.addInput(inpTx, 0)
      txb.addOutput('2NAkqp5xffoomp5RLBcakuGpZ12GU4twdz4', 1e8) // arbitrary output

      const res = txb.buildIncomplete()
      assert(res instanceof Transaction)
    })

    it('builds a P2WPKH incompletely with 0 signatures', function () {
      const inp = Buffer.from('010000000173120703f67318aef51f7251272a6816d3f7523bb25e34b136d80be959391c100000000000ffffffff0100c817a8040000001600141a15805e1f4040c9f68ccc887fca2e63547d794b00000000', 'hex')
      const inpTx = Transaction.fromBuffer(inp)

      const txb = new TransactionBuilder(NETWORKS.testnet)
      txb.addInput(inpTx, 0)
      txb.addOutput('2NAkqp5xffoomp5RLBcakuGpZ12GU4twdz4', 1e8) // arbitrary output

      const tx = txb.buildIncomplete()
      assert(tx instanceof Transaction)
    })

    it('bulds a P2WSH incompletely with 0 signatures', function () {
      const inpTx = Transaction.fromBuffer(Buffer.from('010000000173120703f67318aef51f7251272a6816d3f7523bb25e34b136d80be959391c100000000000ffffffff0100c817a80400000022002072df76fcc0b231b94bdf7d8c25d7eef4716597818d211e19ade7813bff7a250200000000', 'hex'))

      const txb = new TransactionBuilder(NETWORKS.testnet)
      txb.addInput(inpTx, 0)
      txb.addOutput('2NAkqp5xffoomp5RLBcakuGpZ12GU4twdz4', 1e8) // arbitrary output

      const tx = txb.buildIncomplete()
      assert(tx instanceof Transaction)
    })
  })
})
