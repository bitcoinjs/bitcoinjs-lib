var assert = require('assert');
var convert = require('../src/convert')
var Message = require('../src/message')
var ECKey = require('../src/eckey').ECKey

var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
var addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM';
var msg = 'foobar';

describe('Message', function() {
    describe('verify', function() {
        it('passes case 1', function() {
            var key = new ECKey(priv)
            assert.equal(key.getAddress().toString(), addr);

            var sig = Message.signMessage(key, msg);
            assert.ok(Message.verifyMessage(addr, sig, msg));

            // wrong message
            assert.ok(!Message.verifyMessage(addr, sig, 'not foobar'));

            // wrong address
            assert.ok(!Message.verifyMessage('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a', sig, msg));
        })

        it('passes case 2', function() {
            var key = new ECKey('5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh')
            var sig = Message.signMessage(key, msg);
            assert.ok(!Message.verifyMessage(addr, sig, msg));
        })

        it('handles compressed keys', function() {
            var key = new ECKey(priv)
            key.compressed = true

            var addr = key.getAddress().toString()

            var sig = Message.signMessage(key, msg);
            assert.ok(Message.verifyMessage(addr, sig, msg));

            // wrong message
            assert.ok(!Message.verifyMessage(addr, sig, 'not foobar'));

            // wrong address
            assert.ok(!Message.verifyMessage('1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a', sig, msg));
        })

        it('handle testnet addresses properly', function() {
          var addr = 'mgdnNWji2bXYSi7E9c1DQBSp64kCemaS7V'
          var msg = 'vires is numeris'
          var sig = convert.base64ToBytes('H+7Ohg6VIlPd9GXNHFrqdqsWKHruCTvm9n0ZbDn1B1Q28EB6TlBpTmlWwGEI+rhgjev5VU115XwRD3xRKm6xXQo=')
          sig = convert.bytesToHex(sig)

          assert(Message.verifyMessage(addr, sig, msg))
        })
    })
})
