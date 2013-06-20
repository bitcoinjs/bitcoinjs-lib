var base58 = require('./base58');
var Crypto = require('./crypto-js/crypto');
var conv = require('./convert');

var address_types = {
    prod: 0,
    testnet: 111
};

var p2sh_types = {
    prod: 5,
    testnet: 196
};

var Address = function (bytes, address_type) {
  if (typeof bytes === 'string') {
    this.decodeString(bytes, address_type);
  } else {
    this.hash = bytes;
    this.version = address_types[address_type || 'prod'];
  }
};

/**
 * Serialize this object as a standard Bitcoin address.
 *
 * Returns the address as a base58-encoded string in the standardized format.
 */
Address.prototype.toString = function () {
  // Get a copy of the hash
  var hash = this.hash.slice(0);

  // Version
  hash.unshift(this.version);

  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  var bytes = hash.concat(checksum.slice(0,4));

  return base58.encode(bytes);
};

Address.prototype.getHashBase64 = function () {
  return conv.bytesToBase64(this.hash);
};

Address.validateType = function(version, type) {
  if (type) {
    return (version === address_types[type] || version === p2sh_types[type]);
  }
  for (var type in address_types) {
    if (version == address_types[type]) {
      return true;
    }
  }
  for (var type in p2sh_types) {
    if (version == p2sh_types[type]) {
      return true;
    }
  }
  return false;
};

// TODO(shtylman) isValid?
Address.validate = function(string, type) {
  try {
    var bytes = base58.decode(string);
  } catch (e) {
    return false;
  }

  var hash = bytes.slice(0, 21);

  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  if (checksum[0] != bytes[21] ||
      checksum[1] != bytes[22] ||
      checksum[2] != bytes[23] ||
      checksum[3] != bytes[24]) {
    return false;
  }

  if (!Address.validateType(hash[0], type)) {
    return false;
  }

  return true;
};

/**
 * Parse a Bitcoin address contained in a string.
 */
Address.prototype.decodeString = function(string, address_type) {
  var bytes = base58.decode(string);

  var hash = bytes.slice(0, 21);

  var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});

  if (checksum[0] != bytes[21] ||
      checksum[1] != bytes[22] ||
      checksum[2] != bytes[23] ||
      checksum[3] != bytes[24]) {
    throw new Error('Address Checksum validation failed: ' + string);
  }

  var version = hash.shift();
  if (!Address.validateType(version, address_type)) {
    throw new Error('Address version (' + version + ') not supported: ' + string +
                    ' for ' + address_type);
  }

  this.hash = hash;
  this.version = version;
};

module.exports = Address;
