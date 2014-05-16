var assert = require('assert')
var networks = require('../src/networks')

var ECKey = require('../src/eckey')
var Message = require('../src/message')

var fixtures = require('./fixtures/message')

describe('Message', function() {
  var message

  beforeEach(function() {
    message = 'vires is numeris'
  })

  describe('magicHash', function() {
    it('matches the test vectors', function() {
      fixtures.magicHash.forEach(function(f) {
        var actual = Message.magicHash(f.message)
        var expected = f.hash256

        assert.equal(actual.toString('hex'), expected)
      })
    })
  })

  describe('verify', function() {
    var addr, sig, caddr, csig

    beforeEach(function() {
      addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM' // uncompressed
      caddr = '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs' // compressed

      sig = new Buffer('1bc25ac0fb503abc9bad23f558742740fafaec1f52deaaf106b9759a5ce84c93921c4a669c5ec3dfeb7e2d7d177a2f49db407900874f6de2f701a4c16783776d8d', 'hex')
      csig = new Buffer('1fc25ac0fb503abc9bad23f558742740fafaec1f52deaaf106b9759a5ce84c93921c4a669c5ec3dfeb7e2d7d177a2f49db407900874f6de2f701a4c16783776d8d', 'hex')
    })

    it('can verify a signed message', function() {
      assert.ok(Message.verify(addr, sig, message))
      assert.ok(Message.verify(caddr, csig, message))
    })

    it('will fail for the wrong message', function() {
      assert.ok(!Message.verify(addr, sig, 'foobar'))
      assert.ok(!Message.verify(caddr, csig, 'foobar'))
    })

    it('will fail for the wrong public key', function() {
      assert.ok(!Message.verify('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a', sig, message))
      assert.ok(!Message.verify('1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9', csig, message))
    })

    it('supports alternate network addresses', function() {
      var taddr = 'mxnQZKxSKjzaMgrdXzk35rif3u62TLDrg9'
      var tsig = new Buffer('IGucnrTku3KLCCHUMwq9anawfrlN8RK1HWMN+10LhsHJeysBdWfj5ohJcS/+oqrlVFNvEgbgEeAQUL6r3sZwnj8=', 'base64')

      assert.ok(Message.verify(taddr, tsig, message))
      assert.ok(!Message.verify(taddr, tsig, 'foobar'))
    })

    it('does not cross verify (compressed/uncompressed)', function() {
      assert.ok(!Message.verify(addr, csig, message))
      assert.ok(!Message.verify(caddr, sig, message))
    })
  })

  describe('signing', function() {
    it('gives matching signatures irrespective of point compression', function() {
      var privKey = ECKey.makeRandom(false)
      var compressedKey = new ECKey(privKey.D, true)

      var sig = Message.sign(privKey, message)
      var csig = Message.sign(compressedKey, message)

      assert.notDeepEqual(sig.slice(0, 2), csig.slice(0, 2)) // unequal compression flags
      assert.deepEqual(sig.slice(2), csig.slice(2)) // equal signatures
    })
  })
})
