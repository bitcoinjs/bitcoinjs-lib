// Bit-wise rotate left
var rotl = function (n, b) {
    return (n << b) | (n >>> (32 - b));
};

// Bit-wise rotate right
var rotr = function (n, b) {
    return (n << (32 - b)) | (n >>> b);
};

// Swap big-endian to little-endian and vice versa
var endian = function (n) {
    // If number given, swap endian
    if (n.constructor == Number) {
        return rotl(n,  8) & 0x00FF00FF | rotl(n, 24) & 0xFF00FF00;
    }

    // Else, assume array and swap all items
    for (var i = 0; i < n.length; i++) {
        n[i] = endian(n[i]);
    }
    return n;
}

module.exports = {
    Address: require('./address'),
    Key: require('./eckey'),
    Message: require('./message'),
    BigInteger: require('./jsbn/jsbn'),
    Crypto: require('./crypto-js/crypto'),
    Script: require('./script'),
    Opcode: require('./opcode'),
    Transaction: require('./transaction').Transaction,
    Util: require('./util'),
    TransactionIn: require('./transaction').TransactionIn,
    TransactionOut: require('./transaction').TransactionOut,
    ECPointFp: require('./jsbn/ec').ECPointFp,
    Wallet: require('./wallet'),

    ecdsa: require('./ecdsa'),
    BIP32key: require('./bip32'),

    // base58 encoding/decoding to bytes
    base58: require('./base58'),

    // conversions
    convert: require('./convert'),

    endian: endian
}
