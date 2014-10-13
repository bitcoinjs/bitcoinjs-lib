var assert = require('assert')
var crypto = require('crypto')
var ecdsa = require('../src/ecdsa')
var ecurve = require('ecurve')
var networks = require('../src/networks')
var sinon = require('sinon')

var BigInteger = require('bigi')
var ECPair = require('../src/ecpair')

var fixtures = require('./fixtures/ecpair.json')

describe('ECPair', function() {
  describe('constructor', function() {
    it('defaults to compressed', function() {
      var keyPair = new ECPair(BigInteger.ONE)

      assert.equal(keyPair.compressed, true)
    })

    it('supports the uncompressed option', function() {
      var keyPair = new ECPair(BigInteger.ONE, null, {
        compressed: false
      })

      assert.equal(keyPair.compressed, false)
    })

    it('supports the network option', function() {
      var keyPair = new ECPair(BigInteger.ONE, null, {
        compressed: false,
        network: networks.testnet
      })

      assert.equal(keyPair.network, networks.testnet)
    })

    it('throws if compressed option is not a bool', function() {
      assert.throws(function() {
        new ECPair(null, null, {
          compressed: 2
        }, /Expected Boolean, got 2/)
      })
    })

    it('throws if network is missing pubKeyHash constants', function() {
      assert.throws(function() {
        new ECPair(null, null, {
          network: {}
        }, /Unknown pubKeyHash constants for network/)
      })
    })

    fixtures.valid.forEach(function(f) {
      it('calculates the public point for ' + f.WIF, function() {
        var d = new BigInteger(f.d)
        var keyPair = new ECPair(d, null, {
          compressed: f.compressed
        })

        assert.equal(keyPair.getPublicKeyBuffer().toString('hex'), f.Q)
      })
    })

    fixtures.invalid.constructor.forEach(function(f) {
      it('throws on ' + f.d, function() {
        var d = new BigInteger(f.d)

        assert.throws(function() {
          new ECPair(d)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('getPublicKeyBuffer', function() {
    var keyPair

    beforeEach(function() {
      keyPair = new ECPair(BigInteger.ONE)
    })

    it('wraps Q.getEncoded', sinon.test(function() {
      this.mock(keyPair.Q).expects('getEncoded')
        .once().calledWith(keyPair.compressed)

      keyPair.getPublicKeyBuffer()
    }))
  })

  describe('fromWIF', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.WIF + ' correctly', function() {
        var keyPair = ECPair.fromWIF(f.WIF)

        assert.equal(keyPair.d.toString(), f.d)
        assert.equal(keyPair.compressed, f.compressed)
        assert.equal(keyPair.network, networks[f.network])
      })
    })

    fixtures.invalid.fromWIF.forEach(function(f) {
      it('throws on ' + f.string, function() {
        assert.throws(function() {
          ECPair.fromWIF(f.string)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toWIF', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.WIF + ' correctly', function() {
        var keyPair = ECPair.fromWIF(f.WIF)
        var result = keyPair.toWIF()

        assert.equal(result, f.WIF)
      })
    })
  })

  describe('makeRandom', function() {
    var exWIF = 'KwMWvwRJeFqxYyhZgNwYuYjbQENDAPAudQx5VEmKJrUZcq6aL2pv'
    var exKeyPair = ECPair.fromWIF(exWIF)
    var exBuffer = exKeyPair.d.toBuffer(32)

    describe('uses default crypto RNG', function() {
      beforeEach(function() {
        sinon.stub(crypto, 'randomBytes').returns(exBuffer)
      })

      afterEach(function() {
        crypto.randomBytes.restore()
      })

      it('generates a ECPair', function() {
        var keyPair = ECPair.makeRandom()

        assert.equal(keyPair.toWIF(), exWIF)
      })

      it('passes the options param', sinon.test(function() {
        var options = { compressed: true }

        this.mock(ECPair).expects('constructor')
          .once().calledWith(options)

        ECPair.makeRandom(options)
      }))
    })

    it('allows a custom RNG to be used', function() {
      var keyPair = ECPair.makeRandom({
        rng: function(size) {
          return exBuffer.slice(0, size)
        }
      })

      assert.equal(keyPair.toWIF(), exWIF)
    })
  })

  describe('getAddress', function() {
    fixtures.valid.forEach(function(f) {
      it('returns ' + f.address + ' for ' + f.WIF, function() {
        var keyPair = ECPair.fromWIF(f.WIF)

        assert.equal(keyPair.getAddress().toString(), f.address)
      })
    })
  })

  describe('ecdsa wrappers', function() {
    var keyPair, hash

    beforeEach(function() {
      keyPair = ECPair.makeRandom()
      hash = new Buffer(32)
    })

    it('uses the secp256k1 curve by default', function() {
      var secp256k1 = ecurve.getCurveByName('secp256k1')

      for (var property in secp256k1) {
        // FIXME: circular structures in ecurve
        if (property === 'G') continue
        if (property === 'infinity') continue

        var actual = ECPair.curve[property]
        var expected = secp256k1[property]

        assert.deepEqual(actual, expected)
      }
    })

    describe('signing', function() {
      it('wraps ecdsa.sign', sinon.test(function() {
        this.mock(ecdsa).expects('sign')
          .once().calledWith(ECPair.curve, hash, keyPair.d)

        keyPair.sign(hash)
      }))

      it('throws if no private key is found', function() {
        keyPair.d = null

        assert.throws(function() {
          keyPair.sign(hash)
        }, /Missing private key/)
      })
    })

    describe('verify', function() {
      var signature

      beforeEach(function() {
        signature = keyPair.sign(hash)
      })

      it('wraps ecdsa.verify', sinon.test(function() {
        this.mock(ecdsa).expects('verify')
          .once().calledWith(ECPair.curve, hash, signature, keyPair.Q)

        keyPair.verify(hash, signature)
      }))
    })
  })
})
