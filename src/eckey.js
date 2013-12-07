var BigInteger = require('./jsbn/jsbn');
var sec = require('./jsbn/sec');
var base58 = require('./base58');
var Crypto = require('./crypto-js/crypto');
var util = require('./util');
var conv = require('./convert');
var Address = require('./address');
var ecdsa = require('./ecdsa');

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
  } else if (input instanceof BigInteger) {
    // Input is a private key value
    this.priv = input;
  } else if (util.isArray(input)) {
    // Prepend zero byte to prevent interpretation as negative integer
    this.priv = BigInteger.fromByteArrayUnsigned(input);
    this.compressed = false;
  } else if ("string" == typeof input) {
    if (input.length == 51 && input[0] == '5') {
      // Base58 encoded private key
      this.priv = BigInteger.fromByteArrayUnsigned(ECKey.decodeString(input));
      this.compressed = false;
    }
    else if (input.length == 52 && (input[0] === 'K' || input[0] === 'L')) {
      // Base58 encoded private key
      this.priv = BigInteger.fromByteArrayUnsigned(ECKey.decodeString(input));
      this.compressed = true;
    } else {
      // hex string?
      // //wtf is base64 here for?
      // Prepend zero byte to prevent interpretation as negative integer
      this.priv = BigInteger.fromByteArrayUnsigned(conv.base64ToBytes(input));
    }
  }
};

// TODO(shtylman) methods
// wallet import format (base58 check with meta info)
// fromWIF
// toWIF
// fromBytes
// toBytes
// fromHex
// toHex

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

ECKey.prototype.getExportedPrivateKey = function () {
  var hash = this.priv.toByteArrayUnsigned();
  while (hash.length < 32) hash.unshift(0);
  hash.unshift(0x80);
  if (this.compressed) {
      hash.push(0x01);
  }
  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});
  var bytes = hash.concat(checksum.slice(0,4));
  return base58.encode(bytes);
};

ECKey.prototype.setPub = function (pub) {
  this.pub = ECPointFp.decodeFrom(ecparams.getCurve(), pub);
};

ECKey.prototype.toString = function (format) {
  if (format === "base64") {
    return conv.bytesToBase64(this.priv.toByteArrayUnsigned());
  } else {
    return Crypto.util.bytesToHex(this.priv.toByteArrayUnsigned());
  }
};

ECKey.prototype.sign = function (hash) {
  return ecdsa.sign(hash, this.priv);
};

ECKey.prototype.verify = function (hash, sig) {
  return ecdsa.verify(hash, sig, this.getPub());
};

/**
 * Parse an exported private key contained in a string.
 */
ECKey.decodeString = function (string) {
  var bytes = base58.decode(string);

  if (bytes.length !== 37 && bytes.length !== 38) {
    throw new Error('not a valid base58 encoded private key');
  }

  //Format:
  //* uncompressed: 0x80 + [32-byte secret] + [4 bytes of Hash() of
  //previous 33 bytes], base58 encoded
  //* compressed: 0x80 + [32-byte secret] + 0x01 + [4 bytes of Hash()
  //previous 34 bytes], base58 encoded

  if (bytes[33] === 0x01) {
    // compressed
  }

  var hash = bytes.slice(0, 33);

  /*
  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  if (checksum[0] != bytes[33] ||
      checksum[1] != bytes[34] ||
      checksum[2] != bytes[35] ||
      checksum[3] != bytes[36]) {
    throw "Checksum validation failed!";
  }
  */

  var version = hash.shift();

  if (version != 0x80) {
    throw "Version "+version+" not supported!";
  }

  return hash;
};

module.exports = ECKey;
