var BigInteger = require('./jsbn/jsbn');
var sec = require('./jsbn/sec');
var base58 = require('./base58');
var Crypto = require('./crypto-js/crypto');
var util = require('./util');
var conv = require('./convert');
var Address = require('./address');
var ecdsa = require('./ecdsa');
var ECPointFp = require('./jsbn/ec').ECPointFp;

var ecparams = sec("secp256k1");

// input can be nothing, array of bytes, hex string, or base58 string
var ECKey = function (input,compressed) {
    if (!(this instanceof ECKey)) { return new ECKey(input); }
    if (!input) {
        // Generate new key
        var n = ecparams.getN();
        this.priv = ecdsa.getBigRandom(n);
        this.compressed = compressed || false;
    }
    else this.import(input,compressed)
};

ECKey.prototype.import = function (input,compressed) {
    function has(li,v) { return li.indexOf(v) >= 0 }
    function fromBin(x) { return BigInteger.fromByteArrayUnsigned(x) }
    this.priv =
          input instanceof ECKey                   ? input.priv
        : input instanceof BigInteger              ? input.mod(ecparams.getN())
        : util.isArray(input)                      ? fromBin(input.slice(0,32))
        : typeof input != "string"                 ? null
        : input.length == 51 && input[0] == '5'    ? fromBin(base58.checkDecode(input))
        : input.length == 52 && has('LK',input[0]) ? fromBin(base58.checkDecode(input))
        : has([64,65],input.length)                ? fromBin(conv.hexToBytes(input.slice(0,64)))
                                                   : null

    this.compressed =
          compressed !== undefined                 ? compressed
        : input instanceof ECKey                   ? input.compressed
        : input instanceof BigInteger              ? false
        : util.isArray(input)                      ? false
        : typeof input != "string"                 ? null
        : input.length == 51 && input[0] == '5'    ? false
        : input.length == 52 && has('LK',input[0]) ? true
        : input.length == 64                       ? false
        : input.length == 65                       ? true
                                                   : null
};

ECKey.prototype.getPub = function() {
    return ECPubKey(ecparams.getG().multiply(this.priv),this.compressed)
}

/**
 * @deprecated Reserved keyword, factory pattern. Use toHex, toBytes, etc.
 */
ECKey.prototype['export'] = function(format) {
    format || (format = 'hex')
    return this['to' + format.substr(0, 1).toUpperCase() + format.substr(1)]()
};

ECKey.prototype.toBin = function() {
    return conv.bytesToString(this.toBytes())
}

ECKey.prototype.toBase58 = function() {
    return base58.checkEncode(this.toBytes(), 128)
}

ECKey.prototype.toWif = ECKey.prototype.toBase58

ECKey.prototype.toHex = function() {
    return conv.bytesToHex(this.toBytes())
}

ECKey.prototype.toBytes = function() {
    var bytes = this.priv.toByteArrayUnsigned();
    if (this.compressed) bytes.push(1)
    return bytes
}

ECKey.prototype.toString = ECKey.prototype.toBase58

ECKey.prototype.getBitcoinAddress = function(v) {
    return this.getPub().getBitcoinAddress(v)
}

ECKey.prototype.add = function(key) {
    return ECKey(this.priv.add(ECKey(key).priv),this.compressed)
}

ECKey.prototype.multiply = function(key) {
    return ECKey(this.priv.multiply(ECKey(key).priv),this.compressed)
}

var ECPubKey = function(input,compressed) {
    if (!(this instanceof ECPubKey)) { return new ECPubKey(input,compressed); }
    if (!input) {
        // Generate new key
        var n = ecparams.getN();
        this.pub = ecparams.getG().multiply(ecdsa.getBigRandom(n))
        this.compressed = compressed || false;
    }
    else this.import(input,compressed)
}

ECPubKey.prototype.import = function(input,compressed) {
    var decode = function(x) { return ECPointFp.decodeFrom(ecparams.getCurve(), x) }
    this.pub =
          input instanceof ECPointFp ? input
        : input instanceof ECKey     ? ecparams.getG().multiply(input.priv)
        : input instanceof ECPubKey  ? input.pub
        : typeof input == "string"   ? decode(conv.hexToBytes(input))
        : util.isArray(input)        ? decode(input)
                                     : ecparams.getG().multiply(ecdsa.getBigRandom(ecparams.getN()))

    this.compressed =
          arguments.length > 1       ? compressed
        : input instanceof ECPointFp ? input.compressed
        : input instanceof ECPubKey  ? input.compressed
                                     : (this.pub[0] < 4)
}

ECPubKey.prototype.add = function(key) {
    return ECPubKey(this.pub.add(ECPubKey(key).pub),this.compressed)
}

ECPubKey.prototype.multiply = function(key) {
    return ECPubKey(this.pub.multiply(ECKey(key).priv),this.compressed)
}

ECPubKey.prototype['export'] = function(format) {
    format || (format = 'hex')
    return this['to' + format.substr(0, 1).toUpperCase() + format.substr(1)]()
}

ECPubKey.prototype.toBytes = function() {
    return this.pub.getEncoded(this.compressed)
}

ECPubKey.prototype.toHex = function() {
    return conv.bytesToHex(this.toBytes())
}

ECPubKey.prototype.toBin = function() {
    return conv.bytesToString(this.toBytes())
}

ECPubKey.prototype.toString = function() {
    return this.getBitcoinAddress().toString()
}

ECPubKey.prototype.getBitcoinAddress = function(v) {
    return new Address(util.sha256ripe160(this.export()),v);
}


ECKey.prototype.sign = function (hash) {
  return ecdsa.sign(hash, this.priv);
};

ECKey.prototype.verify = function (hash, sig) {
  return ecdsa.verify(hash, sig, this.getPub()['export']('bytes'));
};

/**
 * Parse an exported private key contained in a string.
 */


module.exports = { ECKey: ECKey, ECPubKey: ECPubKey };
