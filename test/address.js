/* global describe, it */
var assert = require('assert');
var Address = require('../src/address.js');
var network = require('../src/network.js');

describe('Address', function() {
    describe('toString', function() {
        it('defaults to base58', function() {
            var addr = '18fN1QTGWmHWCA9r2dyDH6FbMEyc7XHmQQ';
            assert.equal((new Address(addr)).toString(), addr);
        })
    })

    describe('validate', function() {
        it('validates known good addresses', function() {
            function validate(addr, expectedVersion) {
                assert.ok(Address.validate(addr));
                var address = new Address(addr);
                assert.ok(address.version == expectedVersion);
            }

            validate('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', network.mainnet.addressVersion);
            validate('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef', network.testnet.addressVersion);

            validate('12KYrjTdVGjFMtaxERSk3gphreJ5US8aUP', network.mainnet.addressVersion);
            validate('12QeMLzSrB8XH8FvEzPMVoRxVAzTr5XM2y', network.mainnet.addressVersion);
            validate('1oNLrsHnBcR6dpaBpwz3LSwutbUNkNSjs', network.mainnet.addressVersion);
            validate('1SQHtwR5oJRKLfiWQ2APsAd9miUc4k2ez', network.mainnet.addressVersion);
            validate('116CGDLddrZhMrTwhCVJXtXQpxygTT1kHd', network.mainnet.addressVersion);

            // p2sh addresses
            validate('3NJZLcZEEYBpxYEUGewU4knsQRn1WM5Fkt', network.mainnet.p2shVersion);
            validate('2MxKEf2su6FGAUfCEAHreGFQvEYrfYNHvL7', network.testnet.p2shVersion);
        })

        it('does not validate illegal examples', function() {
            function invalid(addr) {
                assert.ok(!Address.validate(addr));
            }
            function invalidNetwork(addr, unexpectedVersion) {
                assert.ok(Address.validate(addr)); //must be a valid address itself
                if(addr.length >= 34 && unexpectedVersion !== undefined) {
                  var address = new Address(addr);
                  if(unexpectedVersion !== undefined)
                      assert.ok(address.version != unexpectedVersion);
                }
            }

            invalid(''); //empty should be invalid
            invalid('%%@'); // invalid base58 string
            invalid('1A1zP1eP5QGefi2DzPTf2L5SLmv7DivfNz'); // bad address (doesn't checksum)
            invalid('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhe'); // bad address (doesn't checksum)
            
            //and test for the wrong networks
            invalidNetwork('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef', network.mainnet.addressVersion);
            invalidNetwork('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', network.testnet.addressVersion);
        })
    })
})
