/**
 * Implements Bitcoin's feature for signing arbitrary messages.
 */
Bitcoin.Message = (function () {
  var Message = {};

  Message.magicPrefix = "Bitcoin Signed Message:\n";

  Message.makeMagicMessage = function (message) {
    var magicBytes = Crypto.charenc.UTF8.stringToBytes(Message.magicPrefix);
    var messageBytes = Crypto.charenc.UTF8.stringToBytes(message);

    var buffer = [];
    buffer = buffer.concat(Bitcoin.Util.numToVarInt(magicBytes.length));
    buffer = buffer.concat(magicBytes);
    buffer = buffer.concat(Bitcoin.Util.numToVarInt(messageBytes.length));
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

    var obj = Bitcoin.ECDSA.parseSig(sig);

    var address = key.getBitcoinAddress().toString();
    var i = Bitcoin.ECDSA.calcPubkeyRecoveryParam(address, obj.r, obj.s, hash);

    i += 27;
    if (compressed) i += 4;

    var rBa = obj.r.toByteArrayUnsigned();
    var sBa = obj.s.toByteArrayUnsigned();

    // Pad to 32 bytes per value
    while (rBa.length < 32) rBa.unshift(0);
    while (sBa.length < 32) sBa.unshift(0);

    sig = [i].concat(rBa).concat(sBa);

    return Crypto.util.bytesToBase64(sig);
  };

  Message.verifyMessage = function (address, sig, message) {
    sig = Crypto.util.base64ToBytes(sig);
    sig = Bitcoin.ECDSA.parseSigCompact(sig);

    var hash = Message.getHash(message);

    var isCompressed = !!(sig.i & 4);
    var pubKey = Bitcoin.ECDSA.recoverPubKey(sig.r, sig.s, hash, sig.i);

    pubKey.setCompressed(isCompressed);

    var expectedAddress = pubKey.getBitcoinAddress().toString();

    return (address === expectedAddress);
  };

  return Message;
})();
