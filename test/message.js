/* global describe, it */
var assert = require('assert');
var Message = require('../src/message.js');
var ECKey = require('../src/eckey.js').ECKey;
var hexToBytes = require('../src/convert.js').hexToBytes;

var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
var addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM';
var msg = 'foobar';

describe('Message', function() {
    describe('verify', function() {
        it('passes case 1', function() {
            var key = new ECKey(hexToBytes(priv));
            assert.equal(key.getBitcoinAddress().toString(), addr);

            var sig = Message.signMessage(key, msg);
            assert.ok(Message.verifyMessage(addr, sig, msg));

            // wrong message
            assert.ok(!Message.verifyMessage(addr, sig, 'not foobar'));

            // wrong address
            assert.ok(!Message.verifyMessage('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a', sig, msg));
        })

        it('passes case 2', function() {
            var priv = '5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh';
            var key = new ECKey(hexToBytes(priv));
            var sig = Message.signMessage(key, msg);
            assert.ok(!Message.verifyMessage(addr, sig, msg));
        })
    })
})
