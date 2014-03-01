var Wallet = require('../src/wallet.js')
var assert = require('assert')

describe('Wallet', function() {
  var seed = 'crazy horse battery staple'

  describe('default constructor', function() {
    var wallet;
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('defaults to Bitcoin mainnet', function() {
      assert.equal(wallet.getMasterKey().network, 'mainnet')
    })

    it('defaults to private derivationMethod', function() {
      assert.equal(wallet.derivationMethod, 'private')
    })
  })

  describe('constructor options', function() {
    var wallet;
    beforeEach(function() {
      wallet = new Wallet(seed, {network: 'testnet', derivationMethod: 'public'})
    })

    it('uses the network if specified', function() {
      assert.equal(wallet.getMasterKey().network, 'testnet')
    })

    it('uses the derivationMethod if specified', function() {
      assert.equal(wallet.derivationMethod, 'public')
    })
  })

})
