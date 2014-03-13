var Wallet = require('../src/wallet.js')
var HDNode = require('../src/hdwallet.js')
var convert = require('../src/convert.js')
var assert = require('assert')
var SHA256 = require('crypto-js/sha256')
var Crypto = require('crypto-js')

describe('Wallet', function() {
  var seed;
  beforeEach(function(){
    seed = convert.wordArrayToBytes(SHA256("don't use a string seed like this in real life"))
  })

  describe('constructor', function() {
    var wallet;
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('defaults to Bitcoin mainnet', function() {
      assert.equal(wallet.getMasterKey().network, 'mainnet')
    })

    it("generates m/0' as the main account", function() {
      var mainAccount = wallet.accountZero
      assert.equal(mainAccount.index, 0 + HDNode.HIGHEST_BIT)
      assert.equal(mainAccount.depth, 1)
    })

    it("generates m/0'/0 as the external account", function() {
      var account = wallet.externalAccount
      assert.equal(account.index, 0)
      assert.equal(account.depth, 2)
    })

    it("generates m/0'/1 as the internal account", function() {
      var account = wallet.internalAccount
      assert.equal(account.index, 1)
      assert.equal(account.depth, 2)
    })

    describe('constructor options', function() {
      var wallet;
      beforeEach(function() {
        wallet = new Wallet(seed, {network: 'testnet'})
      })

      it('uses the network if specified', function() {
        assert.equal(wallet.getMasterKey().network, 'testnet')
      })
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

      assertPrivateKeyEqual(wallet.getPrivateKey(0), wallet.externalAccount.derive(0))
      assertPrivateKeyEqual(wallet.getPrivateKey(1), wallet.externalAccount.derive(1))
    })
  })

  describe('getInternalPrivateKey', function(){
    it('returns the private key at the given index of internal account', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})

      assertPrivateKeyEqual(wallet.getInternalPrivateKey(0), wallet.internalAccount.derive(0))
      assertPrivateKeyEqual(wallet.getInternalPrivateKey(1), wallet.internalAccount.derive(1))
    })
  })

  describe('getPrivateKeyForAddress', function(){
    it('returns the private key for the given address', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
      wallet.generateChangeAddress()
      wallet.generateAddress()
      wallet.generateAddress()

      assertPrivateKeyEqual(wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X"),
                   wallet.externalAccount.derive(1))
      assertPrivateKeyEqual(wallet.getPrivateKeyForAddress("mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"),
                   wallet.internalAccount.derive(0))
    })

    it('raises an error when address is not found', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
      assert.throws(function() {
        wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X")
      }, Error, 'Unknown address. Make sure the address is from the keychain and has been generated.')
    })
  })

  function assertPrivateKeyEqual(key1, key2){
    assert.equal(key1.toString(), key2.toString())
  }
})
