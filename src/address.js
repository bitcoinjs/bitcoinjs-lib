var base58 = require('./base58');
var Crypto = require('./crypto-js/crypto');
var conv = require('./convert');
var util = require('./util');

var address_types = {
    prod: 0,
    testnet: 111
};

var p2sh_types = {
    prod: 5,
    testnet: 196
};

var Address = function (bytes, version) {
    if (arguments[0] instanceof Address) {
        this.hash = arguments[0].hash;
        this.version = arguments[0].version;
    }
    else if (typeof bytes === 'string') {
        this.hash = 
              bytes.length <= 34     ? base58.checkDecode(bytes)
            : bytes.length <= 40     ? conv.hexToBytes(bytes)
            :                          util.error('Bad input');              

        this.version = version || this.hash.version || 0;
    }
    else {
        this.hash = bytes;
        this.version = version || 0;
    }
};

/**
 * Serialize this object as a standard Bitcoin address.
 *
 * Returns the address as a base58-encoded string in the standardized format.
 */
Address.prototype.toString = function () {
    return base58.checkEncode(this.hash.slice(0),this.version);
};

Address.prototype.getHash = function () {
    return conv.bytesToHex(this.hash);
};

Address.getVersion = function(string) {
    return base58.decode(string)[0];
}

Address.validate = function(string) {
    try {
        base58.checkDecode(string);
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Parse a Bitcoin address contained in a string.
 */
Address.decodeString = function (string) {
    return base58.checkDecode(string);
};

module.exports = Address;
