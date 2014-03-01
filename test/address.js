/* global describe, it */
var assert = require('assert');
var Address = require('../src/address.js');

describe('Address', function() {
    describe('toString', function() {
        it('defaults to base58', function() {
            var addr = '18fN1QTGWmHWCA9r2dyDH6FbMEyc7XHmQQ';
            assert.equal((new Address(addr)).toString(), addr);
        })
    })

    describe('validate', function() {
        it('validates known good addresses', function() {
            function validate(addr) {
                assert.ok(Address.validate(addr));
            }

            validate('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
            // validate('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'mainnet');
            validate('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef');
            // validate('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef', 'testnet');

            validate('12KYrjTdVGjFMtaxERSk3gphreJ5US8aUP');
            validate('12QeMLzSrB8XH8FvEzPMVoRxVAzTr5XM2y');
            validate('1oNLrsHnBcR6dpaBpwz3LSwutbUNkNSjs');
            validate('1SQHtwR5oJRKLfiWQ2APsAd9miUc4k2ez');
            validate('116CGDLddrZhMrTwhCVJXtXQpxygTT1kHd');

            // p2sh addresses
            validate('3NJZLcZEEYBpxYEUGewU4knsQRn1WM5Fkt');
            // validate('3NJZLcZEEYBpxYEUGewU4knsQRn1WM5Fkt', 'mainnet');
            validate('2MxKEf2su6FGAUfCEAHreGFQvEYrfYNHvL7');
            // validate('2MxKEf2su6FGAUfCEAHreGFQvEYrfYNHvL7', 'testnet');
        })

        it('does not validate illegal examples', function() {
            function invalid(addr) {
                assert.ok(!Address.validate(addr));
            }

            invalid('');
            invalid('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhe');

            // invalid('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'testnet');
            // invalid('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef', 'mainnet');

            // invalid base58 string
            invalid('%%@');
        })
    })
})
