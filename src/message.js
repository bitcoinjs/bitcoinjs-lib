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

    var i = Bitcoin.ECDSA.calcPubkeyRecoveryParam(obj.r, obj.s, hash);

    i += 27;
    if (compressed) i += 4;

    var rBa = obj.r.toByteArrayUnsigned();
    var sBa = obj.r.toByteArrayUnsigned();

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

console.log("should be true:", Bitcoin.Message.verifyMessage('16vqGo3KRKE9kTsTZxKoJKLzwZGTodK3ce',
            'HPDs1TesA48a9up4QORIuub67VHBM37X66skAYz0Esg23gdfMuCTYDFORc6XGpKZ2/flJ2h/DUF569FJxGoVZ50=',
            'test message'));
console.log("should be false:", Bitcoin.Message.verifyMessage('16vqGo3KRKE9kTsTZxKoJKLzwZGTodK3ce',
            'HPDs1TesA48a9up4QORIuub67VHBM37X66skAYz0Esg23gdfMuCTYDFORc6XGpKZ2/flJ2h/DUF569FJxGoVZ50=',
            'test message 2'));
console.log("should be true:", Bitcoin.Message.verifyMessage('1GdKjTSg2eMyeVvPV5Nivo6kR8yP2GT7wF',
            'GyMn9AdYeZIPWLVCiAblOOG18Qqy4fFaqjg5rjH6QT5tNiUXLS6T2o7iuWkV1gc4DbEWvyi8yJ8FvSkmEs3voWE=',
            'freenode:#bitcoin-otc:b42f7e7ea336db4109df6badc05c6b3ea8bfaa13575b51631c5178a7'));
console.log("should be true:", Bitcoin.Message.verifyMessage('1Hpj6xv9AzaaXjPPisQrdAD2tu84cnPv3f',
            'INEJxQnSu6mwGnLs0E8eirl5g+0cAC9D5M7hALHD9sK0XQ66CH9mas06gNoIX7K1NKTLaj3MzVe8z3pt6apGJ34=',
            'testtest'));

