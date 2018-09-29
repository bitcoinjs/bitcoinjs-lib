const { describe, it } = require('mocha')
const assert = require('assert')

const bscript = require('../src/script')
const baddress = require('../src/address')
const fixtures = require('./fixtures/address.json')

const NETWORKS = Object.assign({
  litecoin: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bip32: {
      public: 0x019da462,
      private: 0x019d9cfe
    },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0
  }
}, require('../src/networks'))

describe('address types', () => {
  describe('fromBase58Check', () => {
    fixtures.standard.forEach((f) => {
      if (!f.base58check) return
      it(`decoding ${f.base58check} returns a Buffer and a number`, () => {
        const address = baddress.fromBase58Check(f.base58check)
        assert.ok(Buffer.isBuffer(address.hash))
        assert.ok(typeof address.version === 'number')
      })
    })
  })

  describe('fromBech32', () => {
    fixtures.standard.forEach(f => {
      if (!f.bech32) return

      it(`decoding ${f.bech32} returns a Buffer, a string and a number`, () => {
        const address = baddress.fromBech32(f.bech32)
        assert.ok(Buffer.isBuffer(address.data))
        assert.ok(typeof address.prefix === 'string')
        assert.ok(typeof address.version === 'number')
      })
    })
  })

  describe('fromOutputScript', () => {
    fixtures.standard.forEach(f => {
      it(`decoding ${f.script.slice(0, 30)}... returns a string`, () => {
        const script = bscript.fromASM(f.script)
        const address = baddress.fromOutputScript(script)
        assert(typeof address === 'string')
      })
    })
  })

  describe('toBase58Check', () => {
    fixtures.standard.forEach(f => {
      if (!f.base58check) return

      it(`encoding ${f.hash} returns a string `, () => {
        const address = baddress.toBase58Check(Buffer.from(f.hash, 'hex'), f.version)
        assert.ok(typeof address === 'string')
      })
    })
  })

  describe('toBech32', () => {
    fixtures.bech32.forEach(f => {
      if (!f.bech32) return

      it(`encoding ${f.address} returns a string`, () => {
        const data = Buffer.from(f.data, 'hex')
        const address = baddress.toBech32(data, f.version, f.prefix)
        assert.ok(typeof address === 'string')
      })
    })
  })

  describe('toOutputScript', () => {
    fixtures.standard.forEach(f => {
      const data = f.base58check || f.bech32
      it(`decoding ${data.slice(0, 20)}... returns a buffer`, () => {
        const script = baddress.toOutputScript(data, NETWORKS[f.network])
        assert.ok(Buffer.isBuffer(script))
      })
    })
  })
})
