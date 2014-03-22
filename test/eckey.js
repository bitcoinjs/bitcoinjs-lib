/* global describe, it */
var assert = require('assert');
var ECKey = require('../src/eckey.js').ECKey;
var convert = require('../src/convert.js');
var bytesToHex = convert.bytesToHex;
var hexToBytes = convert.hexToBytes;
var Address = require('../src/address');
var Network = require('../src/network')
var mainnet = Network.mainnet.addressVersion
var testnet = Network.testnet.addressVersion

describe('ECKey', function() {
    describe('constructor (base58 private) on mainnet', function() {
        it('parses hex', function() {
            var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
            var pub = '0450863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b235' +
                      '22cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6';
            var key = new ECKey(priv);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
            assert.equal(key.version, mainnet);
        })

        it('parses base64', function() {
            var priv = 'VYdB+iv47y5FaUVIPdQInkgATrABeuD1lACUoM4x7tU=';
            var pub = '042f43c16c08849fed20a35bb7b1947bbf0923c52d613ee13b5c665a1e10d24b2' +
                      '8be909a70f5f87c1adb79fbcd1b3f17d20aa91c04fc355112dba2ce9b1cbf013b';
            var key = new ECKey(priv);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
            assert.equal(key.version, mainnet);
        })

        it('parses WIF', function() {
            var priv = '5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh';
            var pub = '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0' +
                      'f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1';
            var addr = '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a';
            var key = new ECKey(priv);

            assert.equal(key.compressed, false);
            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.getBitcoinAddress().toString(), addr);
            assert.equal(key.version, mainnet);
        })

        it('parses compressed WIF', function() {
            var priv = 'KwntMbt59tTsj8xqpqYqRRWufyjGunvhSyeMo3NTYpFYzZbXJ5Hp';
            var pub = '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa'
            var addr = '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9';
            var key = new ECKey(priv);

            assert.equal(key.compressed, true);
            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.getBitcoinAddress().toString(), addr);
            assert.equal(key.version, mainnet);
        })
    })

    describe('constructor (base58 private) on testnet', function() {
        it('parses hex', function() {
            var priv = 'ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458';
            var pub = '044b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea81199' +
                      '283fbec990dad6fb98f93f712d50cb874dd717de6a184158d63886dda3090f566';
            var key = new ECKey(priv, false, testnet);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
            assert.equal(key.version, testnet);
            assert.equal(key.toHex(), priv);
        })

        it('parses base64', function() {
            var priv = 'VYdB+iv47y5FaUVIPdQInkgATrABeuD1lACUoM4x7tU=';
            var pub = '042f43c16c08849fed20a35bb7b1947bbf0923c52d613ee13b5c665a1e10d24b2' +
                      '8be909a70f5f87c1adb79fbcd1b3f17d20aa91c04fc355112dba2ce9b1cbf013b';
            var key = new ECKey(priv, false, testnet);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
            assert.equal(key.version, testnet);
            assert.equal(key.toBase64(), priv);
        })

        it('parses WIF', function() {
            var priv = '92tb9mjz6q9eKZjYvLsgk87kPrMoh7BGRumSzPeUGhmigtsfrbP';
            var pub = '04b70d0bd71417d7903b6c4b451d8cfbd6514cb3557d9363319e5d87377905c4f' +
                      '3bb6c6e8c1819b6dd95d60aa8da73f0e726a2311545842bf07e78487e8ea2801f';
            var addr = 'mmktwdfQ3oaEvyjS5p1TgovfJmgBQLjGa4';
            var key = new ECKey(priv);

            assert.equal(key.compressed, false);
            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.getBitcoinAddress().toString(), addr);
            assert.equal(key.version, testnet);
            assert.equal(key.toBase58(), priv);
        })

        it('parses compressed WIF', function() {
            var priv = 'cTLhjiUj2jX9iwUotSiiRLQnXrrq62GK6wuBiJxPNJxP15ERrX8o';
            var pub = '03b70d0bd71417d7903b6c4b451d8cfbd6514cb3557d9363319e5d87377905c4f3'
            var addr = 'n3nBy5dyx24CLT3kg3ZJwfTeTX5oxxtxNE';
            var key = new ECKey(priv);

            assert.equal(key.compressed, true);
            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.getBitcoinAddress().toString(), addr);
            assert.equal(key.version, testnet);
            assert.equal(key.toBase58(), priv);
        })

        it('initiation via alternative constructor syntax', function() {
            var priv = 'ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458';
            var pub = '044b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea81199' +
                      '283fbec990dad6fb98f93f712d50cb874dd717de6a184158d63886dda3090f566';
            var key = ECKey(priv, false, testnet);

            assert.equal(key.getPub().toHex(), pub);
            assert.equal(key.compressed, false);
            assert.equal(key.version, testnet);
            assert.equal(key.toHex(), priv);
        })
    })
})
