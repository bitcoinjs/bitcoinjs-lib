var Script = require('../src/script.js')
var assert = require('assert')
var Address = require('../src/address.js')
var Network = require('../src/network.js')
var crypto = require('../').crypto
var Convert = require('../src/convert.js')
var Transaction = require('../src/transaction.js')
var bytesToHex = Convert.bytesToHex
var hexToBytes = Convert.hexToBytes

describe('Script', function() {
  var p2shScriptPubKey, pubkeyScriptPubKey, addressScriptSig

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
      compressedPubKeys = ['02b685e778aff13e5bc660543a1d3948ece99c808446251a32f48bb6f82ca8fb46',
          '03f0c62dc8f914090d46e735da87b7ec44a8022ee47137083cb26dbfdfb1526a3f',
          '035d7fdff7601affab9adac3ad2e05d9ff12c0852c071874693e1d5608efa4a317'
        ]
        numSigs = 2
        network = Network.mainnet.p2shVersion
        script = Script.createMultiSigOutputScript(numSigs, compressedPubKeys.map(hexToBytes))
    })

    it('should create valid multi-sig address', function() {
      multisig = crypto.hash160(script.buffer)
      var multiSigAddress = Address(multisig, network).toString()

      assert.ok(Address.validate(multiSigAddress))
      assert.equal(Address.getVersion(multiSigAddress), Network.mainnet.p2shVersion)
      assert.equal(multiSigAddress,'3FScAVa7ZPHrN7X911q3cnqKgMCidN5ykK')
    })

    it('should create valid redeemScript', function() {
      var redeemScript = script.buffer
      var deserialized = new Script(redeemScript)
      var numOfPubKeys = deserialized.chunks[deserialized.chunks.length - 2] - 80
      var signaturesRequired = deserialized.chunks[0] - 80
      var pubKeys = [
        bytesToHex(deserialized.chunks[1]),
        bytesToHex(deserialized.chunks[2]),
        bytesToHex(deserialized.chunks[3])
      ]

      assert.equal(numOfPubKeys, 3)
      assert.equal(signaturesRequired, 2)
      assert.equal(pubKeys[0], compressedPubKeys[0])
      assert.equal(pubKeys[1], compressedPubKeys[1])
      assert.equal(pubKeys[2], compressedPubKeys[2])
      assert.equal(Address(crypto.hash160(redeemScript), network).toString(), '3FScAVa7ZPHrN7X911q3cnqKgMCidN5ykK')
    })

    it('should create and sign multisig input', function(){
      //TESTNET
      var testnetPubKeys = ['023f7b3dc5b1e2fda2e1608e36e7e9e6c5e611ee18e522b942cd07210c787133aa',
          '024f30f51041bcaab327ffa3ece49a37deb28dd97542f5a2ff12b250d1d896b371',
          '03b9b9bdd7f057075c1a55653287b1a1ab9cc772c63b738b367893d59aaf4b1265'
      ]

      var script = Script.createMultiSigOutputScript(2, testnetPubKeys.map(hexToBytes))
      var redeemScript = new Script(script.buffer)
      var signaturesRequired = redeemScript.chunks[0] - 80
      var tx = Transaction.Transaction()

      tx.addInput('892a14296bed2be5e408f0fc39665d620815599b20f408f13fe7b2ada50fe432:0')
      tx.addOutput('mvSTauyk761goSWMVkDDjE68zBP3CJNVmv',900000)
      var signatures = [tx.p2shsign(0,redeemScriptcript.buffer,'e1fdbcc3a4fbfd432d45af7ae0bd9983e978d467c39ca9c14aef5789a7a683f7')]

      tx.applyMultisigs(0,redeemScript.buffer,signatures[0])

      assert.equal(signaturesRequired,2)
      assert.equal(tx.ins[0].script,false)
    })
  })
})