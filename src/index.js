var Key = require('./eckey');

module.exports = {
    Address: require('./address'),
    Key: Key.ECKey,
    ECKey: Key.ECKey,
    ECPubKey: Key.ECPubKey,
    Message: require('./message'),
    BigInteger: require('./jsbn/jsbn'),
    Crypto: require('crypto-js'), //should we expose this at all?
    Script: require('./script'),
    Opcode: require('./opcode'),
    Transaction: require('./transaction').Transaction,
    Util: require('./util'),
    TransactionIn: require('./transaction').TransactionIn,
    TransactionOut: require('./transaction').TransactionOut,
    ECPointFp: require('./jsbn/ec').ECPointFp,
    Wallet: require('./wallet'),
    network: require('./network'),

    ecdsa: require('./ecdsa'),
    HDWallet: require('./hdwallet.js'),

    // base58 encoding/decoding to bytes
    base58: require('./base58'),

    // conversions
    convert: require('./convert')
}
