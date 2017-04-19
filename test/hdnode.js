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

var validAll = []
fixtures.valid.forEach(function (f) {
  function addNetwork (n) {
    n.network = f.network
    return n
  }

  validAll = validAll.concat(addNetwork(f.master), f.children.map(addNetwork))
})

describe('HDNode', function () {
  describe('Constructor', function () {
    var keyPair, chainCode

    beforeEach(function () {
      var d = BigInteger.ONE

      keyPair = new ECPair(d, null)
      chainCode = Buffer.alloc(32, 1)
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
        new HDNode(keyPair, Buffer.alloc(20))
      }, /Expected property "1" of type Buffer\(Length: 32\), got Buffer\(Length: 20\)/)
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
      hash = Buffer.alloc(32)

      var chainCode = Buffer.alloc(32)
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

  describe('fromBase58 / toBase58', function () {
    validAll.forEach(function (f) {
      it('exports ' + f.base58 + ' (public) correctly', function () {
        var hd = HDNode.fromBase58(f.base58, NETWORKS_LIST)

        assert.strictEqual(hd.toBase58(), f.base58)
        assert.throws(function () { hd.keyPair.toWIF() }, /Missing private key/)
      })
    })

    validAll.forEach(function (f) {
      it('exports ' + f.base58Priv + ' (private) correctly', function () {
        var hd = HDNode.fromBase58(f.base58Priv, NETWORKS_LIST)

        assert.strictEqual(hd.toBase58(), f.base58Priv)
        assert.strictEqual(hd.keyPair.toWIF(), f.wif)
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
    validAll.forEach(function (f) {
      it('returns the identifier for ' + f.fingerprint, function () {
        var hd = HDNode.fromBase58(f.base58, NETWORKS_LIST)

        assert.strictEqual(hd.getIdentifier().toString('hex'), f.identifier)
      })
    })
  })

  describe('getFingerprint', function () {
    validAll.forEach(function (f) {
      it('returns the fingerprint for ' + f.fingerprint, function () {
        var hd = HDNode.fromBase58(f.base58, NETWORKS_LIST)

        assert.strictEqual(hd.getFingerprint().toString('hex'), f.fingerprint)
      })
    })
  })

  describe('neutered / isNeutered', function () {
    validAll.forEach(function (f) {
      it('drops the private key for ' + f.fingerprint, function () {
        var hd = HDNode.fromBase58(f.base58Priv, NETWORKS_LIST)
        var hdn = hd.neutered()

        assert.notEqual(hdn.keyPair, hd.keyPair)
        assert.throws(function () { hdn.keyPair.toWIF() }, /Missing private key/)
        assert.strictEqual(hdn.toBase58(), f.base58)
        assert.strictEqual(hdn.chainCode, hd.chainCode)
        assert.strictEqual(hdn.depth, f.depth >>> 0)
        assert.strictEqual(hdn.index, f.index >>> 0)
        assert.strictEqual(hdn.isNeutered(), true)

        // does not modify the original
        assert.strictEqual(hd.toBase58(), f.base58Priv)
        assert.strictEqual(hd.isNeutered(), false)
      })
    })
  })

  describe('derive', function () {
    function verifyVector (hd, v) {
      if (hd.isNeutered()) {
        assert.strictEqual(hd.toBase58(), v.base58)
      } else {
        assert.strictEqual(hd.neutered().toBase58(), v.base58)
        assert.strictEqual(hd.toBase58(), v.base58Priv)
      }

      assert.strictEqual(hd.getFingerprint().toString('hex'), v.fingerprint)
      assert.strictEqual(hd.getIdentifier().toString('hex'), v.identifier)
      assert.strictEqual(hd.getAddress(), v.address)
      assert.strictEqual(hd.keyPair.toWIF(), v.wif)
      assert.strictEqual(hd.keyPair.getPublicKeyBuffer().toString('hex'), v.pubKey)
      assert.strictEqual(hd.chainCode.toString('hex'), v.chainCode)
      assert.strictEqual(hd.depth, v.depth >>> 0)
      assert.strictEqual(hd.index, v.index >>> 0)
    }

    fixtures.valid.forEach(function (f) {
      var network = NETWORKS[f.network]
      var hd = HDNode.fromSeedHex(f.master.seed, network)
      var master = hd

      // testing deriving path from master
      f.children.forEach(function (c) {
        it(c.path + ' from ' + f.master.fingerprint + ' by path', function () {
          var child = master.derivePath(c.path)
          var childNoM = master.derivePath(c.path.slice(2)) // no m/ on path

          verifyVector(child, c)
          verifyVector(childNoM, c)
        })
      })

      // testing deriving path from children
      f.children.forEach(function (c, i) {
        var cn = master.derivePath(c.path)

        f.children.slice(i + 1).forEach(function (cc) {
          it(cc.path + ' from ' + c.fingerprint + ' by path', function () {
            var ipath = cc.path.slice(2).split('/').slice(i + 1).join('/')
            var child = cn.derivePath(ipath)
            verifyVector(child, cc)

            assert.throws(function () {
              cn.derivePath('m/' + ipath)
            }, /Not a master node/)
          })
        })
      })

      // FIXME: test data is only testing Private -> private for now
      f.children.forEach(function (c) {
        if (c.m === undefined) return

        it(c.path + ' from ' + f.master.fingerprint, function () {
          if (c.hardened) {
            hd = hd.deriveHardened(c.m)
          } else {
            hd = hd.derive(c.m)
          }

          verifyVector(hd, c)
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

      assert.strictEqual(c.base58, child.toBase58())
    })

    it('works for Public -> public', function () {
      var f = fixtures.valid[1]
      var c = f.children[0]

      var master = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)
      var child = master.derive(c.m)

      assert.strictEqual(c.base58, child.toBase58())
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
        }, /Expected BIP32 derivation path/)
      })
    })

    it('works when private key has leading zeros', function () {
      var key = 'xprv9s21ZrQH143K3ckY9DgU79uMTJkQRLdbCCVDh81SnxTgPzLLGax6uHeBULTtaEtcAvKjXfT7ZWtHzKjTpujMkUd9dDb8msDeAfnJxrgAYhr'
      var hdkey = HDNode.fromBase58(key)
      assert.strictEqual(hdkey.keyPair.d.toBuffer(32).toString('hex'), '00000055378cf5fafb56c711c674143f9b0ee82ab0ba2924f19b64f5ae7cdbfd')
      var child = hdkey.derivePath('m/44\'/0\'/0\'/0/0\'')
      assert.strictEqual(child.keyPair.d.toBuffer().toString('hex'), '3348069561d2a0fb925e74bf198762acc47dce7db27372257d2d959a9e6f8aeb')
    })
  })
})
