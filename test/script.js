var assert = require('assert')
var crypto = require('../src/crypto')
var networks = require('../src/networks')
var opcodes = require('../src/opcodes')

var Address = require('../src/address')
var ECPubKey = require('../src/ecpubkey')
var Script = require('../src/script')

var fixtures = require('./fixtures/script.json')

function b2h(b) { return new Buffer(b).toString('hex') }
function h2b(h) { return new Buffer(h, 'hex') }

describe('Script', function() {
  describe('constructor', function() {
    it('works for a byte array', function() {
      assert.ok(new Script([]))
    })

    it('works when nothing is passed in', function() {
      assert.ok(new Script())
    })

    it('throws an error when input is not an array', function() {
      assert.throws(function(){ new Script({}) }, /Expected Array, got/)
    })
  })

  describe('fromHex/toHex', function() {
    fixtures.valid.forEach(function(f) {
      it('decodes/encodes ' + f.description, function() {
        assert.equal(Script.fromHex(f.hex).toHex(), f.hex)
      })
    })
  })

  describe('getHash', function() {
    fixtures.valid.forEach(function(f) {
      it('produces a HASH160 of \"' + f.asm + '\"', function() {
        var script = Script.fromHex(f.hex)

        assert.equal(script.getHash().toString('hex'), f.hash)
      })
    })
  })

  describe('getInType', function() {
    fixtures.valid.forEach(function(f) {
      if (!f.scriptPubKey) {
        it('supports ' + f.description, function() {
          var script = Script.fromHex(f.hex)

          assert.equal(script.getInType(), f.type)
        })
      }
    })
  })

  describe('getOutType', function() {
    fixtures.valid.forEach(function(f) {
      if (f.scriptPubKey) {
        it('supports ' + f.description, function() {
          var script = Script.fromHex(f.hex)

          assert.equal(script.getOutType(), f.type)
        })
      }
    })
  })

  describe('pay-to-pubKeyHash', function() {
    it('matches the test data', function() {
      // FIXME: bad
      var f = fixtures.valid[2]
      var address = Address.fromBase58Check('19E6FV3m3kEPoJD5Jz6dGKdKwTVvjsWUvu')
      var script = Script.createPubKeyHashScriptPubKey(address.hash)

      assert.equal(script.toHex(), f.hex)
    })
  })

  describe('pay-to-pubkey', function() {
    it('matches the test data', function() {
      // FIXME: bad
      var f = fixtures.valid[0]
      var pubKey = ECPubKey.fromHex(f.pubKey)
      var script = Script.createPubKeyScriptPubKey(pubKey)

      assert.equal(script.toHex(), f.hex)
    })
  })

  describe('pay-to-scriptHash', function() {
    it('matches the test data', function() {
      // FIXME: bad
      var f = fixtures.valid[1]
      var address = Address.fromBase58Check('3NukJ6fYZJ5Kk8bPjycAnruZkE5Q7UW7i8')
      var script = Script.createP2SHScriptPubKey(address.hash)

      assert.equal(script.toHex(), f.hex)
    })
  })

  describe('2-of-3 Multi-Signature scriptPubKey', function() {
    var pubKeys

    beforeEach(function() {
      pubKeys = [
        '02ea1297665dd733d444f31ec2581020004892cdaaf3dd6c0107c615afb839785f',
        '02fab2dea1458990793f56f42e4a47dbf35a12a351f26fa5d7e0cc7447eaafa21f',
        '036c6802ce7e8113723dd92cdb852e492ebb157a871ca532c3cb9ed08248ff0e19'
      ].map(ECPubKey.fromHex)
    })

    it('should create valid redeemScript', function() {
      var redeemScript = Script.createMultisigScriptPubKey(2, pubKeys)

      var hash160 = crypto.hash160(new Buffer(redeemScript.buffer))
      var multisigAddress = new Address(hash160, networks.bitcoin.scriptHash)

      assert.equal(multisigAddress.toString(), '32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
    })

    it('should throw on not enough pubKeys provided', function() {
      assert.throws(function() {
        Script.createMultisigScriptPubKey(4, pubKeys)
      }, /Not enough pubKeys provided/)
    })
  })

  describe('2-of-2 Multisig scriptSig', function() {
    var pubKeys = [
      '02359c6e3f04cefbf089cf1d6670dc47c3fb4df68e2bad1fa5a369f9ce4b42bbd1',
      '0395a9d84d47d524548f79f435758c01faec5da2b7e551d3b8c995b7e06326ae4a'
    ].map(ECPubKey.fromHex)
    var signatures = [
      '304402207515cf147d201f411092e6be5a64a6006f9308fad7b2a8fdaab22cd86ce764c202200974b8aca7bf51dbf54150d3884e1ae04f675637b926ec33bf75939446f6ca2801',
      '3045022100ef253c1faa39e65115872519e5f0a33bbecf430c0f35cf562beabbad4da24d8d02201742be8ee49812a73adea3007c9641ce6725c32cd44ddb8e3a3af460015d140501'
    ].map(h2b)
    var expected = '0047304402207515cf147d201f411092e6be5a64a6006f9308fad7b2a8fdaab22cd86ce764c202200974b8aca7bf51dbf54150d3884e1ae04f675637b926ec33bf75939446f6ca2801483045022100ef253c1faa39e65115872519e5f0a33bbecf430c0f35cf562beabbad4da24d8d02201742be8ee49812a73adea3007c9641ce6725c32cd44ddb8e3a3af460015d14050147522102359c6e3f04cefbf089cf1d6670dc47c3fb4df68e2bad1fa5a369f9ce4b42bbd1210395a9d84d47d524548f79f435758c01faec5da2b7e551d3b8c995b7e06326ae4a52ae'

    it('should create a valid P2SH multisig scriptSig', function() {
      var redeemScript = Script.createMultisigScriptPubKey(2, pubKeys)
      var redeemScriptSig = Script.createMultisigScriptSig(signatures)

      var scriptSig = Script.createP2SHScriptSig(redeemScriptSig, redeemScript)

      assert.equal(b2h(scriptSig.buffer), expected)
    })

    it('should throw on not enough signatures', function() {
      var redeemScript = Script.createMultisigScriptPubKey(2, pubKeys)

      assert.throws(function() {
        Script.createMultisigScriptSig(signatures.slice(1), redeemScript)
      }, /Not enough signatures provided/)
    })
  })

  describe('fromChunks', function() {
    it('should match expected behaviour', function() {
      var hash = new Buffer(32)
      var script = Script.fromChunks([
        opcodes.OP_HASH160,
        hash,
        opcodes.OP_EQUAL
      ])

      assert.deepEqual(script, Script.createP2SHScriptPubKey(hash))
    })
  })

  describe('without', function() {
    var hex = 'a914e8c300c87986efa94c37c0519929019ef86eb5b487'
    var script = Script.fromHex(hex)

    it('should return a script without the given value', function() {
      var subScript = script.without(opcodes.OP_HASH160)

      assert.equal(subScript.toHex(), '14e8c300c87986efa94c37c0519929019ef86eb5b487')
    })

    it('shouldnt mutate the original script', function() {
      var subScript = script.without(opcodes.OP_EQUAL)

      assert.notEqual(subScript.toHex(), hex)
      assert.equal(script.toHex(), hex)
    })
  })
})
