var assert = require('assert')
var Address = require('../src/address')
var network = require('../src/network')
var base58 = require('../src/base58')
var base58check = require('../src/base58check')
var mainnet = network.mainnet.addressVersion
var testnet = network.testnet.addressVersion

describe('Address', function() {
  var testnetAddress, mainnetAddress
  var testnetP2shAddress, mainnetP2shAddress

  beforeEach(function(){
    mainnetAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
    testnetAddress = 'mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef'
    mainnetP2shAddress = '3NJZLcZEEYBpxYEUGewU4knsQRn1WM5Fkt'
    testnetP2shAddress = '2MxKEf2su6FGAUfCEAHreGFQvEYrfYNHvL7'
  })

  describe('parsing', function() {
    it('works with Address object', function() {
      var addr = new Address(new Address('mwrB4fgT1KSBCqELaWv7o7tsExuQzW3NY3', network.testnet.addressVersion))

      assert.equal(addr.toString(), 'mwrB4fgT1KSBCqELaWv7o7tsExuQzW3NY3')
      assert.equal(addr.version, network.testnet.addressVersion)
    })

    it('works with hex', function() {
      var addr = new Address('13483382d3c3d43fc9d7b52e652b6bbb70e8b667')
      assert.equal(addr.toString(), '12kxLGqrnnchwN9bHHNV2fWDtJGwxKTcJS')
    })

    it('throws error for invalid or unrecognized input', function() {
      assert.throws(function() {
        new Address('beepboopbeepboopbeepboopbeepboopbeepboopbeep')
      }, Error)
    })

    it('works for byte input', function() {
      var hash = base58check.decode(mainnetAddress)
      var addr = new Address(hash.payload)
      assert.equal(addr.hash, hash.payload)
      assert.equal(network.mainnet.addressVersion, hash.version)

      var hash = base58check.decode(testnetAddress)
      var addr = new Address(hash.payload)
      assert.equal(addr.hash, hash.payload)
      assert.equal(network.testnet.addressVersion, hash.version)
    })

    it('fails for bad input', function() {
      assert.throws(function() {
        new Address('foo')
      }, Error)
    })
  })

  describe('getVersion', function() {
    it('returns the proper address version', function() {
      assert.equal(Address.getVersion(mainnetAddress), network.mainnet.addressVersion)
      assert.equal(Address.getVersion(testnetAddress), network.testnet.addressVersion)
    })
  })

  describe('toString', function() {
    it('defaults to base58', function() {
      var addr = '18fN1QTGWmHWCA9r2dyDH6FbMEyc7XHmQQ'
      assert.equal((new Address(addr)).toString(), addr)
    })
  })

  describe('Constructor', function(){
    it('resolves version correctly', function(){
      assert.equal((new Address(testnetAddress)).version, testnet)
      assert.equal((new Address(mainnetAddress)).version, mainnet)
      assert.equal((new Address(testnetP2shAddress)).version, network.testnet.p2shVersion)
      assert.equal((new Address(mainnetP2shAddress)).version, network.mainnet.p2shVersion)
    })
  })

  describe('validate', function() {
    it('validates known good addresses', function() {
      function validate(addr, expectedVersion) {
        assert.ok(Address.validate(addr))
      }

      validate(testnetAddress)
      validate(mainnetAddress)
      validate('12KYrjTdVGjFMtaxERSk3gphreJ5US8aUP')
      validate('12QeMLzSrB8XH8FvEzPMVoRxVAzTr5XM2y')
      validate('1oNLrsHnBcR6dpaBpwz3LSwutbUNkNSjs')
      validate('1SQHtwR5oJRKLfiWQ2APsAd9miUc4k2ez')
      validate('116CGDLddrZhMrTwhCVJXtXQpxygTT1kHd')

      // p2sh addresses
      validate(testnetP2shAddress)
      validate(mainnetP2shAddress)
    })

    it('does not validate illegal examples', function() {
      function invalid(addr) {
        assert.ok(!Address.validate(addr))
      }

      invalid(''); //empty should be invalid
      invalid('%%@'); // invalid base58 string
      invalid('1A1zP1eP5QGefi2DzPTf2L5SLmv7DivfNz'); // bad address (doesn't checksum)
      invalid('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhe'); // bad address (doesn't checksum)
    })
  })
})
