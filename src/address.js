Bitcoin.Address = function (bytes) {
  if ("string" == typeof bytes) {
    bytes = Bitcoin.Address.decodeString(bytes);
  }
  this.hash = bytes;

  this.version = 0x00;
};

/**
 * Serialize this object as a standard Bitcoin address.
 *
 * Returns the address as a base58-encoded string in the standardized format.
 */
Bitcoin.Address.prototype.toString = function () {
  // Get a copy of the hash
  var hash = this.hash.slice(0);

  // Version
  hash.unshift(this.version);

  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  var bytes = hash.concat(checksum.slice(0,4));

  return Bitcoin.Base58.encode(bytes);
};

Bitcoin.Address.prototype.getHashBase64 = function () {
  return Crypto.util.bytesToBase64(this.hash);
};

/**
 * Parse a Bitcoin address contained in a string.
 */
Bitcoin.Address.decodeString = function (string) {
  var bytes = Bitcoin.Base58.decode(string);

  var hash = bytes.slice(0, 21);

  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  if (checksum[0] != bytes[21] ||
      checksum[1] != bytes[22] ||
      checksum[2] != bytes[23] ||
      checksum[3] != bytes[24]) {
    throw "Checksum validation failed!";
  }

  var version = hash.shift();

  if (version != 0) {
    throw "Version "+version+" not supported!";
  }

  return hash;
};
