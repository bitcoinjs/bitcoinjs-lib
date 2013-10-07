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

var Address = function (bytes) {
    if (typeof bytes === 'string') {
        this.hash = base58.decode(bytes);
        this.version = this.hash.version;
    }
    else {
        this.hash = bytes;
        this.version = 0x00;
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

  return base58.checkEncode(hash,this.version);
};

Address.prototype.getHash = function () {
  return conv.bytesToHex(this.hash);
};

Address.getVersion = function(string) {
  return base58.decode(string)[0];
}

// TODO(shtylman) isValid?
Address.validate = function(string) {
  try {
      base58.checkDecode(string);
  } catch (e) {
      return false;
  }
  return true;
};

/**
 * Parse a Bitcoin address contained in a string.
 */
Address.decodeString = function (string) {
  return base58.checkDecode(string);
};

module.exports = Address;
