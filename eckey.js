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
			// Prepend zero byte to prevent interpretation as negative integer
			this.priv = BigInteger.fromByteArrayUnsigned(Crypto.util.base64ToBytes(input));
		}
	};

	ECKey.prototype.getPub = function () {
		if (this.pub) return this.pub;

		return this.pub = ecparams.getG().multiply(this.priv).getEncoded();
	};

	ECKey.prototype.getPubKeyHash = function () {
		if (this.pubKeyHash) return this.pubKeyHash;

		return this.pubKeyHash = Bitcoin.Util.sha256ripe160(this.getPub());
	};

	ECKey.prototype.getBitcoinAddress = function () {
		var hash = this.getPubKeyHash();
		var addr = new Bitcoin.Address(hash);
		return addr;
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

	return ECKey;
})();
