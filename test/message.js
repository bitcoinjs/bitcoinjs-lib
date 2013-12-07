var assert = require('assert');
var Message = require('../').Message;
var Key = require('../').Key;
var hexToBytes = require('../').convert.hexToBytes;

var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
var addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM';
var msg = 'foobar';

test('create', function() {
    var key = Key(hexToBytes(priv));
    assert.equal(key.getBitcoinAddress().toString(), addr);

    var sig = Message.signMessage(key, msg);
    assert.ok(Message.verifyMessage(addr, sig, msg));
    // wrong message
    assert.ok(!Message.verifyMessage(addr, sig, 'not foobar'));
    // wrong address
    assert.ok(!Message.verifyMessage('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a', sig, msg));
});

test('incorrect signature', function() {
    // wrong signature
    var priv = '5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh';
    var key = Key(hexToBytes(priv));
    var sig = Message.signMessage(key, msg);
    assert.ok(!Message.verifyMessage(addr, sig, msg));
});
