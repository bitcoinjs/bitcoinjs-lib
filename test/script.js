var Script = require('../src/script.js')
var assert = require('assert')
var Address = require('../src/address.js')
var Network = require('../src/network.js')
var Util = require('../src/util.js')
var sha256ripe160 = Util.sha256ripe160
var Convert = require('../src/convert.js')
var bytesToHex = Convert.bytesToHex
var hexToBytes = Convert.hexToBytes

describe('Script', function() {
  var p2shScriptPubKey, pubkeyScriptPubkey, addressScriptSig

  beforeEach(function(){
    p2shScriptPubKey = "a914e8c300c87986efa84c37c0519929019ef86eb5b487"
    pubkeyScriptPubKey = "76a9145a3acbc7bbcc97c5ff16f5909c9d7d3fadb293a888ac"
    addressScriptSig = "48304502206becda98cecf7a545d1a640221438ff8912d9b505ede67e0138485111099f696022100ccd616072501310acba10feb97cecc918e21c8e92760cd35144efec7622938f30141040cd2d2ce17a1e9b2b3b2cb294d40eecf305a25b7e7bfdafae6bb2639f4ee399b3637706c3d377ec4ab781355add443ae864b134c5e523001c442186ea60f0eb8"
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
    it('works for p2sh', function() {
      var script = Script.fromHex(p2shScriptPubKey)
      assert.equal(script.getOutType(), 'P2SH')
    })

    it('works for pubkey', function() {
      var script = Script.fromHex(pubkeyScriptPubKey)
      assert.equal(script.getOutType(), 'Pubkey')
    })
  })

  describe('getInType', function() {
    it('works for address', function() {
      var script = Script.fromHex(addressScriptSig)
      assert.equal(script.getInType(), 'Address')
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
      multisig = sha256ripe160(script.buffer)
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
      assert.equal(Address(sha256ripe160(redeemScript), network).toString(), '32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
    })
  })
})
