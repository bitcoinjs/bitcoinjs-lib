/// Implements Bitcoin's feature for signing arbitrary messages.

var Address = require('./address')
var BufferExt = require('./buffer')
var crypto = require('./crypto')
var ecdsa = require('./ecdsa')
var ECPubKey = require('./eckey').ECPubKey

// FIXME: incompatible with other networks (Litecoin etc)
var MAGIC_PREFIX = new Buffer('\x18Bitcoin Signed Message:\n')

function magicHash(message) {
  var messageBuffer = new Buffer(message)
  var lengthBuffer = new Buffer(BufferExt.varIntSize(messageBuffer.length))
  BufferExt.writeVarInt(lengthBuffer, messageBuffer.length, 0)

  var buffer = Buffer.concat([
    MAGIC_PREFIX, lengthBuffer, messageBuffer
  ])
  return crypto.hash256(buffer)
}

// TODO: parameterize compression instead of using ECKey.compressed
function sign(key, message) {
  var hash = magicHash(message)
  var sig = ecdsa.parseSig(key.sign(hash))
  var i = ecdsa.calcPubKeyRecoveryParam(key.pub.Q, sig.r, sig.s, hash)

  i += 27
  if (key.pub.compressed) {
    i += 4
  }

  var rB = sig.r.toBuffer(32)
  var sB = sig.s.toBuffer(32)

  return Buffer.concat([new Buffer([i]), rB, sB], 65)
}

// FIXME: stricter API?
function verify(address, sig, message) {
  if (typeof address === 'string') {
    address = Address.fromBase58Check(address)
  }

  sig = ecdsa.parseSigCompact(sig)

  var pubKey = new ECPubKey(ecdsa.recoverPubKey(sig.r, sig.s, magicHash(message), sig.i))
  pubKey.compressed = !!(sig.i & 4)

  return pubKey.getAddress(address.version).toString() === address.toString()
}

module.exports = {
  magicHash: magicHash,
  sign: sign,
  verify: verify
}
