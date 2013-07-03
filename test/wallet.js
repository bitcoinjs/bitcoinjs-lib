var assert = require('assert');
var Wallet = require('..').Wallet

test('Testnet wallet', function() {
    var wallet = new Wallet('testnet');
    var addresses = wallet.getAllAddresses();
    assert.equal(addresses.length, 0);

    wallet.generateAddress();
    addresses = wallet.getAllAddresses();
    assert.equal(addresses.length, 1);
    var addressStart = addresses[0].toString().slice(0, 1);
    assert.ok(['m', 'n'].indexOf(addressStart) != -1);
    assert.equal(addresses[0].version, 0x6f);
});

test('Prod wallet', function() {
    var wallet = new Wallet();
    var addresses = wallet.getAllAddresses();
    assert.equal(addresses.length, 0);

    wallet.generateAddress();
    addresses = wallet.getAllAddresses();
    assert.equal(addresses.length, 1);
    assert.equal(addresses[0].version, 0);
    assert.equal(addresses[0].toString().slice(0, 1), '1');
});
