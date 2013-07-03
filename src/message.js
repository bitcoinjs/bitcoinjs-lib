/// Implements Bitcoin's feature for signing arbitrary messages.

var Crypto = require('./crypto-js/crypto');
var ecdsa = require('./ecdsa');
var conv = require('./convert');
var util = require('./util');

var Message = {};

Message.magicPrefix = "Bitcoin Signed Message:\n";

Message.makeMagicMessage = function (message) {
  var magicBytes = Crypto.charenc.UTF8.stringToBytes(Message.magicPrefix);
  var messageBytes = Crypto.charenc.UTF8.stringToBytes(message);

  var buffer = [];
  buffer = buffer.concat(util.numToVarInt(magicBytes.length));
  buffer = buffer.concat(magicBytes);
  buffer = buffer.concat(util.numToVarInt(messageBytes.length));
  buffer = buffer.concat(messageBytes);

  return buffer;
};

Message.getHash = function (message) {
  var buffer = Message.makeMagicMessage(message);
  return Crypto.SHA256(Crypto.SHA256(buffer, {asBytes: true}), {asBytes: true});
};

Message.signMessage = function (key, message, compressed) {
  var hash = Message.getHash(message);

  var sig = key.sign(hash);

  var obj = ecdsa.parseSig(sig);

  var address = key.getBitcoinAddress().toString();
  var i = ecdsa.calcPubkeyRecoveryParam(address, obj.r, obj.s, hash);

  i += 27;
  if (compressed) i += 4;

  var rBa = obj.r.toByteArrayUnsigned();
  var sBa = obj.s.toByteArrayUnsigned();

  // Pad to 32 bytes per value
  while (rBa.length < 32) rBa.unshift(0);
  while (sBa.length < 32) sBa.unshift(0);

  sig = [i].concat(rBa).concat(sBa);

  return conv.bytesToBase64(sig);
};

Message.verifyMessage = function (address, sig, message) {
  sig = conv.base64ToBytes(sig);
  sig = ecdsa.parseSigCompact(sig);

  var hash = Message.getHash(message);

  var isCompressed = !!(sig.i & 4);
  var pubKey = ecdsa.recoverPubKey(sig.r, sig.s, hash, sig.i);

  pubKey.setCompressed(isCompressed);

  var expectedAddress = pubKey.getBitcoinAddress().toString();

  return (address === expectedAddress);
};

module.exports = Message;
