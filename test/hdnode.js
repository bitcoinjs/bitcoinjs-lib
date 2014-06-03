var assert = require('assert')
var networks = require('../src/networks')
var sec = require('../src/sec')
var ecparams = sec("secp256k1")

var BigInteger = require('bigi')
var HDNode = require('../src/hdnode')

var fixtures = require('./fixtures/hdnode.json')

describe('HDNode', function() {
  describe('Constructor', function() {
    var D = BigInteger.ONE
    var Q = ecparams.getG().multiply(D)
    var chainCode = new Buffer(32)
    chainCode.fill(1)

    it('calculates the publicKey from a BigInteger', function() {
      var hd = new HDNode(D, chainCode)

      assert(hd.pub.Q.equals(Q))
    })

    it('only uses compressed points', function() {
      var hd = new HDNode(Q, chainCode)
      var hdP = new HDNode(D, chainCode)

      assert.strictEqual(hd.pub.compressed, true)
      assert.strictEqual(hdP.pub.compressed, true)
    })

    it('has a default depth/index of 0', function() {
      var hd = new HDNode(Q, chainCode)

      assert.strictEqual(hd.depth, 0)
      assert.strictEqual(hd.index, 0)
    })

    it('defaults to the bitcoin network', function() {
      var hd = new HDNode(Q, chainCode)

      assert.equal(hd.network, networks.bitcoin)
    })

    it('supports alternative networks', function() {
      var hd = new HDNode(Q, chainCode, networks.testnet)

      assert.equal(hd.network, networks.testnet)
    })

    it('throws an exception when an unknown network is given', function() {
      assert.throws(function() {
        new HDNode(D, chainCode, {})
      }, /Unknown BIP32 constants for network/)
    })
  })

  describe('fromSeed*', function() {
    fixtures.valid.forEach(function(f) {
      it('calculates privKey and chainCode for ' + f.master.fingerprint, function() {
        var hd = HDNode.fromSeedHex(f.master.seed)

        assert.equal(hd.priv.toWIF(), f.master.wif)
        assert.equal(hd.chainCode.toString('hex'), f.master.chainCode)
      })
    })
  })

  describe('toBase58', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.master.base58 + ' (public) correctly', function() {
        var hd = HDNode.fromSeedHex(f.master.seed)

        assert.equal(hd.toBase58(false), f.master.base58)
      })
    })

    fixtures.valid.forEach(function(f) {
      it('exports ' + f.master.base58Priv + ' (private) correctly', function() {
        var hd = HDNode.fromSeedHex(f.master.seed)

        assert.equal(hd.toBase58(true), f.master.base58Priv)
      })
    })

    it('fails when there is no private key', function() {
      var hd = HDNode.fromBase58(fixtures.valid[0].master.base58)

      assert.throws(function() {
        hd.toBase58(true)
      }, /Missing private key/)
    })
  })

  describe('fromBase58', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.master.base58 + ' (public) correctly', function() {
        var hd = HDNode.fromBase58(f.master.base58)

        assert.equal(hd.toBase58(), f.master.base58)
      })
    })

    fixtures.valid.forEach(function(f) {
      it('imports ' + f.master.base58Priv + ' (private) correctly', function() {
        var hd = HDNode.fromBase58(f.master.base58Priv)

        assert.equal(hd.toBase58(), f.master.base58Priv)
      })
    })

    fixtures.invalid.fromBase58.forEach(function(f) {
      it('throws on ' + f.string, function() {
        assert.throws(function() {
          HDNode.fromBase58(f.string)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('fromBuffer/fromHex', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.master.hex + ' (public) correctly', function() {
        var hd = HDNode.fromHex(f.master.hex)

        assert.equal(hd.toBuffer().toString('hex'), f.master.hex)
      })
    })

    fixtures.valid.forEach(function(f) {
      it('imports ' + f.master.hexPriv + ' (private) correctly', function() {
        var hd = HDNode.fromHex(f.master.hexPriv)

        assert.equal(hd.toBuffer().toString('hex'), f.master.hexPriv)
      })
    })

    fixtures.invalid.fromBuffer.forEach(function(f) {
      it('throws on ' + f.string, function() {
        assert.throws(function() {
          HDNode.fromHex(f.hex)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toBuffer/toHex', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.master.hex + ' (public) correctly', function() {
        var hd = HDNode.fromSeedHex(f.master.seed)

        assert.equal(hd.toHex(false), f.master.hex)
      })
    })

    fixtures.valid.forEach(function(f) {
      it('exports ' + f.master.hexPriv + ' (private) correctly', function() {
        var hd = HDNode.fromSeedHex(f.master.seed)

        assert.equal(hd.toHex(true), f.master.hexPriv)
      })
    })

    it('fails when there is no private key', function() {
      var hd = HDNode.fromHex(fixtures.valid[0].master.hex)

      assert.throws(function() {
        hd.toHex(true)
      }, /Missing private key/)
    })
  })

  describe('getIdentifier', function() {
    var f = fixtures.valid[0]

    it('returns the identifier for ' + f.master.fingerprint, function() {
      var hd = HDNode.fromBase58(f.master.base58)

      assert.equal(hd.getIdentifier().toString('hex'), f.master.identifier)
    })
  })

  describe('getFingerprint', function() {
    var f = fixtures.valid[0]

    it('returns the fingerprint for ' + f.master.fingerprint, function() {
      var hd = HDNode.fromBase58(f.master.base58)

      assert.equal(hd.getFingerprint().toString('hex'), f.master.fingerprint)
    })
  })

  describe('getAddress', function() {
    var f = fixtures.valid[0]

    it('returns the Address (pubKeyHash) for ' + f.master.fingerprint, function() {
      var hd = HDNode.fromBase58(f.master.base58)

      assert.equal(hd.getAddress().toString(), f.master.address)
    })

    it('supports alternative networks', function() {
      var hd = HDNode.fromBase58(f.master.base58)
      hd.network = networks.testnet

      assert.equal(hd.getAddress().version, networks.testnet.pubKeyHash)
    })
  })

  describe('derive', function() {
    function verifyVector(hd, v, depth) {
      assert.equal(hd.priv.toWIF(), v.wif)
      assert.equal(hd.pub.toHex(), v.pubKey)
      assert.equal(hd.chainCode.toString('hex'), v.chainCode)
      assert.equal(hd.depth, depth || 0)

      if (v.hardened) {
        assert.equal(hd.index, v.m + HDNode.HIGHEST_BIT)
      } else {
        assert.equal(hd.index, v.m)
      }
    }

    fixtures.valid.forEach(function(f, j) {
      var hd = HDNode.fromSeedHex(f.master.seed)

      f.children.forEach(function(c, i) {
        it(c.description + ' from ' + f.master.fingerprint, function() {
          if (c.hardened) {
            hd = hd.deriveHardened(c.m)

          } else {
            hd = hd.derive(c.m)
          }

          verifyVector(hd, c, i + 1)
        })
      })
    })

    it('works for public -> public', function() {
      var f = fixtures.valid[1]
      var c = f.children[0]

      var parentNode = HDNode.fromBase58(f.master.base58)
      var child = parentNode.derive(c.m)

      assert.equal(child.toBase58(), c.base58)
    })

    it('throws on public -> public (hardened)', function() {
      var f = fixtures.valid[1]
      var c = f.children[0]

      var parentNode = HDNode.fromBase58(f.master.base58)

      assert.throws(function() {
        parentNode.deriveHardened(c.m)
      }, /Could not derive hardened child key/)
    })
  })
})
