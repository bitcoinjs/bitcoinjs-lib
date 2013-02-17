var assert = require('assert');
var Key = require('../').Key;
var bytesToHex = require('../').convert.bytesToHex;
var hexToBytes = require('../').convert.hexToBytes;
var base58 = require('../').base58;

// get public key from private key
test('from private base58', function() {

    var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725';
    var pub = '0450863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b23522cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6';
    var key = Key(hexToBytes(priv));

    assert.equal(bytesToHex(key.getPub()), pub);
    assert.equal(key.compressed, false);

    var priv = '5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh';
    var pub = '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1';
    var addr = '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a';
    var key = Key(priv);

    assert.equal(key.compressed, false);
    assert.equal(bytesToHex(key.getPub()), pub);
    assert.equal(key.getBitcoinAddress().toString(), addr);

    var priv = 'KwntMbt59tTsj8xqpqYqRRWufyjGunvhSyeMo3NTYpFYzZbXJ5Hp';
    var pub = '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa'
    var addr = '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9';
    var key = Key(priv);

    assert.equal(key.compressed, true);
    assert.equal(bytesToHex(key.getPub()), pub);
    assert.equal(key.getBitcoinAddress().toString(), addr);
});

