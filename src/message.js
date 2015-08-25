var bufferutils = require('./bufferutils')
var bcrypto = require('./crypto')
var ecdsa = require('./ecdsa')
var networks = require('./networks')

var BigInteger = require('bigi')
var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')

function magicHash (message, network) {
  var messagePrefix = new Buffer(network.messagePrefix)
  var messageBuffer = new Buffer(message)
  var lengthBuffer = bufferutils.varIntBuffer(messageBuffer.length)

  var buffer = Buffer.concat([messagePrefix, lengthBuffer, messageBuffer])
  return bcrypto.hash256(buffer)
}

function sign (keyPair, message, network) {
  network = network || networks.bitcoin

  var hash = magicHash(message, network)
  var signature = keyPair.sign(hash)
  var e = BigInteger.fromBuffer(hash)
  var i = ecdsa.calcPubKeyRecoveryParam(e, signature, keyPair.Q)

  return signature.toCompact(i, keyPair.compressed)
}

function verify (address, signature, message, network) {
  if (!Buffer.isBuffer(signature)) {
    signature = new Buffer(signature, 'base64')
  }

  network = network || networks.bitcoin

  var hash = magicHash(message, network)
  var parsed = ECSignature.parseCompact(signature)
  var e = BigInteger.fromBuffer(hash)
  var Q = ecdsa.recoverPubKey(e, parsed.signature, parsed.i)

  var keyPair = new ECPair(null, Q, {
    compressed: parsed.compressed,
    network: network
  })

  return keyPair.getAddress() === address
}

module.exports = {
  magicHash: magicHash,
  sign: sign,
  verify: verify
}
