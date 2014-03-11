var base58 = require('./base58');
var convert = require('./convert');
var util = require('./util');
var mainnet = require('./network').mainnet.addressVersion;

var Address = function (bytes, version) {
    if (!(this instanceof Address)) { return new Address(bytes, version); }
    if (arguments[0] instanceof Address) {
        this.hash = arguments[0].hash;
        this.version = arguments[0].version;
    }
    else if (typeof bytes === 'string') {
        this.hash =
              bytes.length <= 35     ? base58.checkDecode(bytes)
            : bytes.length <= 40     ? convert.hexToBytes(bytes)
            :                          util.error('invalid or unrecognized input');

        this.version = version || this.hash.version || mainnet;
    }
    else {
        this.hash = bytes;
        this.version = version || bytes.version || mainnet;
    }
};

/**
 * Serialize this object as a standard Bitcoin address.
 *
 * Returns the address as a base58-encoded string in the standardized format.
 */
Address.prototype.toString = function () {
    return base58.checkEncode(this.hash.slice(0), this.version);
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

module.exports = Address;
