/// Implements Bitcoin's feature for signing arbitrary messages.
var Address = require('./address')
var BigInteger = require('bigi')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var ecdsa = require('./ecdsa')
var networks = require('./networks')

var Address = require('./address')
var ECPubKey = require('./ecpubkey')
var ECSignature = require('./ecsignature')

var ecurve = require('ecurve')
var ecparams = ecurve.getCurveByName('secp256k1')

function magicHash(message, network) {
  var magicPrefix = new Buffer(network.magicPrefix)
  var messageBuffer = new Buffer(message)
  var lengthBuffer = new Buffer(bufferutils.varIntSize(messageBuffer.length))
  bufferutils.writeVarInt(lengthBuffer, messageBuffer.length, 0)

  var buffer = Buffer.concat([magicPrefix, lengthBuffer, messageBuffer])
  return crypto.hash256(buffer)
}

function sign(privKey, message, network) {
  network = network || networks.bitcoin

  var hash = magicHash(message, network)
  var signature = privKey.sign(hash)
  var e = BigInteger.fromBuffer(hash)
  var i = ecdsa.calcPubKeyRecoveryParam(ecparams, e, signature, privKey.pub.Q)

  return signature.toCompact(i, privKey.pub.compressed)
}

// TODO: network could be implied from address
function verify(address, signatureBuffer, message, network) {
  if (address instanceof Address) {
    address = address.toString()
  }
  network = network || networks.bitcoin

  var hash = magicHash(message, network)
  var parsed = ECSignature.parseCompact(signatureBuffer)
  var e = BigInteger.fromBuffer(hash)
  var Q = ecdsa.recoverPubKey(ecparams, e, parsed.signature, parsed.i)

  var pubKey = new ECPubKey(Q, parsed.compressed)
  return pubKey.getAddress(network).toString() === address
}

module.exports = {
  magicHash: magicHash,
  sign: sign,
  verify: verify
}
