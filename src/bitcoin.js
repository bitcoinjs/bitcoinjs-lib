(function (exports) {
  var Bitcoin = exports;

  if ('object' !== typeof module) {
    Bitcoin.EventEmitter = EventEmitter;
  }
})(
  'object' === typeof module ? module.exports : (window.Bitcoin = {})
);

/*
  function makeKeypair()
  {
    // Generate private key
    var n = ecparams.getN();
    var n1 = n.subtract(BigInteger.ONE);
    var r = new BigInteger(n.bitLength(), rng);
    
    var privateKey = r.mod(n1).add(BigInteger.ONE);
    
    // Generate public key
    var G = ecparams.getG();
    var publicPoint = G.multiply(privateKey);

    return {priv: privateKey, pubkey: publicPoint};
  };

  function serializeTransaction(tx)
  {
    var buffer = [];
    buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(tx.version)]));
    buffer = buffer.concat(numToVarInt(tx.ins.length));
    for (var i = 0; i < tx.ins.length; i++) {
      var txin = tx.ins[i];
      buffer = buffer.concat(Crypto.util.base64ToBytes(txin.outpoint.hash));
      buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(txin.index)]));
      var scriptBytes = Crypto.util.base64ToBytes(txin.script);
      buffer = buffer.concat(numToVarInt(scriptBytes.length));
      buffer = buffer.concat(scriptBytes);
      buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(txin.sequence)]));
    }
    buffer = buffer.concat(numToVarInt(tx.outs.length));
    for (var i = 0; i < tx.outs.length; i++) {
      var txout = tx.outs[i];
      var valueHex = (new BigInteger(txout.value, 10)).toString(16);
      while (valueHex.length < 16) valueHex = "0" + valueHex;
      buffer = buffer.concat(Crypto.util.hexToBytes(valueHex));
      var scriptBytes = Crypto.util.base64ToBytes(txout.script);
      buffer = buffer.concat(numToVarInt(scriptBytes.length));
      buffer = buffer.concat(scriptBytes);
    }
    buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(tx.lock_time)]));
    
    return buffer;
  };

  var OP_CODESEPARATOR = 171;

  var SIGHASH_ALL = 1;
  var SIGHASH_NONE = 2;
  var SIGHASH_SINGLE = 3;
  var SIGHASH_ANYONECANPAY = 80;

  function hashTransactionForSignature(scriptCode, tx, inIndex, hashType)
  {
    // TODO: We need to actually deep copy here
    var txTmp = tx;

    // In case concatenating two scripts ends up with two codeseparators,
    // or an extra one at the end, this prevents all those possible incompatibilities.
    scriptCode = scriptCode.filter(function (val) {
      return val !== OP_CODESEPARATOR;
    });
    
    // Blank out other inputs' signatures
    for (var i = 0; i < txTmp.ins.length; i++) {
      txTmp.ins[i].script = Crypto.util.bytesToBase64([]);
    }
    txTmp.ins[inIndex].script = Crypto.util.bytesToBase64(scriptCode);

    // Blank out some of the outputs
    if ((hashType & 0x1f) == SIGHASH_NONE) {
      txTmp.outs = [];

      // Let the others update at will
      for (var i = 0; i < txTmp.ins.length; i++)
        if (i != inIndex)
          txTmp.ins[i].sequence = 0;
    } else if ((hashType & 0x1f) == SIGHASH_SINGLE) {
      // TODO: Implement
    }

    // Blank out other inputs completely, not recommended for open transactions
    if (hashType & SIGHASH_ANYONECANPAY) {
      txTmp.ins = [txTmp.ins[inIndex]];
    }
    
    var buffer = serializeTransaction(txTmp);
    
    buffer.concat(Crypto.util.wordsToBytes([parseInt(hashType)]));

    console.log(buffer);
    
    return Crypto.SHA256(Crypto.SHA256(buffer, {asBytes: true}), {asBytes: true});
  };

  function verifyTransactionSignature(tx) {
    var hash = hashTransactionForSignature([], tx, 0, 0);
    return Crypto.util.bytesToHex(hash);
  };

  function numToVarInt(i)
  {
    // TODO: THIS IS TOTALLY UNTESTED!
    if (i < 0xfd) {
      // unsigned char
      return [i];
    } else if (i <= 1<<16) {
      // unsigned short (LE)
      return [0xfd, i >>> 8, i & 255];
    } else if (i <= 1<<32) {
      // unsigned int (LE)
      return [0xfe].concat(Crypto.util.wordsToBytes([i]));
    } else {
      // unsigned long long (LE)
      return [0xff].concat(Crypto.util.wordsToBytes([i >>> 32, i]));
    }
  };

  var testTx = {
    "version":"1",
    "lock_time":"0",
    "block": {
      "hash":"N/A",
      "height":115806
    },
    "index":6,
    "hash":"WUFzjKubG1kqfJWMb4qZdlhU2F3l5NGXN7AUg8Jwl14=",
    "ins":[{
      "outpoint":{
        "hash":"nqcbMM1oRhfLdZga11q7x0CpUMujm+vtxHXO9V0gnwE=",
        "index":0
      },
      "script":"RzBEAiB2XXkx1pca9SlfCmCGNUVf+h2sAFBttcxG1VnypIcvEgIgXrOp7LSdYBYp3nPsQAz8BOLD3K4pAlXfZImP1rkzk2EBQQRi7NcODzNfnVqLtG79Axp5UF6EhFIhCmzqKqssfKpfCIOmzCuXEeDFUFvFzeGLJx5N+wp2qRS1TqYezGD3yERk",
      "sequence":4294967295
    }],
    "outs":[{
      "value":"3000000000",
      "script":"dqkUBLZwqhAPRVgZvwI8MN5gLHbU8NOIrA=="
    },{
      "value":"25937000000",
      "script":"dqkUQ82gJ0O5vOBg6yK5/yorLLV5zLKIrA=="
    }]
  };

   TODO: Make this stuff into test cases ;)
   $(function () {
   var key = new Bitcoin.ECKey(Crypto.util.hexToBytes("5c0b98e524ad188ddef35dc6abba13c34a351a05409e5d285403718b93336a4a"));
   key = new Bitcoin.ECKey(Crypto.util.hexToBytes("180cb41c7c600be951b5d3d0a7334acc7506173875834f7a6c4c786a28fcbb19"));
   //console.log(key.getBitcoinAddress().toString());
   //var message = Crypto.util.hexToBytes("2aec28d323ee7b06a799d540d224b351161fe48967174ca5e43164e86137da11");
   //message = [0];
   //var out = key.sign(message);
   //console.log("pubkey: "+Crypto.util.bytesToHex(key.getPub()));
   //console.log("sig: "+Crypto.util.bytesToHex(out));

   //console.log(key.verify(message, out));

   //console.log(Bitcoin.ECDSA.verify(message, Crypto.util.hexToBytes("3046022100dffbc26774fc841bbe1c1362fd643609c6e42dcb274763476d87af2c0597e89e022100c59e3c13b96b316cae9fa0ab0260612c7a133a6fe2b3445b6bf80b3123bf274d"), Crypto.util.hexToBytes("0401de173aa944eacf7e44e5073baca93fb34fe4b7897a1c82c92dfdc8a1f75ef58cd1b06e8052096980cb6e1ad6d3df143c34b3d7394bae2782a4df570554c2fb")));

   //console.log(Bitcoin.ECDSA.verify(Crypto.util.hexToBytes("230aba77ccde46bb17fcb0295a92c0cc42a6ea9f439aaadeb0094625f49e6ed8"), Crypto.util.hexToBytes("3046022100a3ee5408f0003d8ef00ff2e0537f54ba09771626ff70dca1f01296b05c510e85022100d4dc70a5bb50685b65833a97e536909a6951dd247a2fdbde6688c33ba6d6407501"),Crypto.util.hexToBytes("04a19c1f07c7a0868d86dbb37510305843cc730eb3bea8a99d92131f44950cecd923788419bfef2f635fad621d753f30d4b4b63b29da44b4f3d92db974537ad5a4")));
   //console.log(Bitcoin.ECDSA.verify(Crypto.util.hexToBytes("c2c75bb77d7a5acddceb1d45ceef58e7451fd0d3abc9d4c16df7848eefafe00d"), Crypto.util.hexToBytes("3045022100ff9362dadcbf1f6ef954bc8eb27144bbb4f49abd32be1eb04c311151dcf4bcf802205112c2ca6a25aefb8be98bf460c5a9056c01253f31e118d80b81ec9604e3201a01"),Crypto.util.hexToBytes("04fe62ce7892ec209310c176ef7f06565865e286e8699e884603657efa9aa51086785099d544d4e04f1f7b4b065205c1783fade8daf4ba1e0d1962292e8eb722cd")));
   });
   //
*/
