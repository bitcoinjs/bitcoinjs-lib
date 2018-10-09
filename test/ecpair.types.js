
const { describe, it } = require('mocha')
const assert = require('assert')
const hoodwink = require('hoodwink')
const tinysecp = require('tiny-secp256k1')

const ECPair = require('../src/ecpair')

const fixtures = require('./fixtures/ecpair.json')

const NETWORKS = require('../src/networks')
const NETWORKS_LIST = [] // Object.values(NETWORKS)
for (let networkName in NETWORKS) {
  NETWORKS_LIST.push(NETWORKS[networkName])
}

const ZERO = Buffer.alloc(32, 0)
const ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')

describe('ECPair', function () {
  function isECPair (ecpair) {
    return typeof ecpair.compressed === 'boolean' &&
      Buffer.isBuffer(ecpair.publicKey) &&
      // "pairs" from pubkey doesn't have privs
      (ecpair.privateKey
        ? Buffer.isBuffer(ecpair.privateKey) : true) &&
      typeof ecpair.sign === 'function' &&
      typeof ecpair.toWIF === 'function' &&
      typeof ecpair.verify === 'function'
  }

  describe('publicKey', () =>
    Array.from({ length: 5 }).forEach(() => {
      const { publicKey } = ECPair.makeRandom()
      it('publicKey of ' + publicKey.toString('hex').slice(0, 10) + '... is a buffer', () =>
        assert(Buffer.isBuffer(publicKey))
      )
    }
    )
  )

  describe('fromPrivateKey', () =>
    fixtures.valid.forEach(fixture =>
      it('it decodes ' + fixture.d.slice(0, 10) + '... into an ECPair', () => {
        const privateKey = Buffer.from(fixture.d, 'hex')
        const keyPair = ECPair.fromPrivateKey(privateKey)

        assert(isECPair(keyPair))
      })))

  describe('fromPublicKey', () => {
    const fromPriv = ECPair.fromPrivateKey(ONE)
    it(`makes an ECPair out of ${fromPriv.publicKey.toString('hex').slice(0, 10)}...`, () => {
      const fromPub = ECPair.fromPublicKey(fromPriv.publicKey)
      assert(isECPair(fromPub))
    })
  })

  describe('fromWIF', () =>
    fixtures.valid.forEach(fixture =>
      it('decoding ' + fixture.WIF.slice(0, 10) + '... returns an ECPair', () => {
        const network = NETWORKS[fixture.network]
        const keyPair = ECPair.fromWIF(fixture.WIF, network)
        assert(isECPair(keyPair))
      })
    )
  )

  describe('toWIF', function () {
    fixtures.valid.forEach(function (f) {
      const network = NETWORKS[f.network]
      const keyPair = ECPair.fromWIF(f.WIF, network)
      it('toWIF of ' + keyPair.publicKey.toString('hex').slice(0, 10) + '... returns a string', () => {
        const result = keyPair.toWIF()
        assert(typeof result === 'string')
      })
    })
  })

  describe('makeRandom', () =>
    Array.from({ length: 10 }).forEach(() => {
      const pair = ECPair.makeRandom()
      it(`returns an ECPair (${pair.publicKey.toString('hex').slice(0, 10)}...)`, () => {
        assert(isECPair(pair))
      })
    })
  )

  describe('tinysecp wrappers', function () {
    describe('signing', () => Array.from({ length: 10 }).forEach(() => {
      const keyPair = ECPair.makeRandom()
      it('signing a message with a random keyPair (' + keyPair.publicKey.toString('hex').slice(0, 10) + '...) returns a buffer', hoodwink(() => {
        const signature = keyPair.sign(ZERO)
        assert(Buffer.isBuffer(signature))
      }))
    }))

    describe('verify', function () {
      Array.from({ length: 10 }).forEach(() => {
        const keyPair = ECPair.makeRandom()
        const hash = ZERO
        const signature = Buffer.alloc(64, 1)
        it(`verifying a message with a random keyePair (${keyPair.publicKey.toString('hex').slice(0, 10)}...) returns a boolean`, hoodwink(function () {
          this.mock(tinysecp, 'verify', (h, q, s) => {
            assert.strictEqual(h, hash)
            assert.strictEqual(q, keyPair.publicKey)
            assert.strictEqual(s, signature)
            return true
          }, 1)
          assert(typeof keyPair.verify(hash, signature) === 'boolean')
        })
        )
      })
    }
    )
  })
})
