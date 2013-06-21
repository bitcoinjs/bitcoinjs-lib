var assert = require('assert');
var BigInteger = require('../').BigInteger;
var Transaction = require('..').Transaction;
var Wallet = require('..').Wallet;

test('Transaction output', function() {
    var wallet = new Wallet();
    wallet.generateAddress();
    var address = wallet.getAllAddresses()[0];

    var transaction = new Transaction();
    transaction.addOutput(address, 1234);
    transaction.addOutput(address, BigInteger.ONE);
    transaction.addOutput(transaction.outs[0]);

    assert.equal(transaction.outs.length, 3);
    assert.equal(transaction.outs[0].value.length, 8);
    assert.equal(transaction.outs[1].value.length, 8);
    assert.equal(transaction.outs[2].value.length, 8);
});
