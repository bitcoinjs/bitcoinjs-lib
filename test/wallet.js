var Wallet = require('../src/wallet.js')
var HDNode = require('../src/hdwallet.js')
var convert = require('../src/convert.js')
var assert = require('assert')
var SHA256 = require('crypto-js/sha256')
var Crypto = require('crypto-js')

describe('Wallet', function() {
  var seed, wallet;
  beforeEach(function(){
    seed = convert.wordArrayToBytes(SHA256("don't use a string seed like this in real life"))
    wallet = new Wallet(seed)
  })

  describe('constructor', function() {
    it('defaults to Bitcoin mainnet', function() {
      assert.equal(wallet.getMasterKey().network, 'mainnet')
    })

    it("generates m/0' as the main account", function() {
      var mainAccount = wallet.getAccountZero()
      assert.equal(mainAccount.index, 0 + HDNode.HIGHEST_BIT)
      assert.equal(mainAccount.depth, 1)
    })

    it("generates m/0'/0 as the external account", function() {
      var account = wallet.getExternalAccount()
      assert.equal(account.index, 0)
      assert.equal(account.depth, 2)
    })

    it("generates m/0'/1 as the internal account", function() {
      var account = wallet.getInternalAccount()
      assert.equal(account.index, 1)
      assert.equal(account.depth, 2)
    })

    describe('when seed is not specified', function(){
      it('generates a seed', function(){
        var wallet = new Wallet()
        assert.ok(wallet.getMasterKey())
      })
    })

    describe('constructor options', function() {
      beforeEach(function() {
        wallet = new Wallet(seed, {network: 'testnet'})
      })

      it('uses the network if specified', function() {
        assert.equal(wallet.getMasterKey().network, 'testnet')
      })
    })
  })

  describe('newMasterKey', function(){
    it('resets accounts', function(){
      var wallet = new Wallet()
      var oldAccountZero = wallet.getAccountZero()
      var oldExternalAccount = wallet.getExternalAccount()
      var oldInternalAccount = wallet.getInternalAccount()

      wallet.newMasterKey(seed)
      assertNotEqual(wallet.getAccountZero(), oldAccountZero)
      assertNotEqual(wallet.getExternalAccount(), oldExternalAccount)
      assertNotEqual(wallet.getInternalAccount(), oldInternalAccount)
    })

    it('resets addresses', function(){
      var wallet = new Wallet()
      wallet.generateAddress()
      wallet.generateChangeAddress()
      var oldAddresses = wallet.addresses
      var oldChangeAddresses = wallet.changeAddresses
      assert.notDeepEqual(oldAddresses, [])
      assert.notDeepEqual(oldChangeAddresses, [])

      wallet.newMasterKey(seed)
      assert.deepEqual(wallet.addresses, [])
      assert.deepEqual(wallet.changeAddresses, [])
    })
  })

  describe('generateAddress', function(){
    it('generate receiving addresses', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
      var expectedAddresses = [
        "n1GyUANZand9Kw6hGSV9837cCC9FFUQzQa",
        "n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X"
      ]

      assert.equal(wallet.generateAddress(), expectedAddresses[0])
      assert.equal(wallet.generateAddress(), expectedAddresses[1])
      assert.deepEqual(wallet.addresses, expectedAddresses)
    })
  })

  describe('generateChangeAddress', function(){
    it('generates change addresses', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
      var expectedAddresses = ["mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"]

      assert.equal(wallet.generateChangeAddress(), expectedAddresses[0])
      assert.deepEqual(wallet.changeAddresses, expectedAddresses)
    })
  })

  describe('getPrivateKey', function(){
    it('returns the private key at the given index of external account', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})

      assertEqual(wallet.getPrivateKey(0), wallet.getExternalAccount().derive(0).priv)
      assertEqual(wallet.getPrivateKey(1), wallet.getExternalAccount().derive(1).priv)
    })
  })

  describe('getInternalPrivateKey', function(){
    it('returns the private key at the given index of internal account', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})

      assertEqual(wallet.getInternalPrivateKey(0), wallet.getInternalAccount().derive(0).priv)
      assertEqual(wallet.getInternalPrivateKey(1), wallet.getInternalAccount().derive(1).priv)
    })
  })

  describe('getPrivateKeyForAddress', function(){
    it('returns the private key for the given address', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
      wallet.generateChangeAddress()
      wallet.generateAddress()
      wallet.generateAddress()

      assertEqual(wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X"),
                   wallet.getExternalAccount().derive(1).priv)
      assertEqual(wallet.getPrivateKeyForAddress("mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"),
                   wallet.getInternalAccount().derive(0).priv)
    })

    it('raises an error when address is not found', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
      assert.throws(function() {
        wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X")
      }, Error, 'Unknown address. Make sure the address is from the keychain and has been generated.')
    })
  })

  describe('Unspent Outputs', function(){
    var expectedUtxo, expectedOutputKey;
    beforeEach(function(){
      expectedUtxo = [
          {
            "hash":"6a4062273ac4f9ea4ffca52d9fd102b08f6c32faa0a4d1318e3a7b2e437bb9c7",
            "hashLittleEndian":"c7b97b432e7b3a8e31d1a4a0fa326c8fb002d19f2da5fc4feaf9c43a2762406a",
            "outputIndex": 0,
            "scriptPubKey":"76a91468edf28474ee22f68dfe7e56e76c017c1701b84f88ac",
            "address" : "1azpkpcfczkduetfbqul4mokqai3m3hmxv",
            "value": 20000
          }
        ]
      expectedOutputKey = expectedUtxo[0].hash + ":" + expectedUtxo[0].outputIndex
    })

    describe('getUnspentOutputs', function(){
      it('parses wallet outputs to the expect format', function(){
        wallet.outputs[expectedOutputKey] = {
          output: expectedOutputKey,
          scriptPubKey: expectedUtxo[0].scriptPubKey,
          address: expectedUtxo[0].address,
          value: expectedUtxo[0].value
        }

        assert.deepEqual(wallet.getUnspentOutputs(), expectedUtxo)
      })
    })

    describe('setUnspentOutputs', function(){
      var utxo;
      beforeEach(function(){
        utxo = cloneObject(expectedUtxo)
      })

      it('uses hashLittleEndian when hash is not present', function(){
        delete utxo[0]['hash']

        wallet.setUnspentOutputs(utxo)
        verifyOutputs()
      })

      it('uses hash when hashLittleEndian is not present', function(){
        delete utxo[0]['hashLittleEndian']

        wallet.setUnspentOutputs(utxo)
        verifyOutputs()
      })

      it('uses hash when both hash and hashLittleEndian are present', function(){
        wallet.setUnspentOutputs(utxo)
        verifyOutputs()
      })

      function verifyOutputs() {
        var output = wallet.outputs[expectedOutputKey]
        assert(output)
        assert.equal(output.value, utxo[0].value)
        assert.equal(output.address, utxo[0].address)
        assert.equal(output.scriptPubKey, utxo[0].scriptPubKey)
      }
    })
  })

  function assertEqual(obj1, obj2){
    assert.equal(obj1.toString(), obj2.toString())
  }

  function assertNotEqual(obj1, obj2){
    assert.notEqual(obj1.toString(), obj2.toString())
  }

  // quick and dirty: does not deal with functions on object
  function cloneObject(obj){
    return JSON.parse(JSON.stringify(obj))
  }
})
