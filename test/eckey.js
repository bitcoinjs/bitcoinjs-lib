/* global describe, it */
var assert = require('assert');
var ECKey = require('../src/eckey.js').ECKey;
var convert = require('../src/convert.js');
var bytesToHex = convert.bytesToHex;
var hexToBytes = convert.hexToBytes;

describe('ECKey', function() {
    describe('constructor (base58 private)', function() {
        it('parses case 1', function() {
            var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
            var pub = '0450863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b235' +
                      '22cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6';
            var key = new ECKey(hexToBytes(priv));

            assert.equal(bytesToHex(key.getPub()['export']('bytes')), pub);
            assert.equal(key.compressed, false);
        })

        it('parses case 2', function() {
            var priv = '5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh';
            var pub = '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0' +
                      'f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1';
            var addr = '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a';
            var key = new ECKey(priv);

            assert.equal(key.compressed, false);
            assert.equal(bytesToHex(key.getPub()['export']('bytes')), pub);
            assert.equal(key.getBitcoinAddress().toString(), addr);
        })

        it('parses case 3', function() {
            var priv = 'KwntMbt59tTsj8xqpqYqRRWufyjGunvhSyeMo3NTYpFYzZbXJ5Hp';
            var pub = '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa'
            var addr = '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9';
            var key = new ECKey(priv);

            assert.equal(key.compressed, true);
            assert.equal(bytesToHex(key.getPub()['export']('bytes')), pub);
            assert.equal(key.getBitcoinAddress().toString(), addr);
        })
    })
})
