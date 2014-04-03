var base58 = require('./base58')
var base58check = require('./base58check')
var convert = require('./convert')
var error = require('./util').error
var mainnet = require('./network').mainnet.addressVersion

function Address(bytes, version) {
  if (!(this instanceof Address)) {
    return new Address(bytes, version)
  }

  if (bytes instanceof Address) {
    this.hash = bytes.hash
    this.version = bytes.version
  }
  else if (typeof bytes === 'string') {
    if (bytes.length <= 35) {
      var decode = base58check.decode(bytes)

      this.hash = decode.payload
      this.version = decode.version
    }
    else if (bytes.length <= 40) {
      this.hash = convert.hexToBytes(bytes)
      this.version = version || mainnet
    }
    else {
      error('invalid or unrecognized input')
    }
  }
  else {
    this.hash = bytes
    this.version = version || mainnet
  }
}

/**
 * Serialize this object as a standard Bitcoin address.
 * Returns the address as a base58-encoded string in the standardized format.
 */
Address.prototype.toString = function () {
  return base58check.encode(this.hash.slice(0), this.version)
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
    base58check.decode(address)
    return true
  } catch (e) {
    return false
  }
}

module.exports = Address
