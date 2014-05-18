var assert = require('assert')
var crypto = require('../src/crypto')

var BigInteger = require('bigi')
var ECKey = require('../src/eckey')

var fixtures = require('./fixtures/eckey')
var networks = require('../src/networks')

describe('ECKey', function() {
  describe('constructor', function() {
    it('defaults to compressed', function() {
      var privKey = new ECKey(BigInteger.ONE)

      assert.equal(privKey.pub.compressed, true)
    })

    it('supports the uncompressed flag', function() {
      var privKey = new ECKey(BigInteger.ONE, false)

      assert.equal(privKey.pub.compressed, false)
    })

    it('calculates the matching pubKey', function() {
      fixtures.valid.forEach(function(f) {
        var privKey = new ECKey(new BigInteger(f.D))

        assert.equal(privKey.pub.Q.toString(), f.Q.toString())
      })
    })

    fixtures.invalid.constructor.forEach(function(f) {
      it('throws on ' + f.description, function() {
        assert.throws(function() {
          new ECKey(new BigInteger(f.D))
        })
      })
    })
  })

  describe('fromWIF', function() {
    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        f.WIFs.forEach(function(wif) {
          var privKey = ECKey.fromWIF(wif.string)

          assert.equal(privKey.D.toString(), f.D)
          assert.equal(privKey.pub.compressed, wif.compressed)
        })
      })
    })

    fixtures.invalid.WIF.forEach(function(f) {
      it('throws on ' + f.description, function() {
        assert.throws(function() {
          ECKey.fromWIF(f.string)
        })
      })
    })
  })

  describe('toWIF', function() {
    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        f.WIFs.forEach(function(wif) {
          var privKey = ECKey.fromWIF(wif.string)
          var version = networks[wif.network].wif
          var result = privKey.toWIF(version)

          assert.equal(result, wif.string)
        })
      })
    })
  })

  describe('signing', function() {
    var hash = crypto.sha256('Vires in numeris')
    var priv = ECKey.makeRandom()
    var signature = priv.sign(hash)

    it('should verify against the public key', function() {
      assert(priv.pub.verify(hash, signature))
    })

    it('should not verify against the wrong public key', function() {
      var priv2 = ECKey.makeRandom()

      assert(!priv2.pub.verify(hash, signature))
    })
  })
})
