/* global describe, it, beforeEach */
/* eslint-disable no-new */

var assert = require('assert')
var ecdsa = require('../src/ecdsa')
var sinon = require('sinon')

var BigInteger = require('bigi')
var ECPair = require('../src/ecpair')
var HDNode = require('../src/hdnode')

var fixtures = require('./fixtures/hdnode.json')
var curve = ecdsa.__curve

var NETWORKS = require('../src/networks')
var NETWORKS_LIST = [] // Object.values(NETWORKS)
for (var networkName in NETWORKS) {
  NETWORKS_LIST.push(NETWORKS[networkName])
}

describe('HDNode', function () {
  describe('Constructor', function () {
    var keyPair, chainCode

    beforeEach(function () {
      var d = BigInteger.ONE

      keyPair = new ECPair(d, null)
      chainCode = new Buffer(32)
      chainCode.fill(1)
    })

    it('stores the keyPair/chainCode directly', function () {
      var hd = new HDNode(keyPair, chainCode)

      assert.strictEqual(hd.keyPair, keyPair)
      assert.strictEqual(hd.chainCode, chainCode)
    })

    it('has a default depth/index of 0', function () {
      var hd = new HDNode(keyPair, chainCode)

      assert.strictEqual(hd.depth, 0)
      assert.strictEqual(hd.index, 0)
    })

    it('throws on uncompressed keyPair', function () {
      keyPair.compressed = false

      assert.throws(function () {
        new HDNode(keyPair, chainCode)
      }, /BIP32 only allows compressed keyPairs/)
    })

    it('throws when an invalid length chain code is given', function () {
      assert.throws(function () {
        new HDNode(keyPair, new Buffer(20))
      }, /Expected 256-bit Buffer, got 160-bit/)
    })
  })

  describe('fromSeed*', function () {
    fixtures.valid.forEach(function (f) {
      it('calculates privKey and chainCode for ' + f.master.fingerprint, function () {
        var network = NETWORKS[f.network]
        var hd = HDNode.fromSeedHex(f.master.seed, network)

        assert.strictEqual(hd.keyPair.toWIF(), f.master.wif)
        assert.strictEqual(hd.chainCode.toString('hex'), f.master.chainCode)
      })
    })

    it('throws if IL is not within interval [1, n - 1] | IL === 0', sinon.test(function () {
      this.mock(BigInteger).expects('fromBuffer')
        .once().returns(BigInteger.ZERO)

      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffffffffffffffffffffffffff')
      }, /Private key must be greater than 0/)
    }))

    it('throws if IL is not within interval [1, n - 1] | IL === n', sinon.test(function () {
      this.mock(BigInteger).expects('fromBuffer')
        .once().returns(curve.n)

      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffffffffffffffffffffffffff')
      }, /Private key must be less than the curve order/)
    }))

    it('throws on low entropy seed', function () {
      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffff')
      }, /Seed should be at least 128 bits/)
    })

    it('throws on too high entropy seed', function () {
      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      }, /Seed should be at most 512 bits/)
    })
  })

  describe('ECPair wrappers', function () {
    var keyPair, hd, hash

    beforeEach(function () {
      keyPair = ECPair.makeRandom()
      hash = new Buffer(32)

      var chainCode = new Buffer(32)
      hd = new HDNode(keyPair, chainCode)
    })

    describe('getAddress', function () {
      it('wraps keyPair.getAddress', sinon.test(function () {
        this.mock(keyPair).expects('getAddress')
          .once().withArgs().returns('foobar')

        assert.strictEqual(hd.getAddress(), 'foobar')
      }))
    })

    describe('getNetwork', function () {
      it('wraps keyPair.getNetwork', sinon.test(function () {
        this.mock(keyPair).expects('getNetwork')
          .once().withArgs().returns('network')

        assert.strictEqual(hd.getNetwork(), 'network')
      }))
    })

    describe('getPublicKeyBuffer', function () {
      it('wraps keyPair.getPublicKeyBuffer', sinon.test(function () {
        this.mock(keyPair).expects('getPublicKeyBuffer')
          .once().withArgs().returns('pubKeyBuffer')

        assert.strictEqual(hd.getPublicKeyBuffer(), 'pubKeyBuffer')
      }))
    })

    describe('sign', function () {
      it('wraps keyPair.sign', sinon.test(function () {
        this.mock(keyPair).expects('sign')
          .once().withArgs(hash).returns('signed')

        assert.strictEqual(hd.sign(hash), 'signed')
      }))
    })

    describe('verify', function () {
      var signature

      beforeEach(function () {
        signature = hd.sign(hash)
      })

      it('wraps keyPair.verify', sinon.test(function () {
        this.mock(keyPair).expects('verify')
          .once().withArgs(hash, signature).returns('verified')

        assert.strictEqual(hd.verify(hash, signature), 'verified')
      }))
    })
  })

  describe('toBase58', function () {
    fixtures.valid.forEach(function (f) {
      it('exports ' + f.master.base58 + ' (public) correctly', function () {
        var network = NETWORKS[f.network]
        var hd = HDNode.fromSeedHex(f.master.seed, network).neutered()

        assert.strictEqual(hd.toBase58(), f.master.base58)
      })
    })

    fixtures.valid.forEach(function (f) {
      it('exports ' + f.master.base58Priv + ' (private) correctly', function () {
        var network = NETWORKS[f.network]
        var hd = HDNode.fromSeedHex(f.master.seed, network)

        assert.strictEqual(hd.toBase58(), f.master.base58Priv)
      })
    })
  })

  describe('fromBase58', function () {
    fixtures.valid.forEach(function (f) {
      it('imports ' + f.master.base58 + ' (public) correctly', function () {
        var network = NETWORKS[f.network]
        var hd = HDNode.fromBase58(f.master.base58, network)

        assert.strictEqual(hd.toBase58(), f.master.base58)
        assert.strictEqual(hd.keyPair.network, network)
        assert.strictEqual(hd.isNeutered(), true)
      })
    })

    fixtures.valid.forEach(function (f) {
      it('imports ' + f.master.base58Priv + ' (private) correctly', function () {
        var network = NETWORKS[f.network]
        var hd = HDNode.fromBase58(f.master.base58Priv, network)

        assert.strictEqual(hd.toBase58(), f.master.base58Priv)
        assert.strictEqual(hd.keyPair.network, network)
        assert.strictEqual(hd.isNeutered(), false)
      })
    })

    fixtures.invalid.fromBase58.forEach(function (f) {
      it('throws on ' + f.string, function () {
        assert.throws(function () {
          var networks = f.network ? NETWORKS[f.network] : NETWORKS_LIST

          HDNode.fromBase58(f.string, networks)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('getIdentifier', function () {
    var f = fixtures.valid[0]

    it('returns the identifier for ' + f.master.fingerprint, function () {
      var hd = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)

      assert.strictEqual(hd.getIdentifier().toString('hex'), f.master.identifier)
    })
  })

  describe('getFingerprint', function () {
    var f = fixtures.valid[0]

    it('returns the fingerprint for ' + f.master.fingerprint, function () {
      var hd = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)

      assert.strictEqual(hd.getFingerprint().toString('hex'), f.master.fingerprint)
    })
  })

  describe('neutered', function () {
    var f = fixtures.valid[0]

    it('strips all private information', function () {
      var hd = HDNode.fromBase58(f.master.base58Priv, NETWORKS_LIST)
      var hdn = hd.neutered()

      assert.strictEqual(hdn.keyPair.d, undefined)
      assert.strictEqual(hdn.keyPair.Q, hd.keyPair.Q)
      assert.strictEqual(hdn.chainCode, hd.chainCode)
      assert.strictEqual(hdn.depth, hd.depth)
      assert.strictEqual(hdn.index, hd.index)
      assert.strictEqual(hdn.isNeutered(), true)
      assert.strictEqual(hd.isNeutered(), false)
    })
  })

  describe('derive', function () {
    function verifyVector (hd, v, depth) {
      assert.strictEqual(hd.keyPair.toWIF(), v.wif)
      assert.strictEqual(hd.keyPair.getPublicKeyBuffer().toString('hex'), v.pubKey)
      assert.strictEqual(hd.chainCode.toString('hex'), v.chainCode)
      assert.strictEqual(hd.depth, depth || 0)

      if (v.hardened) {
        assert.strictEqual(hd.index, v.m + HDNode.HIGHEST_BIT)
      } else {
        assert.strictEqual(hd.index, v.m)
      }
    }

    fixtures.valid.forEach(function (f) {
      var network = NETWORKS[f.network]
      var hd = HDNode.fromSeedHex(f.master.seed, network)
      var master = hd

      // FIXME: test data is only testing Private -> private for now
      f.children.forEach(function (c, i) {
        it(c.description + ' from ' + f.master.fingerprint, function () {
          if (c.hardened) {
            hd = hd.deriveHardened(c.m)
          } else {
            hd = hd.derive(c.m)
          }

          verifyVector(hd, c, i + 1)
        })
      })

      // testing deriving path from master
      f.children.forEach(function (c) {
        it(c.description + ' from ' + f.master.fingerprint + ' by path', function () {
          var path = c.description
          var child = master.derivePath(path)

          var pathSplit = path.split('/').slice(1)
          var pathNotM = pathSplit.join('/')
          var childNotM = master.derivePath(pathNotM)

          verifyVector(child, c, pathSplit.length)
          verifyVector(childNotM, c, pathSplit.length)
        })
      })

      // testing deriving path from children
      f.children.forEach(function (c, i) {
        var cn = master.derivePath(c.description)

        f.children.slice(i + 1).forEach(function (cc) {
          it(cc.description + ' from ' + c.fingerprint + ' by path', function () {
            var path = cc.description

            var pathSplit = path.split('/').slice(i + 2)
            var pathEnd = pathSplit.join('/')
            var pathEndM = 'm/' + pathEnd
            var child = cn.derivePath(pathEnd)
            verifyVector(child, cc, pathSplit.length + i + 1)

            assert.throws(function () {
              cn.derivePath(pathEndM)
            }, /Not a master node/)
          })
        })
      })
    })

    it('works for Private -> public (neutered)', function () {
      var f = fixtures.valid[1]
      var c = f.children[0]

      var master = HDNode.fromBase58(f.master.base58Priv, NETWORKS_LIST)
      var child = master.derive(c.m).neutered()

      assert.strictEqual(child.toBase58(), c.base58)
    })

    it('works for Private -> public (neutered, hardened)', function () {
      var f = fixtures.valid[0]
      var c = f.children[0]

      var master = HDNode.fromBase58(f.master.base58Priv, NETWORKS_LIST)
      var child = master.deriveHardened(c.m).neutered()

      assert.strictEqual(child.toBase58(), c.base58)
    })

    it('works for Public -> public', function () {
      var f = fixtures.valid[1]
      var c = f.children[0]

      var master = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)
      var child = master.derive(c.m)

      assert.strictEqual(child.toBase58(), c.base58)
    })

    it('throws on Public -> public (hardened)', function () {
      var f = fixtures.valid[0]
      var c = f.children[0]

      var master = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)

      assert.throws(function () {
        master.deriveHardened(c.m)
      }, /Could not derive hardened child key/)
    })

    it('throws on wrong types', function () {
      var f = fixtures.valid[0]
      var master = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)

      fixtures.invalid.derive.forEach(function (fx) {
        assert.throws(function () {
          master.derive(fx)
        }, /Expected UInt32/)
      })

      fixtures.invalid.deriveHardened.forEach(function (fx) {
        assert.throws(function () {
          master.deriveHardened(fx)
        }, /Expected UInt31/)
      })

      fixtures.invalid.derivePath.forEach(function (fx) {
        assert.throws(function () {
          master.derivePath(fx)
        }, /Expected Bip32Path/)
      })
    })
  })
})
