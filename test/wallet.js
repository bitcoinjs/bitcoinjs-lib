var Wallet = require('../src/wallet.js')
var Address = require('../src/address.js')
var assert = require('assert')

describe('Wallet', function() {
  var seed = 'crazy horse battery staple'

  describe('default constructor', function() {
    var wallet;
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('defaults to Bitcoin network', function() {
      assert.equal(wallet.getMasterKey().network, 'Bitcoin')
    })

    it('defaults to private derivationMethod', function() {
      assert.equal(wallet.derivationMethod, 'private')
    })
  })

  describe('constructor options', function() {
    var wallet;
    beforeEach(function() {
      wallet = new Wallet(seed, {network: 'Test', derivationMethod: 'public'})
    })

    it('uses the network if specified', function() {
      assert.equal(wallet.getMasterKey().network, 'Test')
    })

    it('uses the derivationMethod if specified', function() {
      assert.equal(wallet.derivationMethod, 'public')
    })
  })

  describe('networkType', function() {
    it('ensures that a mainnet Wallet has mainnet child keys (pub and priv)', function() {
        var w = Wallet("foobar", {network: "Bitcoin"})
        assert(w.getMasterKey().priv.version == Address.address_types['prod'])
        w.generateAddress()
        assert(w.getPrivateKey(0).priv.version == Address.address_types['prod'])
    })

    it('ensures that a testnet Wallet has testnet child keys (pub and priv)', function() {
        var w = Wallet("foobar", {network: "BitcoinTest"})
        assert(w.getMasterKey().priv.version == Address.address_types['testnet'])
        w.generateAddress()
        assert(w.getPrivateKey(0).priv.version == Address.address_types['testnet'])
    })
  })
})
