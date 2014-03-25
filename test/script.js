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
    var compressedPubKeys = []
    var numSigs

    beforeEach(function() {
      compressedPubKeys = ['02ea1297665dd733d444f31ec2581020004892cdaaf3dd6c0107c615afb839785f',
                           '02fab2dea1458990793f56f42e4a47dbf35a12a351f26fa5d7e0cc7447eaafa21f',
                           '036c6802ce7e8113723dd92cdb852e492ebb157a871ca532c3cb9ed08248ff0e19']
                           
      numSigs = 2;
    })

    it('should create valid multi-sig address', function() {
      var network = 0x05 //mainnet
      var script = Script.createMultiSigOutputScript(numSigs,compressedPubKeys.map(hexToBytes))
      var multisig = sha256ripe160(script.buffer)
      var multiSigAddress = Address(multisig,network).toString()
      var redeemScript = bytesToHex(script.buffer)
     
      assert.ok(Address.validate(multiSigAddress))
      assert.equal(Address.getVersion(multiSigAddress),'0x05')
      assert.equal(multiSigAddress,'32vYjxBb7pHJJyXgNk8UoK3BdRDxBzny2v')
      assert.equal(Address(sha256ripe160(hexToBytes(redeemScript)),network).toString(),
        multiSigAddress)     
    })

  })
})
