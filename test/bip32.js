/* global describe, it */
var assert = require('assert');
var BIP32key = require('../src/bip32.js');
var convert = require('../src/convert.js')
var hexToBytes = convert.hexToBytes;
var bytesToString = convert.bytesToString;

var BIP32_PRIME = 0x80000000;

function checkKey(key, extPriv, extPub) {
    assert.equal(key.serialize(), extPriv);
    assert.equal(key.getPub().serialize(), extPub);
}

function checkKeyHex(key, extPriv, extPub) {
    assert.equal(key.serialize('hex'), extPriv);
    assert.equal(key.getPub().serialize('hex'), extPub);
}

describe('BIP32key', function() {
    describe('BIP-0032 Test Vectors', function() {
        describe('vector 1', function() {
            // Extracted from https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#Test_Vectors
            var masterHex = '000102030405060708090a0b0c0d0e0f'
            , masterBytes = convert.hexToBytes(masterHex)
            , masterString = convert.bytesToString(masterBytes)
            , m = BIP32key.fromMasterKey(masterString)

            it('handles chain m', function() {
                var chain = m

                // Identifier
                //assert.equal(???, '3442193e1bb70916e914552172cd4e2dbc9df811')

                // Fingerprint
                // assert.equal('???', 0x3442193e)

                // Main address
                assert.equal(chain.bitcoinAddress().toString(), '15mKKb2eos1hWa6tisdPwwDC1a5J1y9nma')

                // Secret key
                chain.key.compressed = false
                assert.equal(chain.key.toHex(), 'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35')

                chain.key.compressed = true
                assert.equal(chain.key.toWif(), 'L52XzL2cMkHxqxBXRyEpnPQZGUs3uKiL3R11XbAdHigRzDozKZeW')

                // Public key
                assert.equal(chain.getPub().key.toHex(), '0339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2')

                // Chain code
                assert.equal(convert.bytesToHex(chain.chaincode), '873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508')

                // Serialized
                assert.equal(chain.getPub().serialize('hex'), '0488b21e000000000000000000873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d5080339a36013301597daef41fbe593a02cc513d0b55527ec2df1050e2e8ff49c85c2')
                assert.equal(chain.serialize('hex'), '0488ade4000000000000000000873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d50800e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35')
                assert.equal(chain.getPub().serialize('base58'), 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8')
                assert.equal(chain.serialize('base58'), 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi')
            })

            it('handles chain m/0\'', function() {
                var chain = m.ckd(BIP32key.PRIME + 0)

                // Identifier
                //assert.equal(???, '5c1bd648ed23aa5fd50ba52b2457c11e9e80a6a7')

                // Fingerprint
                // assert.equal('???', 0x5c1bd648)

                // Main address
                // assert.equal(chain.bitcoinAddress().toString(), '19Q2WoS5hSS6T8GjhK8KZLMgmWaq4neXrh')

                // Secret key
                chain.key.compressed = false
                assert.equal(chain.key.toHex(), 'edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea')

                chain.key.compressed = true
                assert.equal(chain.key.toWif(), 'L5BmPijJjrKbiUfG4zbiFKNqkvuJ8usooJmzuD7Z8dkRoTThYnAT')

                // Public key
                assert.equal(chain.getPub().key.toHex(), '035a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56')

                // Chain code
                assert.equal(convert.bytesToHex(chain.chaincode), '47fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141')

                // Serialized
                assert.equal(chain.getPub().serialize('hex'), '0488b21e013442193e8000000047fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae6236141035a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56')
                assert.equal(chain.serialize('hex'), '0488ade4013442193e8000000047fdacbd0f1097043b78c63c20c34ef4ed9a111d980047ad16282c7ae623614100edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea')
                assert.equal(chain.getPub().serialize('base58'), 'xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw')
                assert.equal(chain.serialize('base58'), 'xprv9uHRZZhk6KAJC1avXpDAp4MDc3sQKNxDiPvvkX8Br5ngLNv1TxvUxt4cV1rGL5hj6KCesnDYUhd7oWgT11eZG7XnxHrnYeSvkzY7d2bhkJ7')
            })

            it('handles chain m/0\'/1', function() {
                var chain = m.ckd(BIP32key.PRIME + 0).ckd(1)

                // Identifier
                //assert.equal(???, 'bef5a2f9a56a94aab12459f72ad9cf8cf19c7bbe')

                // Fingerprint
                // assert.equal('???', 0xbef5a2f9)

                // Main address
                // assert.equal(chain.bitcoinAddress().toString(), '1JQheacLPdM5ySCkrZkV66G2ApAXe1mqLj')

                // Secret key
                chain.key.compressed = false
                assert.equal(chain.key.toHex(), '3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368')

                chain.key.compressed = true
                assert.equal(chain.key.toWif(), 'KyFAjQ5rgrKvhXvNMtFB5PCSKUYD1yyPEe3xr3T34TZSUHycXtMM')

                // Public key
                assert.equal(chain.getPub().key.toHex(), '03501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c')

                // Chain code
                assert.equal(convert.bytesToHex(chain.chaincode), '2a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19')

                // Serialized
                assert.equal(chain.getPub().serialize('hex'), '0488b21e025c1bd648000000012a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c1903501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c')
                assert.equal(chain.serialize('hex'), '0488ade4025c1bd648000000012a7857631386ba23dacac34180dd1983734e444fdbf774041578e9b6adb37c19003c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368')
                assert.equal(chain.getPub().serialize('base58'), 'xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ')
                assert.equal(chain.serialize('base58'), 'xprv9wTYmMFdV23N2TdNG573QoEsfRrWKQgWeibmLntzniatZvR9BmLnvSxqu53Kw1UmYPxLgboyZQaXwTCg8MSY3H2EU4pWcQDnRnrVA1xe8fs')
            })
        })

        it('handles vector 2', function() {
            return
            var seed_str = 'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542';
            var seed = bytesToString(hexToBytes(seed_str));

            var key = new BIP32key(seed);

            checkKey(key,
                'xprv9s21ZrQH143K31xYSDQpPDxsXRTUcvj2iNHm5NUtrGiGG5e2DtALGdso3pGz6ssrdK4PFmM8NSpSBHNqPqm55Qn3LqFtT2emdEXVYsCzC2U',
                'xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB');

            var branch = key.ckd(0);

            checkKey(branch,
                'xprv9vHkqa6EV4sPZHYqZznhT2NPtPCjKuDKGY38FBWLvgaDx45zo9WQRUT3dKYnjwih2yJD9mkrocEZXo1ex8G81dwSM1fwqWpWkeS3v86pgKt',
                'xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH');

            var branch2 = branch.ckd(2147483647 + BIP32_PRIME);

            checkKey(branch2,
                'xprv9wSp6B7kry3Vj9m1zSnLvN3xH8RdsPP1Mh7fAaR7aRLcQMKTR2vidYEeEg2mUCTAwCd6vnxVrcjfy2kRgVsFawNzmjuHc2YmYRmagcEPdU9',
                'xpub6ASAVgeehLbnwdqV6UKMHVzgqAG8Gr6riv3Fxxpj8ksbH9ebxaEyBLZ85ySDhKiLDBrQSARLq1uNRts8RuJiHjaDMBU4Zn9h8LZNnBC5y4a');

            var branch3 = branch2.ckd(1);

            checkKey(branch3,
                'xprv9zFnWC6h2cLgpmSA46vutJzBcfJ8yaJGg8cX1e5StJh45BBciYTRXSd25UEPVuesF9yog62tGAQtHjXajPPdbRCHuWS6T8XA2ECKADdw4Ef',
                'xpub6DF8uhdarytz3FWdA8TvFSvvAh8dP3283MY7p2V4SeE2wyWmG5mg5EwVvmdMVCQcoNJxGoWaU9DCWh89LojfZ537wTfunKau47EL2dhHKon');

            var branch4 = branch3.ckd(2147483646 + BIP32_PRIME);

            checkKey(branch4,
            'xprvA1RpRA33e1JQ7ifknakTFpgNXPmW2YvmhqLQYMmrj4xJXXWYpDPS3xz7iAxn8L39njGVyuoseXzU6rcxFLJ8HFsTjSyQbLYnMpCqE2VbFWc',
            'xpub6ERApfZwUNrhLCkDtcHTcxd75RbzS1ed54G1LkBUHQVHQKqhMkhgbmJbZRkrgZw4koxb5JaHWkY4ALHY2grBGRjaDMzQLcgJvLJuZZvRcEL');

            var branch5 = branch4.ckd(2);

            checkKey(branch5,
            'xprvA2nrNbFZABcdryreWet9Ea4LvTJcGsqrMzxHx98MMrotbir7yrKCEXw7nadnHM8Dq38EGfSh6dqA9QWTyefMLEcBYJUuekgW4BYPJcr9E7j',
            'xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9HmGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt');
        })
    })
})
