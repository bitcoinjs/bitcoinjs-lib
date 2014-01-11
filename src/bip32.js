var util = require('./util'),
    Address = require('./address'),
    conv = require('./convert'),
    ECKey = require('./eckey').ECKey,
    ECPubKey = require('./eckey').ECPubKey,
    base58 = require('./base58'),
    assert = require('assert'),
    Crypto = require('./crypto-js/crypto');

var BIP32key = function(opts) {
    if (!opts) opts = {}
    if (typeof opts == 'string') {
        try {
            opts = BIP32key.deserialize(opts);
        }
        catch(e) {
            opts = BIP32key.fromMasterKey(opts);
        }
    }
    this.vbytes = opts.vbytes;
    this.depth = opts.depth;
    this.fingerprint = opts.fingerprint;
    this.i = opts.i;
    this.chaincode = opts.chaincode;
    this.key = opts.key;
    this.type = conv.bytesToString(this.vbytes) == PRIVDERIV ? 'priv' : 'pub'
    return this;
}

var PRIVDERIV = BIP32key.PRIVDERIV = '\x04\x88\xAD\xE4'
var PUBDERIV = BIP32key.PUBDERIV = '\x04\x88\xB2\x1E'

BIP32key.deserialize = function(str) {
    var bytes = base58.decode(str)
    var front = bytes.slice(0,bytes.length-4),
        back = bytes.slice(bytes.length-4);
    var checksum = Crypto.SHA256(Crypto.SHA256(front,{asBytes: true}), {asBytes: true})
                        .slice(0,4);
    if ('' + checksum != '' + back) {
        throw new Error('Checksum failed');
    }
    var type = conv.bytesToString(bytes.slice(0,4)) == PRIVDERIV ? 'priv' : 'pub';
    return new BIP32key({
        type: type,
        vbytes: bytes.slice(0,4),
        depth: bytes[4],
        fingerprint: bytes.slice(5,9),
        i: util.bytesToNum(bytes.slice(9,13).reverse()),
        chaincode: bytes.slice(13,45),
        key: type == 'priv' ? new ECKey(bytes.slice(46,78).concat([1]),true)
                            : new ECPubKey(bytes.slice(45,78),true)
    })
}

BIP32key.prototype.serialize = function(enc) {
    var bytes = []

    // 4 byte: version bytes (mainnet: 0x0488B21E public, 0x0488ADE4 private; testnet: 0x043587CF public, 0x04358394 private)
    bytes = bytes.concat(this.vbytes)
    assert.equal(bytes.length, 4)

    // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ....
    bytes = bytes.concat([this.depth])
    assert.equal(bytes.length, 4 + 1)

    // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
    bytes = bytes.concat(this.fingerprint)
    assert.equal(bytes.length, 4 + 1 + 4)

    // 4 bytes: child number. This is the number i in xi = xpar/i,
    // with xi the key being serialized. This is encoded in MSB order. (0x00000000 if master key)
    bytes = bytes.concat(util.numToBytes(this.i, 4).reverse())
    assert.equal(bytes.length, 4 + 1 + 4 + 4)

    // 32 bytes: the chain code
    bytes = bytes.concat(this.chaincode)
    assert.equal(bytes.length, 4 + 1 + 4 + 4 + 32)

    // 33 bytes: the public key or private key data
    // (0x02 + X or 0x03 + X for public keys, 0x00 + k for private keys)
    if (this.type == 'priv') {
        bytes.push(0)
        bytes = bytes.concat(this.key.toBytes().slice(0, 32))
    } else {
        bytes = bytes.concat(this.key.toBytes())
    }

    assert.equal(bytes.length, 78)

    if (enc == 'bytes') return bytes
    if (enc == 'hex') return conv.bytesToHex(bytes)

    var checksum = Crypto.SHA256(Crypto.SHA256(bytes, {asBytes: true}), { asBytes: true }).slice(0,4)
    bytes = bytes.concat(checksum)

    return base58.encode(bytes)
}

BIP32key.prototype.ckd = function(i) {
    var priv, pub, newkey, fingerprint, blob, I;
    if (this.type == 'priv') {
        priv = this.key.export('bytes')
        pub = this.key.getPub().export('bytes')
    }
    else pub = this.key.export('bytes')

    if (i >= 2147483648) {
        if (!priv) throw new Error("Can't do private derivation on public key!")
        blob = [0].concat(priv.slice(0,32),util.numToBytes(i,4).reverse())
    }
    else blob = pub.concat(util.numToBytes(i,4).reverse())

    I = Crypto.HMAC(Crypto.SHA512,blob,this.chaincode,{ asBytes: true })

    if (this.type == 'priv') {
        newkey = this.key.add(ECKey(I.slice(0,32).concat([1])))
        fingerprint = util.sha256ripe160(this.key.getPub().export('bytes')).slice(0,4)
    }
    else {
        newkey = this.key.add(ECKey(I.slice(0,32).concat([1])).getPub());
        fingerprint = util.sha256ripe160(this.key.export('bytes')).slice(0,4)
    }
    return new BIP32key({
        vbytes: this.vbytes,
        type: this.type,
        depth: this.depth + 1,
        fingerprint: fingerprint,
        i: i,
        chaincode: I.slice(32),
        key: newkey
    })
}

BIP32key.prototype.clone = function() {
    return new BIP32key(this);
}

BIP32key.prototype.privtopub = BIP32key.prototype.getPub = function() {
    if (this.type == 'pub') return this.clone()
    return new BIP32key({
        vbytes: conv.stringToBytes(PUBDERIV),
        type: 'pub',
        depth: this.depth,
        fingerprint: this.fingerprint,
        i: this.i,
        chaincode: this.chaincode,
        key: this.key.getPub()
    })
}

BIP32key.fromMasterKey = function(seed) {
    var I = Crypto.HMAC(Crypto.SHA512,seed, 'Bitcoin seed', { asBytes: true })
    return new BIP32key({
        vbytes: conv.stringToBytes(PRIVDERIV),
        type: 'priv',
        depth: 0,
        fingerprint: [0,0,0,0],
        i: 0,
        chaincode: I.slice(32),
        key: new ECKey(I.slice(0,32).concat([1]),true)
    })
}

BIP32key.prototype.getKey = function() { return this.key }

BIP32key.prototype.bitcoinAddress = function() {
    return new Address(util.sha256ripe160(this.getPub().key.export('bytes')))
}

module.exports = BIP32key;
