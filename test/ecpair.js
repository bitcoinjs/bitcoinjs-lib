/* eslint-disable no-new */

const { describe, it, beforeEach } = require('mocha')
const assert = require('assert')
const proxyquire = require('proxyquire')
const hoodwink = require('hoodwink')

const ECPair = require('../src/ecpair')
const tinysecp = require('tiny-secp256k1')

const fixtures = require('./fixtures/ecpair.json')

const NETWORKS = require('../src/networks')
const NETWORKS_LIST = [] // Object.values(NETWORKS)
for (let networkName in NETWORKS) {
  NETWORKS_LIST.push(NETWORKS[networkName])
}

const ZERO = Buffer.alloc(32, 0)
const ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
const GROUP_ORDER = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141', 'hex')
const GROUP_ORDER_LESS_1 = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140', 'hex')

describe('ECPair', function () {
  describe('getPublicKey', function () {
    let keyPair

    beforeEach(function () {
      keyPair = ECPair.fromPrivateKey(ONE)
    })

    it('calls pointFromScalar lazily', hoodwink(function () {
      assert.strictEqual(keyPair.__Q, null)

      // .publicKey forces the memoization
      assert.strictEqual(keyPair.publicKey.toString('hex'), '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798')
      assert.strictEqual(keyPair.__Q.toString('hex'), '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798')
    }))
  })

  describe('fromPrivateKey', function () {
    it('defaults to compressed', function () {
      const keyPair = ECPair.fromPrivateKey(ONE)

      assert.strictEqual(keyPair.compressed, true)
    })

    it('supports the uncompressed option', function () {
      const keyPair = ECPair.fromPrivateKey(ONE, {
        compressed: false
      })

      assert.strictEqual(keyPair.compressed, false)
    })

    it('supports the network option', function () {
      const keyPair = ECPair.fromPrivateKey(ONE, {
        compressed: false,
        network: NETWORKS.testnet
      })

      assert.strictEqual(keyPair.network, NETWORKS.testnet)
    })

    fixtures.valid.forEach(function (f) {
      it('derives public key for ' + f.WIF, function () {
        const d = Buffer.from(f.d, 'hex')
        const keyPair = ECPair.fromPrivateKey(d, {
          compressed: f.compressed
        })

        assert.strictEqual(keyPair.publicKey.toString('hex'), f.Q)
      })
    })

    fixtures.invalid.fromPrivateKey.forEach(function (f) {
      it('throws ' + f.exception, function () {
        const d = Buffer.from(f.d, 'hex')
        assert.throws(function () {
          ECPair.fromPrivateKey(d, f.options)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('fromPublicKey', function () {
    fixtures.invalid.fromPublicKey.forEach(function (f) {
      it('throws ' + f.exception, function () {
        const Q = Buffer.from(f.Q, 'hex')
        assert.throws(function () {
          ECPair.fromPublicKey(Q, f.options)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('fromWIF', function () {
    fixtures.valid.forEach(function (f) {
      it('imports ' + f.WIF + ' (' + f.network + ')', function () {
        const network = NETWORKS[f.network]
        const keyPair = ECPair.fromWIF(f.WIF, network)

        assert.strictEqual(keyPair.privateKey.toString('hex'), f.d)
        assert.strictEqual(keyPair.compressed, f.compressed)
        assert.strictEqual(keyPair.network, network)
      })
    })

    fixtures.valid.forEach(function (f) {
      it('imports ' + f.WIF + ' (via list of networks)', function () {
        const keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        assert.strictEqual(keyPair.privateKey.toString('hex'), f.d)
        assert.strictEqual(keyPair.compressed, f.compressed)
        assert.strictEqual(keyPair.network, NETWORKS[f.network])
      })
    })

    fixtures.invalid.fromWIF.forEach(function (f) {
      it('throws on ' + f.WIF, function () {
        assert.throws(function () {
          const networks = f.network ? NETWORKS[f.network] : NETWORKS_LIST

          ECPair.fromWIF(f.WIF, networks)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toWIF', function () {
    fixtures.valid.forEach(function (f) {
      it('exports ' + f.WIF, function () {
        const keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)
        const result = keyPair.toWIF()
        assert.strictEqual(result, f.WIF)
      })
    })
  })

  describe('makeRandom', function () {
    const d = Buffer.alloc(32, 4)
    const exWIF = 'KwMWvwRJeFqxYyhZgNwYuYjbQENDAPAudQx5VEmKJrUZcq6aL2pv'

    describe('uses randombytes RNG', function () {
      it('generates a ECPair', function () {
        const stub = { randombytes: function () { return d } }
        const ProxiedECPair = proxyquire('../src/ecpair', stub)

        const keyPair = ProxiedECPair.makeRandom()
        assert.strictEqual(keyPair.toWIF(), exWIF)
      })
    })

    it('allows a custom RNG to be used', function () {
      const keyPair = ECPair.makeRandom({
        rng: function (size) { return d.slice(0, size) }
      })

      assert.strictEqual(keyPair.toWIF(), exWIF)
    })

    it('retains the same defaults as ECPair constructor', function () {
      const keyPair = ECPair.makeRandom()

      assert.strictEqual(keyPair.compressed, true)
      assert.strictEqual(keyPair.network, NETWORKS.bitcoin)
    })

    it('supports the options parameter', function () {
      const keyPair = ECPair.makeRandom({
        compressed: false,
        network: NETWORKS.testnet
      })

      assert.strictEqual(keyPair.compressed, false)
      assert.strictEqual(keyPair.network, NETWORKS.testnet)
    })

    it('throws if d is bad length', function () {
      function rng () {
        return Buffer.alloc(28)
      }

      assert.throws(function () {
        ECPair.makeRandom({ rng: rng })
      }, /Expected Buffer\(Length: 32\), got Buffer\(Length: 28\)/)
    })

    it('loops until d is within interval [1, n) : 1', hoodwink(function () {
      const rng = this.stub(function () {
        if (rng.calls === 0) return ZERO // 0
        return ONE // >0
      }, 2)

      ECPair.makeRandom({ rng: rng })
    }))

    it('loops until d is within interval [1, n) : n - 1', hoodwink(function () {
      const rng = this.stub(function () {
        if (rng.calls === 0) return ZERO // <1
        if (rng.calls === 1) return GROUP_ORDER // >n-1
        return GROUP_ORDER_LESS_1 // n-1
      }, 3)

      ECPair.makeRandom({ rng: rng })
    }))
  })

  describe('.network', function () {
    fixtures.valid.forEach(function (f) {
      it('returns ' + f.network + ' for ' + f.WIF, function () {
        const network = NETWORKS[f.network]
        const keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        assert.strictEqual(keyPair.network, network)
      })
    })
  })

  describe('tinysecp wrappers', function () {
    let keyPair
    let hash
    let signature

    beforeEach(function () {
      keyPair = ECPair.makeRandom()
      hash = ZERO
      signature = Buffer.alloc(64, 1)
    })

    describe('signing', function () {
      it('wraps tinysecp.sign', hoodwink(function () {
        this.mock(tinysecp, 'sign', function (h, d) {
          assert.strictEqual(h, hash)
          assert.strictEqual(d, keyPair.privateKey)
          return signature
        }, 1)

        assert.strictEqual(keyPair.sign(hash), signature)
      }))

      it('throws if no private key is found', function () {
        delete keyPair.__d

        assert.throws(function () {
          keyPair.sign(hash)
        }, /Missing private key/)
      })
    })

    describe('verify', function () {
      it('wraps tinysecp.verify', hoodwink(function () {
        this.mock(tinysecp, 'verify', function (h, q, s) {
          assert.strictEqual(h, hash)
          assert.strictEqual(q, keyPair.publicKey)
          assert.strictEqual(s, signature)
          return true
        }, 1)

        assert.strictEqual(keyPair.verify(hash, signature), true)
      }))
    })
  })
})
