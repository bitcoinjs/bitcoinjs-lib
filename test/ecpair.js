/* global describe, it, beforeEach */
/* eslint-disable no-new */

let assert = require('assert')
let proxyquire = require('proxyquire')
let hoodwink = require('hoodwink')

let ECPair = require('../src/ecpair')
let tinysecp = require('tiny-secp256k1')

let fixtures = require('./fixtures/ecpair.json')

let NETWORKS = require('../src/networks')
let NETWORKS_LIST = [] // Object.values(NETWORKS)
for (let networkName in NETWORKS) {
  NETWORKS_LIST.push(NETWORKS[networkName])
}

let ZERO = Buffer.alloc(32, 0)
let ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
let GROUP_ORDER = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141', 'hex')
let GROUP_ORDER_LESS_1 = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140', 'hex')

describe('ECPair', function () {
  describe('constructor', function () {
    it('defaults to compressed', function () {
      let keyPair = ECPair.fromPrivateKey(ONE)

      assert.strictEqual(keyPair.compressed, true)
    })

    it('supports the uncompressed option', function () {
      let keyPair = ECPair.fromPrivateKey(ONE, {
        compressed: false
      })

      assert.strictEqual(keyPair.compressed, false)
    })

    it('supports the network option', function () {
      let keyPair = ECPair.fromPrivateKey(ONE, {
        compressed: false,
        network: NETWORKS.testnet
      })

      assert.strictEqual(keyPair.network, NETWORKS.testnet)
    })

    fixtures.valid.forEach(function (f) {
      it('derives public key for ' + f.WIF, function () {
        let d = Buffer.from(f.d, 'hex')
        console.log(d)

        let keyPair = ECPair.fromPrivateKey(d, {
          compressed: f.compressed
        })

        assert.strictEqual(keyPair.getPublicKey().toString('hex'), f.Q)
      })
    })

    fixtures.invalid.constructor.forEach(function (f) {
      it('throws ' + f.exception, function () {
        if (f.d) {
          let d = Buffer.from(f.d, 'hex')
          assert.throws(function () {
            ECPair.fromPrivateKey(d, f.options)
          }, new RegExp(f.exception))
        } else {
          let Q = Buffer.from(f.Q, 'hex')
          assert.throws(function () {
            ECPair.fromPublicKey(Q, f.options)
          }, new RegExp(f.exception))
        }
      })
    })
  })

  describe('getPublicKey', function () {
    let keyPair

    beforeEach(function () {
      keyPair = ECPair.fromPrivateKey(ONE)
    })

    it('calls pointFromScalar lazily', hoodwink(function () {
      assert.strictEqual(keyPair.__Q, null)
      keyPair.getPublicKey()
      assert.strictEqual(keyPair.__Q.toString('hex'), '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798')
    }))
  })

  describe('fromWIF', function () {
    fixtures.valid.forEach(function (f) {
      it('imports ' + f.WIF + ' (' + f.network + ')', function () {
        let network = NETWORKS[f.network]
        let keyPair = ECPair.fromWIF(f.WIF, network)

        assert.strictEqual(keyPair.getPrivateKey().toString('hex'), f.d)
        assert.strictEqual(keyPair.compressed, f.compressed)
        assert.strictEqual(keyPair.network, network)
      })
    })

    fixtures.valid.forEach(function (f) {
      it('imports ' + f.WIF + ' (via list of networks)', function () {
        let keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        assert.strictEqual(keyPair.getPrivateKey().toString('hex'), f.d)
        assert.strictEqual(keyPair.compressed, f.compressed)
        assert.strictEqual(keyPair.network, NETWORKS[f.network])
      })
    })

    fixtures.invalid.fromWIF.forEach(function (f) {
      it('throws on ' + f.WIF, function () {
        assert.throws(function () {
          let networks = f.network ? NETWORKS[f.network] : NETWORKS_LIST

          ECPair.fromWIF(f.WIF, networks)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toWIF', function () {
    fixtures.valid.forEach(function (f) {
      it('exports ' + f.WIF, function () {
        let keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)
        let result = keyPair.toWIF()
        assert.strictEqual(result, f.WIF)
      })
    })
  })

  describe('makeRandom', function () {
    let d = Buffer.alloc(32, 4)
    let exWIF = 'KwMWvwRJeFqxYyhZgNwYuYjbQENDAPAudQx5VEmKJrUZcq6aL2pv'

    describe('uses randombytes RNG', function () {
      it('generates a ECPair', function () {
        let stub = { randombytes: function () { return d } }
        let ProxiedECPair = proxyquire('../src/ecpair', stub)

        let keyPair = ProxiedECPair.makeRandom()
        assert.strictEqual(keyPair.toWIF(), exWIF)
      })
    })

    it('allows a custom RNG to be used', function () {
      let keyPair = ECPair.makeRandom({
        rng: function (size) { return d.slice(0, size) }
      })

      assert.strictEqual(keyPair.toWIF(), exWIF)
    })

    it('retains the same defaults as ECPair constructor', function () {
      let keyPair = ECPair.makeRandom()

      assert.strictEqual(keyPair.compressed, true)
      assert.strictEqual(keyPair.network, NETWORKS.bitcoin)
    })

    it('supports the options parameter', function () {
      let keyPair = ECPair.makeRandom({
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
      let rng = this.stub(function f () {
        if (f.calls === 0) return ZERO // 0
        return ONE // >0
      }, 2)

      ECPair.makeRandom({ rng: rng })
    }))

    it('loops until d is within interval [1, n) : n - 1', hoodwink(function () {
      let rng = this.stub(function f () {
        if (f.calls === 0) return ZERO // <1
        if (f.calls === 1) return GROUP_ORDER // >n-1
        return GROUP_ORDER_LESS_1 // n-1
      }, 3)

      ECPair.makeRandom({ rng: rng })
    }))
  })

  describe('getNetwork', function () {
    fixtures.valid.forEach(function (f) {
      it('returns ' + f.network + ' for ' + f.WIF, function () {
        let network = NETWORKS[f.network]
        let keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        assert.strictEqual(keyPair.getNetwork(), network)
      })
    })
  })

  describe('tinysecp wrappers', function () {
    let keyPair, hash, signature

    beforeEach(function () {
      keyPair = ECPair.makeRandom()
      hash = ZERO
      signature = Buffer.alloc(64, 1)
    })

    describe('signing', function () {
      it('wraps tinysecp.sign', hoodwink(function () {
        this.mock(tinysecp, 'sign', function (h, d) {
          assert.strictEqual(h, hash)
          assert.strictEqual(d, keyPair.getPrivateKey())
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
          assert.strictEqual(q, keyPair.getPublicKey())
          assert.strictEqual(s, signature)
          return true
        }, 1)

        assert.strictEqual(keyPair.verify(hash, signature), true)
      }))
    })
  })
})
