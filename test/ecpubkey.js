var assert = require('assert')
var crypto = require('../src/crypto')
var sec = require('../src/sec')
var ecparams = sec('secp256k1')

var BigInteger = require('bigi')
var ECPointFp = require('../src/ec').ECPointFp
var ECPubKey = require('../src/ecpubkey')

var fixtures = require('./fixtures/ecpubkey')

describe('ECPubKey', function() {
  var Q

  beforeEach(function() {
    var curve = ecparams.getCurve()

    Q = new ECPointFp(
      curve,
      curve.fromBigInteger(new BigInteger(fixtures.Q.x)),
      curve.fromBigInteger(new BigInteger(fixtures.Q.y))
    )
  })

  describe('constructor', function() {
    it('defaults to compressed', function() {
      var pubKey = new ECPubKey(Q)

      assert.equal(pubKey.compressed, true)
    })

    it('supports the uncompressed flag', function() {
      var pubKey = new ECPubKey(Q, false)

      assert.equal(pubKey.compressed, false)
    })
  })

  describe('fromHex/toHex', function() {
    it('supports compressed points', function() {
      var pubKey = ECPubKey.fromHex(fixtures.compressed.hex)

      assert(pubKey.Q.equals(Q))
      assert.equal(pubKey.toHex(), fixtures.compressed.hex)
      assert.equal(pubKey.compressed, true)
    })

    it('supports uncompressed points', function() {
      var pubKey = ECPubKey.fromHex(fixtures.uncompressed.hex)

      assert(pubKey.Q.equals(Q))
      assert.equal(pubKey.toHex(), fixtures.uncompressed.hex)
      assert.equal(pubKey.compressed, false)
    })
  })

  describe('getAddress', function() {
    it('calculates the expected hash (compressed)', function() {
      var pubKey = new ECPubKey(Q, true)
      var address = pubKey.getAddress()

      assert.equal(address.hash.toString('hex'), fixtures.compressed.hash160)
    })

    it('calculates the expected hash (uncompressed)', function() {
      var pubKey = new ECPubKey(Q, false)
      var address = pubKey.getAddress()

      assert.equal(address.hash.toString('hex'), fixtures.uncompressed.hash160)
    })

    it('supports alternative networks', function() {
      var pubKey = new ECPubKey(Q)
      var address = pubKey.getAddress(0x09)

      assert.equal(address.version, 0x09)
      assert.equal(address.hash.toString('hex'), fixtures.compressed.hash160)
    })
  })

  describe('verify', function() {
    var pubKey, signature
    beforeEach(function() {
      pubKey = new ECPubKey(Q)

      signature = {
        r: new BigInteger(fixtures.signature.r),
        s: new BigInteger(fixtures.signature.s)
      }
    })

    it('verifies a valid signature', function() {
      var hash = crypto.sha256(fixtures.message)

      assert.ok(pubKey.verify(hash, signature))
    })

    it('doesn\'t verify the wrong signature', function() {
      var hash = crypto.sha256('mushrooms')

      assert.ok(!pubKey.verify(hash, signature))
    })
  })
})
