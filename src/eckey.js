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
var ECKey = function (input) {
    if (!(this instanceof ECKey)) {
        return new ECKey(input);
    }

    this.compressed = !!ECKey.compressByDefault;

    if (!input) {
        // Generate new key
        var n = ecparams.getN();
        this.priv = ecdsa.getBigRandom(n);
    }
    else this.import(input)
};

/**
 * Whether public keys should be returned compressed by default.
 */
ECKey.compressByDefault = false;

/**
 * Set whether the public key should be returned compressed or not.
 */
ECKey.prototype.setCompressed = function (v) {
  this.compressed = !!v;
};

/**
 * Return public key in DER encoding.
 */
ECKey.prototype.getPub = function () {
    return this.getPubPoint().getEncoded(this.compressed);
};

/**
 * Return public point as ECPoint object.
 */
ECKey.prototype.getPubPoint = function () {
    if (!this.pub) this.pub = ecparams.getG().multiply(this.priv);
    return this.pub;
};

/**
 * Get the pubKeyHash for this key.
 *
 * This is calculated as RIPE160(SHA256([encoded pubkey])) and returned as
 * a byte array.
 */
ECKey.prototype.getPubKeyHash = function () {
    if (this.pubKeyHash) return this.pubKeyHash;
    return this.pubKeyHash = util.sha256ripe160(this.getPub());
};

ECKey.prototype.getBitcoinAddress = function () {
    var hash = this.getPubKeyHash();
    var addr = new Address(hash);
    return addr;
};

ECKey.prototype.setPub = function (pub) {
    this.pub = ECPointFp.decodeFrom(ecparams.getCurve(), pub);
    this.compressed = (pub[0] < 4)
    return this
};

ECKey.prototype.export = function (format) {
    var bytes = this.priv.toByteArrayUnsigned();
    if (this.compressed)
         bytes.push(1)
    return format === "base58"    ? base58.checkEncode(bytes,128) 
         : format === "bin"       ? conv.bytesToString(bytes)
         : format === "bytes"     ? bytes
         : format === "hex"       ? conv.bytesToHex(bytes)
         :                          bytes                    
};
ECKey.prototype.getExportedPrivateKey = ECKey.prototype.export;

ECKey.prototype.toString = function (format) {
    return ''+this.export(format)
}

ECKey.prototype.sign = function (hash) {
  return ecdsa.sign(hash, this.priv);
};

ECKey.prototype.verify = function (hash, sig) {
  return ecdsa.verify(hash, sig, this.getPub());
};

/**
 * Parse an exported private key contained in a string.
 */
ECKey.prototype.import = function (input) {
    if (input instanceof ECKey) {
        this.priv = input.priv;
        this.compressed = input.compressed;
    }
    else if (input instanceof BigInteger) {
        // Input is a private key value
        this.priv = input;
        this.compressed = ECKey.compressByDefault;
    }
    else if (util.isArray(input)) {
        // Prepend zero byte to prevent interpretation as negative integer
        this.priv = BigInteger.fromByteArrayUnsigned(input.slice(0,32));
        this.compressed = (input.length == 33);
    }
    else if ("string" == typeof input) {
        if (input.length == 51 && input[0] == '5') {
            // Base58 encoded private key
            this.priv = BigInteger.fromByteArrayUnsigned(base58.checkDecode(input));
            this.compressed = false;
        }
        else if (input.length == 52 && (input[0] === 'K' || input[0] === 'L')) {
            // Base58 encoded private key
            this.priv = BigInteger.fromByteArrayUnsigned(base58.checkDecode(input));
            this.compressed = true;
        }
        else if (input.length >= 64) {
            // hex string?
            this.priv = BigInteger.fromByteArrayUnsigned(conv.hexToBytes(input.slice(0,64)));
            this.compressed = (input.length == 66)
        }
    }
};

module.exports = ECKey;
