var assert = require('assert')
var convert = require('../').convert
var ECKey = require('../src/eckey').ECKey
var Message = require('../').Message
var testnet = require('../').network.testnet.addressVersion

describe('Message', function() {
  var msg

  beforeEach(function() {
    msg = 'vires is numeris'
  })

  describe('verify', function() {
    var addr, sig, caddr, csig

    beforeEach(function() {
      addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM' // uncompressed
      caddr = '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs' // compressed

      sig = convert.hexToBytes('1bc25ac0fb503abc9bad23f558742740fafaec1f52deaaf106b9759a5ce84c93921c4a669c5ec3dfeb7e2d7d177a2f49db407900874f6de2f701a4c16783776d8d')
      csig = convert.hexToBytes('1fc25ac0fb503abc9bad23f558742740fafaec1f52deaaf106b9759a5ce84c93921c4a669c5ec3dfeb7e2d7d177a2f49db407900874f6de2f701a4c16783776d8d')
    })

    it('can verify a signed message', function() {
      assert.ok(Message.verify(addr, sig, msg))
      assert.ok(Message.verify(caddr, csig, msg))
    })

    it('will fail for the wrong message', function() {
      assert.ok(!Message.verify(addr, sig, 'foobar'))
      assert.ok(!Message.verify(caddr, csig, 'foobar'))
    })

    it('will fail for the wrong public key', function() {
      assert.ok(!Message.verify('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a', sig, msg))
      assert.ok(!Message.verify('1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9', csig, msg))
    })

    it('supports alternate network addresses', function() {
      var taddr = 'mxnQZKxSKjzaMgrdXzk35rif3u62TLDrg9'
      var tsig = convert.base64ToBytes('IGucnrTku3KLCCHUMwq9anawfrlN8RK1HWMN+10LhsHJeysBdWfj5ohJcS/+oqrlVFNvEgbgEeAQUL6r3sZwnj8=')

      assert.ok(Message.verify(taddr, tsig, msg))
      assert.ok(!Message.verify(taddr, tsig, 'foobar'))
    })

    it('does not cross verify (compressed/uncompressed)', function() {
      assert.ok(!Message.verify(addr, csig, msg))
      assert.ok(!Message.verify(caddr, sig, msg))
    })
  })

  describe('signing', function() {
    describe('using the uncompressed public key', function(){
      it('gives same signature as a compressed public key', function() {
        var key = new ECKey(null) // uncompressed
        var sig = Message.sign(key, msg)

        var compressedKey = new ECKey(key, true) // compressed clone
        var csig = Message.sign(compressedKey, msg) // FIXME: bad compression support

        var addr = key.getPub().getAddress()
        var caddr = compressedKey.getPub().getAddress()
        assert.ok(Message.verify(addr, sig, msg))
        assert.ok(Message.verify(caddr, csig, msg))
        assert.notDeepEqual(sig.slice(0, 2), csig.slice(0, 2)) // unequal compression flags
        assert.deepEqual(sig.slice(2), csig.slice(2)) // equal signatures
      })
    })

    describe('testnet address', function(){
      it('works', function(){
        var key = new ECKey(null)
        var sig = Message.sign(key, msg)

        var addr = key.getAddress(testnet)
        assert(Message.verify(addr, sig, msg))
      })
    })
  })
})
