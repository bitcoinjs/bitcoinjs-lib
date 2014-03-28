var Script = require('../src/script.js')
var assert = require('assert')
var Address = require('../src/address.js')

var Util = require('../src/util.js')
var sha256ripe160 = Util.sha256ripe160;

var Convert = require('../src/convert.js')
var bytesToHex = Convert.bytesToHex;
var hexToBytes = Convert.hexToBytes; 

describe('Script', function() {
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
  
  describe('2-of-3 Multi-Signature', function() {
    var compressedPubKeys = [];
    var numSigs, script, multisig, network

    beforeEach(function() {
      compressedPubKeys = ['02ea1297665dd733d444f31ec2581020004892cdaaf3dd6c0107c615afb839785f',
                           '02fab2dea1458990793f56f42e4a47dbf35a12a351f26fa5d7e0cc7447eaafa21f',
                           '036c6802ce7e8113723dd92cdb852e492ebb157a871ca532c3cb9ed08248ff0e19']
                           
      numSigs = 2
    })

    it('should create valid multi-sig address', function() {
      network = 0x05 //mainnet
      script = Script.createMultiSigOutputScript(numSigs,compressedPubKeys.map(hexToBytes))
      multisig = sha256ripe160(script.buffer)
      var multiSigAddress = Address(multisig,network).toString()
     
      assert.ok(Address.validate(multiSigAddress))
      assert.equal(Address.getVersion(multiSigAddress),'0x05')
      assert.equal(multiSigAddress,'32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
    })
  
    it('should create valid redeemScript', function() {
      var redeemScript = script.buffer
      var deserialized = new Script(redeemScript)
      var numOfSignatures = deserialized.chunks[deserialized.chunks.length-2]-80
      var signaturesRequired = deserialized.chunks[0]-80
      var sigs = [bytesToHex(deserialized.chunks[1]), bytesToHex(deserialized.chunks[2]), 
                  bytesToHex(deserialized.chunks[3])]
      
      assert.equal(numOfSignatures,3)
      assert.equal(signaturesRequired,2)
      assert.equal(sigs[0],'02ea1297665dd733d444f31ec2581020004892cdaaf3dd6c0107c615afb839785f')
      assert.equal(sigs[1],'02fab2dea1458990793f56f42e4a47dbf35a12a351f26fa5d7e0cc7447eaafa21f')
      assert.equal(sigs[2],'036c6802ce7e8113723dd92cdb852e492ebb157a871ca532c3cb9ed08248ff0e19')
      assert.equal(Address(sha256ripe160(redeemScript),network).toString(),
        '32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
    })
  })
})
