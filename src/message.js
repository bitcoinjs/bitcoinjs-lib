/// Implements Bitcoin's feature for signing arbitrary messages.

var Address = require('./address')
var convert = require('./convert')
var crypto = require('./crypto')
var ecdsa = require('./ecdsa')
var ECPubKey = require('./eckey').ECPubKey

// FIXME: magicHash is incompatible with other magic messages
var magicBytes = new Buffer('Bitcoin Signed Message:\n')

function magicHash(message) {
  var messageBytes = new Buffer(message)

  var buffer = Buffer.concat([
    new Buffer(convert.numToVarInt(magicBytes.length)),
    magicBytes,
    new Buffer(convert.numToVarInt(messageBytes.length)),
    messageBytes
  ])

  return crypto.hash256(buffer)
}

// TODO: parameterize compression instead of using ECKey.compressed
function sign(key, message) {
  var hash = magicHash(message)
  var sig = key.sign(hash)
  var obj = ecdsa.parseSig(sig)
  var i = ecdsa.calcPubKeyRecoveryParam(key.pub.Q, obj.r, obj.s, hash)

  i += 27
  if (key.pub.compressed) {
    i += 4
  }

  var rBa = obj.r.toByteArrayUnsigned()
  var sBa = obj.s.toByteArrayUnsigned()

  // Pad to 32 bytes per value
  while (rBa.length < 32) rBa.unshift(0);
  while (sBa.length < 32) sBa.unshift(0);

  sig = [i].concat(rBa, sBa)

  return sig
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
