var assert = require('assert')
var crypto = require('..').crypto
var networks = require('..').networks

var Address = require('../src/address.js')
var Script = require('../src/script.js')

function b2h(b) { return new Buffer(b).toString('hex') }
function h2b(h) { return new Buffer(h, 'hex') }

describe('Script', function() {
  var p2shScriptPubKey, pubKeyScriptPubKey, addressScriptSig

  beforeEach(function(){
    p2shScriptPubKey = "a914e8c300c87986efa84c37c0519929019ef86eb5b487"
    pubKeyScriptPubKey = "76a9145a3acbc7bbcc97c5ff16f5909c9d7d3fadb293a888ac"
    addressScriptSig = "48304502206becda98cecf7a545d1a640221438ff8912d9b505ede67e0138485111099f696022100ccd616072501310acba10feb97cecc918e21c8e92760cd35144efec7622938f30141040cd2d2ce17a1e9b2b3b2cb294d40eecf305a25b7e7bfdafae6bb2639f4ee399b3637706c3d377ec4ab781355add443ae864b134c5e523001c442186ea60f0eb8"

    // txid: 09dd94f2c85262173da87a745a459007bb1eed6eeb6bfa238a0cd91a16cf7790
    validMultisigScript = '5121032487c2a32f7c8d57d2a93906a6457afd00697925b0e6e145d89af6d3bca330162102308673d16987eaa010e540901cc6fe3695e758c19f46ce604e174dac315e685a52ae'

    // txid: 5e9be7fb36ee49ce84bee4c8ef38ad0efc0608b78dae1c2c99075297ef527890
    opreturnScript = '6a2606deadbeef03f895a2ad89fb6d696497af486cb7c644a27aa568c7a18dd06113401115185474'

    // asm: "0 0 0 OP_CHECKMULTISIG"
    invalidMultisigScript = '000000ae'

    // txid: a4bfa8ab6435ae5f25dae9d89e4eb67dfa94283ca751f393c1ddc5a837bbc31b
    nonStandardScript = 'aa206fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d619000000000087'
  })

  describe('constructor', function() {
    it('works for a byte array', function() {
      assert.ok(new Script([]))
    })

    it('works when nothing is passed in', function() {
      assert.ok(new Script())
    })

    it('throws an error when input is not an array', function() {
      assert.throws(function(){ new Script({}) })
    })
  })

  describe('fromHex/toHex', function() {
    it('matches the test data', function() {
      [
        p2shScriptPubKey,
        pubKeyScriptPubKey,
        addressScriptSig,
        validMultisigScript,
        opreturnScript,
        nonStandardScript,
        invalidMultisigScript
      ].forEach(function(hex) {
        assert.equal(Script.fromHex(hex).toHex(), hex)
      })
    })
  })

  describe('getOutType', function() {
    it('supports p2sh', function() {
      var script = Script.fromHex(p2shScriptPubKey)
      assert.equal(script.getOutType(), 'scripthash')
    })

    it('supports pubkeyhash', function() {
      var script = Script.fromHex(pubKeyScriptPubKey)
      assert.equal(script.getOutType(), 'pubkeyhash')
    })

    it('supports multisig', function() {
      var script = Script.fromHex(validMultisigScript)
      assert.equal(script.getOutType(), 'multisig')
    })

    it('supports null_data', function() {
      var script = Script.fromHex(opreturnScript)
      assert.equal(script.getOutType(), 'nulldata')
    })

    it('supports nonstandard script', function() {
      var script = Script.fromHex(nonStandardScript)
      assert.equal(script.getOutType(), 'nonstandard')
    })

    it('identifies invalid multisig script as nonstandard', function() {
      var script = Script.fromHex(invalidMultisigScript)
      assert.equal(script.getOutType(), 'nonstandard')
    })
  })

  describe('getInType', function() {
    it('works for address', function() {
      var script = Script.fromHex(addressScriptSig)
      assert.equal(script.getInType(), 'pubkeyhash')
    })
  })

  describe('pay-to-pubKeyHash', function() {
    it('matches the test data', function() {
      var address = Address.fromBase58Check('19E6FV3m3kEPoJD5Jz6dGKdKwTVvjsWUvu')
      var script = Script.createPubKeyHashScriptPubKey(address.hash)

      assert.equal(script.toHex(), pubKeyScriptPubKey)
    })
  })

  describe('pay-to-scriptHash', function() {
    it('matches the test data', function() {
      var hash = new Buffer('e8c300c87986efa84c37c0519929019ef86eb5b4', 'hex')
      var script = Script.createP2SHScriptPubKey(hash)

      assert.equal(script.toHex(), p2shScriptPubKey)
    })
  })

  describe('2-of-3 Multi-Signature', function() {
    var pubKeys

    beforeEach(function() {
      pubKeys = [
        '02ea1297665dd733d444f31ec2581020004892cdaaf3dd6c0107c615afb839785f',
        '02fab2dea1458990793f56f42e4a47dbf35a12a351f26fa5d7e0cc7447eaafa21f',
        '036c6802ce7e8113723dd92cdb852e492ebb157a871ca532c3cb9ed08248ff0e19'
      ].map(h2b)
    })

    it('should create valid redeemScript', function() {
      var redeemScript = Script.createMultisigScriptPubKey(2, pubKeys)

      var hash160 = crypto.hash160(redeemScript.buffer)
      var multisigAddress = new Address(hash160, networks.bitcoin.scriptHash)

      assert.equal(multisigAddress.toString(), '32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
    })
  })

  describe('2-of-2 Multisig scriptSig', function() {
    var pubKeys = [
      '02359c6e3f04cefbf089cf1d6670dc47c3fb4df68e2bad1fa5a369f9ce4b42bbd1',
      '0395a9d84d47d524548f79f435758c01faec5da2b7e551d3b8c995b7e06326ae4a'
    ].map(h2b)
    var signatures = [
      '304402207515cf147d201f411092e6be5a64a6006f9308fad7b2a8fdaab22cd86ce764c202200974b8aca7bf51dbf54150d3884e1ae04f675637b926ec33bf75939446f6ca2801',
      '3045022100ef253c1faa39e65115872519e5f0a33bbecf430c0f35cf562beabbad4da24d8d02201742be8ee49812a73adea3007c9641ce6725c32cd44ddb8e3a3af460015d140501'
    ].map(h2b)
    var expected = '0047304402207515cf147d201f411092e6be5a64a6006f9308fad7b2a8fdaab22cd86ce764c202200974b8aca7bf51dbf54150d3884e1ae04f675637b926ec33bf75939446f6ca2801483045022100ef253c1faa39e65115872519e5f0a33bbecf430c0f35cf562beabbad4da24d8d02201742be8ee49812a73adea3007c9641ce6725c32cd44ddb8e3a3af460015d14050147522102359c6e3f04cefbf089cf1d6670dc47c3fb4df68e2bad1fa5a369f9ce4b42bbd1210395a9d84d47d524548f79f435758c01faec5da2b7e551d3b8c995b7e06326ae4a52ae'

    it('should create a valid P2SH multisig scriptSig', function() {
      var redeemScript = Script.createMultisigScriptPubKey(2, pubKeys)
      var actual = Script.createP2SHMultisigScriptSig(signatures, redeemScript)

      assert.equal(b2h(actual.buffer), expected)
    })
  })
})
