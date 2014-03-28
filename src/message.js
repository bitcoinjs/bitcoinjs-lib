/// Implements Bitcoin's feature for signing arbitrary messages.

var Address = require('./address')
var convert = require('./convert')
var ecdsa = require('./ecdsa')
var SHA256 = require('crypto-js/sha256')

// FIXME: magicHash is incompatible with other magic messages
var magicBytes = convert.stringToBytes('Bitcoin Signed Message:\n')

function magicHash(message) {
  var messageBytes = convert.stringToBytes(message)

  var buffer = [].concat(
    convert.numToVarInt(magicBytes.length),
    magicBytes,
    convert.numToVarInt(messageBytes.length),
    messageBytes
  )

  return convert.wordArrayToBytes(SHA256(SHA256(convert.bytesToWordArray(buffer))))
}

// TODO: parameterize compression instead of using ECKey.compressed
function sign(key, message) {
  var hash = magicHash(message)
  var sig = key.sign(hash)
  var obj = ecdsa.parseSig(sig)
  var i = ecdsa.calcPubkeyRecoveryParam(key.getPub(), obj.r, obj.s, hash)

  i += 27
  if (key.compressed) {
    i += 4
  }

  var rBa = obj.r.toByteArrayUnsigned()
  var sBa = obj.s.toByteArrayUnsigned()

  // Pad to 32 bytes per value
  while (rBa.length < 32) rBa.unshift(0)
  while (sBa.length < 32) sBa.unshift(0)

  sig = [i].concat(rBa, sBa)

  return sig
}

function verify(address, sig, message) {
  address = new Address(address)
  sig = ecdsa.parseSigCompact(sig)

  var isCompressed = !!(sig.i & 4)
  var hash = magicHash(message)

  var pubKey = ecdsa.recoverPubKey(sig.r, sig.s, hash, sig.i)
  pubKey.compressed = isCompressed

  return pubKey.getAddress(address.version).toString() === address.toString()
}

module.exports = {
  magicHash: magicHash,
  sign: sign,
  verify: verify
}
