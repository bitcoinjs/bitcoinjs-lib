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
    var wallet;
    beforeEach(function() { wallet = new Wallet(seed, {network: 'testnet'}) })

    it('defaults to generating receiving addresses', function(){
      assert.equal(wallet.generateAddress(), "n1GyUANZand9Kw6hGSV9837cCC9FFUQzQa")
      assert.equal(wallet.generateAddress(), "n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X")
    })
  })
})
