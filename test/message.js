var assert = require('assert')
var networks = require('../src/networks')

var BigInteger = require('bigi')
var ECKey = require('../src/eckey')
var Message = require('../src/message')

var fixtures = require('./fixtures/message.json')

describe('Message', function() {
  var message

  beforeEach(function() {
    message = 'vires is numeris'
  })

  describe('magicHash', function() {
    it('matches the test vectors', function() {
      fixtures.magicHash.forEach(function(f) {
        var network = networks[f.network]
        var actual = Message.magicHash(f.message, network)

        assert.equal(actual.toString('hex'), f.magicHash)
      })
    })
  })

  describe('verify', function() {
    var addr, sig, caddr, csig

    beforeEach(function() {
      addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM' // uncompressed
      caddr = '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs' // compressed

      sig = new Buffer('G8JawPtQOrybrSP1WHQnQPr67B9S3qrxBrl1mlzoTJOSHEpmnF7D3+t+LX0Xei9J20B5AIdPbeL3AaTBZ4N3bY0=', 'base64')
      csig = new Buffer('H8JawPtQOrybrSP1WHQnQPr67B9S3qrxBrl1mlzoTJOSHEpmnF7D3+t+LX0Xei9J20B5AIdPbeL3AaTBZ4N3bY0=', 'base64')
    })

    it('can verify a signed message', function() {
      assert.ok(Message.verify(addr, sig, message))
    })

    it('will fail for the wrong message', function() {
      assert.ok(!Message.verify(addr, sig, 'foobar'))
    })

    it('will fail for the wrong address', function() {
      assert.ok(!Message.verify('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a', sig, message))
    })

    it('does not cross verify (compressed/uncompressed)', function() {
      assert.ok(!Message.verify(addr, csig, message))
      assert.ok(!Message.verify(caddr, sig, message))
    })

    it('supports alternate networks', function() {
      var dogeaddr = 'DFpN6QqFfUm3gKNaxN6tNcab1FArL9cZLE'
      var dogesig = new Buffer('H6k+dZwJ8oOei3PCSpdj603fDvhlhQ+sqaFNIDvo/bI+Xh6zyIKGzZpyud6YhZ1a5mcrwMVtTWL+VXq/hC5Zj7s=', 'base64')

      assert.ok(Message.verify(dogeaddr, dogesig, message, networks.dogecoin))
    })
  })

  describe('signing', function() {
    it('gives matching signatures irrespective of point compression', function() {
      var privKey = new ECKey(BigInteger.ONE, false)
      var compressedKey = new ECKey(privKey.D, true)

      var sig = Message.sign(privKey, message)
      var csig = Message.sign(compressedKey, message)

      assert.notDeepEqual(sig.slice(0, 2), csig.slice(0, 2)) // unequal compression flags
      assert.deepEqual(sig.slice(2), csig.slice(2)) // equal signatures
    })

    it('supports alternate networks', function() {
      var privKey = new ECKey(BigInteger.ONE)
      var signature = Message.sign(privKey, message, networks.dogecoin)

      assert.equal(signature.toString('base64'), 'H6k+dZwJ8oOei3PCSpdj603fDvhlhQ+sqaFNIDvo/bI+Xh6zyIKGzZpyud6YhZ1a5mcrwMVtTWL+VXq/hC5Zj7s=')
    })
  })
})
