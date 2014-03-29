/// Implements Bitcoin's feature for signing arbitrary messages.

var Address = require('./address')
var convert = require('./convert')
var ecdsa = require('./ecdsa')
var SHA256 = require('crypto-js/sha256')

var Message = {}

Message.magicPrefix = "Bitcoin Signed Message:\n"

Message.makeMagicMessage = function (message) {
  var magicBytes = convert.stringToBytes(Message.magicPrefix)
  var messageBytes = convert.stringToBytes(message)

  return [].concat(
    convert.numToVarInt(magicBytes.length),
    magicBytes,
    convert.numToVarInt(messageBytes.length),
    messageBytes
  )

}

Message.getHash = function (message) {
  var buffer = Message.makeMagicMessage(message)
  return convert.wordArrayToBytes(SHA256(SHA256(convert.bytesToWordArray(buffer))))
}

Message.signMessage = function (key, message) {
  var hash = Message.getHash(message)
  var sig = key.sign(hash)
  var obj = ecdsa.parseSig(sig)
  var i = ecdsa.calcPubkeyRecoveryParam(key, obj.r, obj.s, hash)

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

  return convert.bytesToHex(sig)
}

Message.verifyMessage = function (address, sig, message) {
  sig = ecdsa.parseSigCompact(convert.hexToBytes(sig))

  var hash = Message.getHash(message)

  var isCompressed = !!(sig.i & 4)
  var pubKey = ecdsa.recoverPubKey(sig.r, sig.s, hash, sig.i)
  pubKey.compressed = isCompressed

  // Compare address to expected address
  address = new Address(address)
  return address.toString() === pubKey.getAddress(address.version).toString()
}

module.exports = Message
