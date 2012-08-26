Bitcoin.ECKey = (function () {
  var ECDSA = Bitcoin.ECDSA;
  var ecparams = getSECCurveByName("secp256k1");
  var rng = new SecureRandom();

  var ECKey = function (input) {
    if (!input) {
      // Generate new key
      var n = ecparams.getN();
      this.priv = ECDSA.getBigRandom(n);
    } else if (input instanceof BigInteger) {
      // Input is a private key value
      this.priv = input;
    } else if (Bitcoin.Util.isArray(input)) {
      // Prepend zero byte to prevent interpretation as negative integer
      this.priv = BigInteger.fromByteArrayUnsigned(input);
    } else if ("string" == typeof input) {
      if (input.length == 51 && input[0] == '5') {
        // Base58 encoded private key
        this.priv = BigInteger.fromByteArrayUnsigned(ECKey.decodeString(input));
      } else {
        // Prepend zero byte to prevent interpretation as negative integer
        this.priv = BigInteger.fromByteArrayUnsigned(Crypto.util.base64ToBytes(input));
      }
    }
    this.compressed = !!ECKey.compressByDefault;
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

    return this.pubKeyHash = Bitcoin.Util.sha256ripe160(this.getPub());
  };

  ECKey.prototype.getBitcoinAddress = function () {
    var hash = this.getPubKeyHash();
    var addr = new Bitcoin.Address(hash);
    return addr;
  };

  ECKey.prototype.getExportedPrivateKey = function () {
    var hash = this.priv.toByteArrayUnsigned();
    while (hash.length < 32) hash.unshift(0);
    hash.unshift(0x80);
    var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});
    var bytes = hash.concat(checksum.slice(0,4));
    return Bitcoin.Base58.encode(bytes);
  };

  ECKey.prototype.setPub = function (pub) {
    this.pub = ECPointFp.decodeFrom(ecparams.getCurve(), pub);
  };

  ECKey.prototype.toString = function (format) {
    if (format === "base64") {
      return Crypto.util.bytesToBase64(this.priv.toByteArrayUnsigned());
    } else {
      return Crypto.util.bytesToHex(this.priv.toByteArrayUnsigned());
    }
  };

  ECKey.prototype.sign = function (hash) {
    return ECDSA.sign(hash, this.priv);
  };

  ECKey.prototype.verify = function (hash, sig) {
    return ECDSA.verify(hash, sig, this.getPub());
  };

  /**
   * Parse an exported private key contained in a string.
   */
  ECKey.decodeString = function (string) {
    var bytes = Bitcoin.Base58.decode(string);

    var hash = bytes.slice(0, 33);

    var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

    if (checksum[0] != bytes[33] ||
        checksum[1] != bytes[34] ||
        checksum[2] != bytes[35] ||
        checksum[3] != bytes[36]) {
      throw "Checksum validation failed!";
    }

    var version = hash.shift();

    if (version != 0x80) {
      throw "Version "+version+" not supported!";
    }

    return hash;
  };

  return ECKey;
})();
