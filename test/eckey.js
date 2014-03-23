/* global describe, it */
var assert = require('assert');

var ECKey = require('../src/eckey.js').ECKey;
var ECPubKey = require('../src/eckey.js').ECPubKey;

var convert = require('../src/convert.js');
var bytesToHex = convert.bytesToHex;
var hexToBytes = convert.hexToBytes;
var Address = require('../src/address');
var Network = require('../src/network')
var testnet = Network.testnet.addressVersion

describe('ECKey', function() {
    describe('constructor', function() {
        it('parses hex', function() {
            var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
            var pub = '0450863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b235' +
                      '22cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6';
            var key = new ECKey(priv);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
        })

        it('parses base64', function() {
            var priv = 'VYdB+iv47y5FaUVIPdQInkgATrABeuD1lACUoM4x7tU=';
            var pub = '042f43c16c08849fed20a35bb7b1947bbf0923c52d613ee13b5c665a1e10d24b2' +
                      '8be909a70f5f87c1adb79fbcd1b3f17d20aa91c04fc355112dba2ce9b1cbf013b';
            var key = new ECKey(priv);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
        })

        it('parses WIF', function() {
            var priv = '5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh';
            var pub = '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0' +
                      'f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1';
            var addr = '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a';
            var key = new ECKey(priv);

            assert.equal(key.compressed, false);
            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.getAddress().toString(), addr);
        })

        it('parses compressed WIF', function() {
            var priv = 'KwntMbt59tTsj8xqpqYqRRWufyjGunvhSyeMo3NTYpFYzZbXJ5Hp';
            var pub = '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa'
            var addr = '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9';
            var key = new ECKey(priv);

            assert.equal(key.compressed, true);
            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.getAddress().toString(), addr);
        })

        it('alternative constructor syntax', function() {
            var priv = 'ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458';
            var pub = '044b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea81199' +
                      '283fbec990dad6fb98f93f712d50cb874dd717de6a184158d63886dda3090f566';
            var key = ECKey(priv, false);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
            assert.equal(key.toHex(), priv);
        })
    })

    describe('toAddress', function() {
        var privkeys = [
            'CA48EC9783CF3AD0DFEFF1FC254395A2E403CBBC666477B61B45E31D3B8AB458',
            '1111111111111111111111111111111111111111111111111111111111111111',
            '18E14A7B6A307F426A94F8114701E7C8E774E7F9A47E2C2035DB29A206321725'
        ];

        // compressed pubkeys
        var cpubkeys = [
            '024B12D9D7C77DB68388B6FF7C89046174C871546436806BCD80D07C28EA811992',
            '034F355BDCB7CC0AF728EF3CCEB9615D90684BB5B2CA5F859AB0F0B704075871AA',
            '0250863AD64A87AE8A2FE83C1AF1A8403CB53F53E486D8511DAD8A04887E5B2352'
        ];

        var pubkeys = cpubkeys.map(function(x) {
            return new ECPubKey(x).pub.getEncoded(false);
        });

        it('mainnet', function() {
            var addresses = [
                '19SgmoUj4xowEjwtXvNAtYTAgbvR9iBCui',
                '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a',
                '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM'
            ];
            var compressedAddresses = [
                '1AA4sjKW2aUmbtN3MtegdvhYtDBbDEke1q',
                '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9',
                '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs',
            ];

            for (var i = 0; i < addresses.length; ++i) {
                var priv = new ECKey(privkeys[i], false);
                var pubcomp = new ECPubKey(cpubkeys[i], true);
                var pub = new ECPubKey(pubkeys[i], false);

                var addr = addresses[i];
                var caddr = compressedAddresses[i];

                assert.equal(priv.getAddress().toString(), addr);
                assert.equal(pub.getAddress().toString(), addr);
                assert.equal(pubcomp.getAddress().toString(), caddr);
            }
        })

        it('testnet', function() {
            var addresses = [
                '19SgmoUj4xowEjwtXvNAtYTAgbvR9iBCui',
                '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a',
                '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM'
            ];
            var compressedAddresses = [
                '1AA4sjKW2aUmbtN3MtegdvhYtDBbDEke1q',
                '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9',
                '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs',
            ];

            for (var i = 0; i < addresses.length; ++i) {
                var priv = new ECKey(privkeys[i], false);
                var pubcomp = new ECPubKey(cpubkeys[i], true);
                var pub = new ECPubKey(pubkeys[i], false);

                var addr = addresses[i];
                var caddr = compressedAddresses[i];

                assert.equal(priv.getAddress().toString(), addr);
                assert.equal(pub.getAddress().toString(), addr);
                assert.equal(pubcomp.getAddress().toString(), caddr);
            }
        })
    });
})
