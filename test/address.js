var assert = require('assert');
var Address = require('..').Address;

test('string', function() {
    var addr = '18fN1QTGWmHWCA9r2dyDH6FbMEyc7XHmQQ';
    var address = new Address(addr);
    assert.equal(address.toString(), addr);
    assert.equal(address.version, 0);
});

test('valid', function() {
    function validate(addr, type) {
        assert.ok(Address.validate(addr, type));
    };

    validate('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    validate('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'prod');
    validate('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef');
    validate('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef', 'testnet');

    validate('12KYrjTdVGjFMtaxERSk3gphreJ5US8aUP');
    validate('12QeMLzSrB8XH8FvEzPMVoRxVAzTr5XM2y');
    validate('1oNLrsHnBcR6dpaBpwz3LSwutbUNkNSjs');
    validate('1SQHtwR5oJRKLfiWQ2APsAd9miUc4k2ez');
    validate('116CGDLddrZhMrTwhCVJXtXQpxygTT1kHd');

    // p2sh addresses
    validate('3NJZLcZEEYBpxYEUGewU4knsQRn1WM5Fkt');
    validate('3NJZLcZEEYBpxYEUGewU4knsQRn1WM5Fkt', 'prod');
    validate('2MxKEf2su6FGAUfCEAHreGFQvEYrfYNHvL7');
    validate('2MxKEf2su6FGAUfCEAHreGFQvEYrfYNHvL7', 'testnet');
});


test('invalid', function() {
    function invalid(addr, type) {
        assert.ok(!Address.validate(addr, type));
    };

    invalid('');
    invalid('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhe');
    invalid('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'testnet');
    invalid('mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef', 'prod');

    // invalid base58 string
    invalid('%%@');
});

test('validateType', function() {
    function valid(version, type) {
        assert.ok(Address.validateType(version, type));
    };
    function invalid(version, type) {
        assert.ok(!Address.validateType(version, type));
    };

    valid(0x0, 'prod');
    invalid(0x6f, 'prod');
    valid(0x6f, 'testnet');
});
