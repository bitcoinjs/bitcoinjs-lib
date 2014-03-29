var base58 = require('./base58')
var convert = require('./convert')
var error = require('./util').error
var mainnet = require('./network').mainnet.addressVersion

function Address(bytes, version) {
  if (!(this instanceof Address))
    return new Address(bytes, version)

  if (bytes instanceof Address) {
    this.hash = bytes.hash
    this.version = bytes.version
  }
  else if (typeof bytes === 'string') {
    this.hash = stringToHash(bytes)
    this.version = version || this.hash.version || mainnet
  }
  else {
    this.hash = bytes
    this.version = version || mainnet
  }
}

function stringToHash(str) {
  if (str.length <= 35) {
    return base58.checkDecode(str)
  }
  if (str.length <= 40) {
    return convert.hexToBytes(str)
  }
  error('invalid or unrecognized input')
}

/**
 * Serialize this object as a standard Bitcoin address.
 * Returns the address as a base58-encoded string in the standardized format.
 */
Address.prototype.toString = function () {
  return base58.checkEncode(this.hash.slice(0), this.version)
}

/**
 * Returns the version of an address, e.g. if the address belongs to the main
 * net or the test net.
 */
Address.getVersion = function (address) {
  return base58.decode(address)[0]
}

/**
 * Returns true if a bitcoin address is a valid address, otherwise false.
 */
Address.validate = function (address) {
  try {
    base58.checkDecode(address)
    return true
  } catch (e) {
    return false
  }
}

module.exports = Address
