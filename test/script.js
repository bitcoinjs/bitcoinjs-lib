var Script = require('../src/script.js')
var assert = require('assert')
var Address = require('../src/address.js')
var Network = require('../src/network.js')
var crypto = require('../').crypto
var Convert = require('../src/convert.js')
var bytesToHex = Convert.bytesToHex
var hexToBytes = Convert.hexToBytes

describe('Script', function() {
  var p2shScriptPubKey, pubkeyScriptPubkey, addressScriptSig

  beforeEach(function(){
    p2shScriptPubKey = "a914e8c300c87986efa84c37c0519929019ef86eb5b487"
    pubkeyScriptPubKey = "76a9145a3acbc7bbcc97c5ff16f5909c9d7d3fadb293a888ac"
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

  describe('getOutType', function() {
    it('supports p2sh', function() {
      var script = Script.fromHex(p2shScriptPubKey)
      assert.equal(script.getOutType(), 'scripthash')
    })

    it('supports pubkeyhash', function() {
      var script = Script.fromHex(pubkeyScriptPubKey)
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

  describe('getToAddress', function() {
    it('works for p2sh type output', function() {
      var script = Script.fromHex(p2shScriptPubKey)
      assert.equal(script.getToAddress().toString(), '3NukJ6fYZJ5Kk8bPjycAnruZkE5Q7UW7i8')
    })

    it('works for pubkey type output', function() {
      var script = Script.fromHex(pubkeyScriptPubKey)
      assert.equal(script.getToAddress().toString(), '19E6FV3m3kEPoJD5Jz6dGKdKwTVvjsWUvu')
    })
  })

  describe('getFromAddress', function() {
    it('works for address type input', function() {
      var script = Script.fromHex(addressScriptSig)
      assert.equal(script.getFromAddress().toString(), '1BBjuhF2jHxu7tPinyQGCuaNhEs6f5u59u')
    })
  })

  describe('2-of-3 Multi-Signature', function() {
    var compressedPubKeys = []
    var numSigs, script, multisig, network

    beforeEach(function() {
      compressedPubKeys = ['02ea1297665dd733d444f31ec2581020004892cdaaf3dd6c0107c615afb839785f',
        '02fab2dea1458990793f56f42e4a47dbf35a12a351f26fa5d7e0cc7447eaafa21f',
        '036c6802ce7e8113723dd92cdb852e492ebb157a871ca532c3cb9ed08248ff0e19']
        numSigs = 2
        network = Network.mainnet.p2shVersion
    })

    it('should create valid multi-sig address', function() {
      script = Script.createMultiSigOutputScript(numSigs, compressedPubKeys.map(hexToBytes))
      multisig = crypto.hash160(script.buffer)
      var multiSigAddress = Address(multisig, network).toString()

      assert.ok(Address.validate(multiSigAddress))
      assert.equal(Address.getVersion(multiSigAddress), Network.mainnet.p2shVersion)
      assert.equal(multiSigAddress,'32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
    })

    it('should create valid redeemScript', function() {
      var redeemScript = script.buffer
      var deserialized = new Script(redeemScript)
      var numOfSignatures = deserialized.chunks[deserialized.chunks.length - 2] - 80
      var signaturesRequired = deserialized.chunks[0] - 80
      var sigs = [
        bytesToHex(deserialized.chunks[1]),
        bytesToHex(deserialized.chunks[2]),
        bytesToHex(deserialized.chunks[3])
      ]

      assert.equal(numOfSignatures, 3)
      assert.equal(signaturesRequired, 2)
      assert.equal(sigs[0], '02ea1297665dd733d444f31ec2581020004892cdaaf3dd6c0107c615afb839785f')
      assert.equal(sigs[1], '02fab2dea1458990793f56f42e4a47dbf35a12a351f26fa5d7e0cc7447eaafa21f')
      assert.equal(sigs[2], '036c6802ce7e8113723dd92cdb852e492ebb157a871ca532c3cb9ed08248ff0e19')
      assert.equal(Address(crypto.hash160(redeemScript), network).toString(), '32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
    })
  })
})
