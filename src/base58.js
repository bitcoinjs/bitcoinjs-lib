
// https://en.bitcoin.it/wiki/Base58Check_encoding

var BigInteger = require('./jsbn/jsbn');
var Crypto = require('./crypto-js/crypto');
var conv = require('./convert');

var alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var base = BigInteger.valueOf(58);

var positions = {};
for (var i=0 ; i < alphabet.length ; ++i) {
    positions[alphabet[i]] = i;
}

// Convert a byte array to a base58-encoded string.
// Written by Mike Hearn for BitcoinJ.
//   Copyright (c) 2011 Google Inc.
// Ported to JavaScript by Stefan Thomas.
module.exports.encode = function (input) {
    var bi = BigInteger.fromByteArrayUnsigned(input);
    var chars = [];

    while (bi.compareTo(base) >= 0) {
        var mod = bi.mod(base);
        chars.push(alphabet[mod.intValue()]);
        bi = bi.subtract(mod).divide(base);
    }
    chars.push(alphabet[bi.intValue()]);

    // Convert leading zeros too.
    for (var i = 0; i < input.length; i++) {
        if (input[i] == 0x00) {
            chars.push(alphabet[0]);
        } else break;
    }

    return chars.reverse().join('');
},

module.exports.encodeHex = function (input) {
    return conv.bytesToHex(module.exports.encode(input));
}

// decode a base58 string into a byte array
// input should be a base58 encoded string
// @return Array
module.exports.decode = function (input) {

  var base = BigInteger.valueOf(58);

  var length = input.length;
  var num = BigInteger.valueOf(0);
  var leading_zero = 0;
  var seen_other = false;
  for (var i=0; i<length ; ++i) {
      var chr = input[i];
      var p = positions[chr];

      // if we encounter an invalid character, decoding fails
      if (p === undefined) {
          throw new Error('invalid base58 string: ' + input);
      }

      num = num.multiply(base).add(BigInteger.valueOf(p));

      if (chr == '1' && !seen_other) {
          ++leading_zero;
      }
      else {
          seen_other = true;
      }
  }

  var bytes = num.toByteArrayUnsigned();

  // remove leading zeros
  while (leading_zero-- > 0) {
      bytes.unshift(0);
  }

  return bytes;
}

module.exports.decodeHex = function (input) {
    return module.exports.decode(conv.hexToBytes(input));
}

module.exports.checkEncode = function(input, vbyte) {
    vbyte = vbyte || 0;
    var front = [vbyte].concat(input);
    var checksum = Crypto.SHA256(Crypto.SHA256(front, {asBytes: true}), {asBytes: true})
                        .slice(0,4);
    return module.exports.encode(front.concat(checksum));
}

module.exports.checkEncodeHex = function (input, vbyte) {
    return conv.bytesToHex(module.exports.encode(input));
}

module.exports.checkDecode = function(input) {
    var bytes = module.exports.decode(input),
        front = bytes.slice(0,bytes.length-4),
        back = bytes.slice(bytes.length-4);
    var checksum = Crypto.SHA256(Crypto.SHA256(front,{asBytes: true}), {asBytes: true})
                        .slice(0,4);
    if (""+checksum != ""+back) {
        throw new Error("Checksum failed");
    }
    var o = front.slice(1);
    o.version = front[0];
    return o;
}

module.exports.checkDecodeHex = function (input) {
    return module.exports.checkDecode(conv.hexToBytes(input));
}


