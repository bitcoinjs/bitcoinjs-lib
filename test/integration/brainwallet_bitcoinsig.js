/**
 * 
 * Forked by Kevin Tam, https://github.com/brainwallet/brainwallet.github.io/blob/master/js/bitcoinsig.js on 08/08/2014
 * which was based on Bitcoin 0.13. The test here is updated to bitcoinjs-lib master, with the intention
 * of keeping up to date with latest APIs
 */

var Base58 = require('bs58');
var assert = require('assert');
var Bitcoin = require('../../')
var BigInteger = require('bigi');

function sha256(b) {
    return Bitcoin.crypto.sha256(b);
}

function bitcoinsig_test() {
    var k = '5JeWZ1z6sRcLTJXdQEDdB986E6XfLAkj9CgNE4EHzr5GmjrVFpf';
    var a = '17mDAmveV5wBwxajBsY7g1trbMW1DVWcgL';
    var s = 'HDiv4Oe9SjM1FFVbKk4m3N34efYiRgkQGGoEm564ldYt44jHVTuX23+WnihNMi4vujvpUs1M529P3kftjDezn9E=';
    var m = 'test message';

    var secp256k1 = Bitcoin.ECKey.curve;

    // Part un - Verify pre-signed message
    var siginfo = new Bitcoin.ECSignature.parseCompact(new Buffer(s,"base64"));
    //var hash = Bitcoin.Message.magicHash(m, Bitcoin.networks.bitcoin);
    var hash = Bitcoin.Message.magicHash(m, {magicPrefix: '\x18Bitcoin Signed Message:\n'});
    assert.equal(hash.toString("base64"), "EiYXnd9jg/vPUQLJSSU4tyBsc5rnnrBkQIwqvWfTm+0=");

    // Is there way to do this without pulling in BigInteger?
    var e = BigInteger.fromBuffer(hash);
    var pubkeyQ = Bitcoin.ecdsa.recoverPubKey(secp256k1, e, siginfo.signature, siginfo.i);
    var pubkey = new Bitcoin.ECPubKey(pubkeyQ, siginfo.compressed);
    assert.equal(pubkey.getAddress().toBase58Check(), a, "Extract pub address from signature should match pub addr");
    var v1 = Bitcoin.ecdsa.verify(secp256k1, hash, siginfo.signature, pubkeyQ);
    assert(v1, "Signature should pass");
    // Part deux - do signing and reverify
    var payload = Base58.decode(k);
    var priv = Bitcoin.ECKey.fromWIF(k)
    var sig = priv.sign(hash);
    var v2 = Bitcoin.ecdsa.verify(secp256k1, hash, siginfo.signature, pubkeyQ);
    assert(v2, "Signature should pass after re-signing")
}

bitcoinsig_test();
