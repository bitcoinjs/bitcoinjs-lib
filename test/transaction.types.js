
const { describe, it } = require('mocha')
const assert = require('assert')
const bscript = require('../src/script')
const fixtures = require('./fixtures/transaction')
const Transaction = require('../src/transaction')

const isTransaction = (tx) => ['addInput', 'addOutput', 'byteLength',
  'clone', 'getHash', 'getId',
  'hasWitnesses', 'hashForSignature', 'hashForWitnessV0',
  'isCoinbase', 'setInputScript', 'setWitness',
  'toBuffer', 'toHex', 'virtualSize',
  'weight'].every(method => {
  if (typeof tx[method] !== 'function') {
    console.error(method + ' is not a function')
    return false
  }
  return true
})

describe('Transaction', () => {
  describe('fromBuffer/fromHex', () => {
    function importExport (f) {
      const txHex = f.hex || f.txHex

      it(f.description + ' fromHex returns a transaction', () => {
        const actual = Transaction.fromHex(txHex)

        assert(isTransaction(actual))
      })
    }
    fixtures.valid.forEach(importExport)
    fixtures.hashForSignature.forEach(importExport)
    fixtures.hashForWitnessV0.forEach(importExport)
  })

  describe('toBuffer/toHex', () => {
    fixtures.valid.forEach(f => {
      const tx = Transaction.fromHex(f.hex)
      it(f.description + ' toHex returns a string ', () => {
        assert(typeof tx.toHex() === 'string')
      })

      it(f.description + ' toBuffer returns a buffer', () => {
        assert(Buffer.isBuffer(tx.toBuffer()))
      })
    })
  })

  describe('hasWitnesses', () => {
    fixtures.valid.forEach(f => {
      it(`hasWitnesses on ${f.description} returns a boolean`, () => {
        const tx = Transaction.fromHex(f.whex ? f.whex : f.hex)
        assert(typeof tx.hasWitnesses() === 'boolean')
      })
    })
  })

  describe('weight/virtualSize', () => {
    fixtures.valid.forEach(f => {
      it(`virtualSize of ${f.description} returns an integer`, () => {
        const transaction = Transaction.fromHex(f.whex ? f.whex : f.hex)
        const size = transaction.virtualSize()
        assert(Number.isInteger(size))
      })
    })

    fixtures.valid.forEach(f => {
      it(`weight of ${f.description} returns an integer`, () => {
        const transaction = Transaction.fromHex(f.whex ? f.whex : f.hex)
        const weight = transaction.weight()
        assert(Number.isInteger(weight))
      })
    })
  })

  describe('bytelength', () => {
    fixtures.valid.forEach(f => {
      it(`byteLength of ${f.description} should return an integer`, () => {
        const tx = Transaction.fromHex(f.hex)
        assert(Number.isInteger(tx.byteLength()))
      })
    })
  })

  describe('addInput', () => {
    const prevTxHash = Buffer.from('ffffffff00ffff000000000000000000000000000000000000000000101010ff', 'hex')

    it('returns an integer', () => {
      const tx = new Transaction()
      assert(Number.isInteger(tx.addInput(prevTxHash, 0)))
    })
  })

  describe('addOutput', () => {
    it('returns an integer', () => {
      const tx = new Transaction()
      assert(Number.isInteger(tx.addOutput(Buffer.alloc(0), 0)))
    })
  })

  describe('clone', () => {
    fixtures.valid.forEach(f => {
      it(`cloning ${f.description} returns a transaction`, () => {
        const tx = Transaction.fromHex(f.hex)
        assert(isTransaction(tx.clone()))
      })
    })
  })

  describe('getHash/getId', () => {
    function verify (f) {
      const tx = Transaction.fromHex(f.whex || f.hex)
      it('getHash of ' + f.description + 'should return a buffer', () => {
        assert(Buffer.isBuffer(tx.getHash()))
      })

      it(`getId of ${f.description} should return a string`, () => {
        assert(typeof tx.getId() === 'string')
      })
    }

    fixtures.valid.forEach(verify)
  })

  describe('isCoinbase', function () {
    function verify (f) {
      it('isCoinbase of ' + f.description + ' should return boolean', () => {
        const tx = Transaction.fromHex(f.hex)

        assert(typeof tx.isCoinbase() === 'boolean')
      })
    }

    fixtures.valid.forEach(verify)
  })

  describe('hashForSignature', () => {
    fixtures.hashForSignature.forEach(f => {
      it('hashForSignature of ' + (f.description ? ('case "' + f.description + '"') : f.script) + ' should return a buffer', () => {
        const tx = Transaction.fromHex(f.txHex)
        const script = bscript.fromASM(f.script)

        assert(Buffer.isBuffer(tx.hashForSignature(f.inIndex, script, f.type)))
      })
    })
  })

  describe('hashForWitnessV0', () => {
    fixtures.hashForWitnessV0.forEach(f => {
      it('hashForWitnessV0 of ' + f.description + ' should return a buffer', () => {
        const tx = Transaction.fromHex(f.txHex)
        const script = bscript.fromASM(f.script)

        assert(Buffer.isBuffer(tx.hashForWitnessV0(f.inIndex, script, f.value, f.type)))
      })
    })
  })

  describe('setWitness', () => {
    it('should return nothing', () => {
      const tx = new Transaction()
      tx.addInput(
        Buffer.from('ffffffff00ffff000000000000000000000000000000000000000000101010ff', 'hex'),
        0
      )
      const result = tx.setWitness(0, [Buffer.alloc(0)])
      assert(typeof result === 'undefined')
    })
  })

  describe.only('setInputScript', () => {
    it('should return nothing', () => {
      const tx = new Transaction()
      tx.addInput(
        Buffer.from('ffffffff00ffff000000000000000000000000000000000000000000101010ff', 'hex'),
        0
      )
      const result = tx.setInputScript(0, Buffer.alloc(0))
      assert(typeof result === 'undefined')
    })
  })

  describe('isCoinbaseHash', () => {
    fixtures.valid.forEach(f => {
      it(`isCoinbaseHash on ${f.hex.slice(0, 20)}... should return a boolean`, () => {
        const buffer = Buffer.from(f.hash, 'hex')
        assert(typeof Transaction.isCoinbaseHash(buffer) === 'boolean')
      })
    })
  })
})
