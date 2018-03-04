var bcrypto = require('./crypto')
var btemplates = require('./templates')

function checkAllowedP2sh (keyFactory) {
  if (!(keyFactory instanceof P2pkhFactory ||
      keyFactory instanceof P2wpkhFactory ||
      keyFactory instanceof P2pkFactory
    )) {
    throw new Error('Unsupported script factory for P2SH')
  }
}

function checkAllowedP2wsh (keyFactory) {
  if (!(keyFactory instanceof P2pkhFactory ||
      keyFactory instanceof P2pkFactory
    )) {
    throw new Error('Unsupported script factory for P2SH')
  }
}

var P2pkFactory = function () {

}

/**
 * @param {bitcoin.ECPair} key
 */
P2pkFactory.prototype.convert = function (key) {
  return {
    scriptPubKey: btemplates.pubKey.output.encode(key.getPublicKeyBuffer()),
    signData: {}
  }
}

var P2pkhFactory = function () {

}

/**
 * @param {bitcoin.ECPair} key
 */
P2pkhFactory.prototype.convert = function (key) {
  var hash160 = bcrypto.hash160(key.getPublicKeyBuffer())
  return {
    scriptPubKey: btemplates.pubKeyHash.output.encode(hash160),
    signData: {}
  }
}

var P2wpkhFactory = function () {

}

/**
 * @param {bitcoin.ECPair} key
 */
P2wpkhFactory.prototype.convert = function (key) {
  var hash160 = bcrypto.hash160(key.getPublicKeyBuffer())
  return {
    scriptPubKey: btemplates.witnessPubKeyHash.output.encode(hash160),
    signData: {}
  }
}

var P2shFactory = function (keyFactory) {
  checkAllowedP2sh(keyFactory)
  this.factory = keyFactory
}

P2shFactory.prototype.convert = function (key) {
  var detail = this.factory.convert(key)
  var hash160 = bcrypto.hash160(detail.scriptPubKey)
  return {
    scriptPubKey: btemplates.scriptHash.output.encode(hash160),
    signData: {
      redeemScript: detail.scriptPubKey
    }
  }
}

var P2wshFactory = function (keyFactory) {
  checkAllowedP2wsh(keyFactory)
  this.factory = keyFactory
}

P2wshFactory.prototype.convert = function (key) {
  var detail = this.factory.convert(key)
  var hash160 = bcrypto.hash160(detail.scriptPubKey)
  return {
    scriptPubKey: btemplates.scriptHash.output.encode(hash160),
    signData: {
      redeemScript: detail.scriptPubKey
    }
  }
}

var P2shP2wshFactory = function (keyFactory) {
  checkAllowedP2wsh(keyFactory)
  this.factory = keyFactory
}

P2shP2wshFactory.prototype.convert = function (key) {
  var detail = this.factory.convert(key)
  var sha256 = bcrypto.sha256(detail.scriptPubKey)
  var wp = btemplates.witnessScriptHash.output.encode(sha256)
  var hash160 = bcrypto.hash160(wp)
  var spk = btemplates.scriptHash.output.encode(hash160)
  return {
    scriptPubKey: spk,
    signData: {
      redeemScript: wp,
      witnessScript: detail.scriptPubKey
    }
  }
}

module.exports = {
  P2pkhFactory: P2pkhFactory,
  P2wpkhFactory: P2wpkhFactory,
  P2pkFactory: P2pkFactory,
  P2shFactory: P2shFactory,
  P2wshFactory: P2wshFactory,
  P2shP2wshFactory: P2shP2wshFactory
}
