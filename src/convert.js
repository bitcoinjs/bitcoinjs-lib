var Crypto = require('crypto-js');
var WordArray = Crypto.lib.WordArray;
var base64map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

exports.lpad = function lpad(str, padString, length) {
    while (str.length < length) str = padString + str;
    return str;
}

/**
 * Convert a byte array to a hex string
 */
exports.bytesToHex = function(bytes) {
    return bytes.map(function(x) {
        return exports.lpad(x.toString(16), '0', 2)
    }).join('');
};

/**
 * Convert a hex string to a byte array
 */
exports.hexToBytes = function(hex) {
    return hex.match(/../g).map(function(x) {
        return parseInt(x,16)
    });
}

/**
 * Convert a byte array to a base-64 string
 */
exports.bytesToBase64 = function(bytes) {
    var base64 = []

    for (var i = 0; i < bytes.length; i += 3) {
        var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

        for (var j = 0; j < 4; j++) {
            if (i * 8 + j * 6 <= bytes.length * 8) {
                base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
            } else {
                base64.push('=');
            }
        }
    }

    return base64.join('');
}

/**
 * Convert a base-64 string to a byte array
 */
exports.base64ToBytes = function(base64) {
    // Remove non-base-64 characters
    base64 = base64.replace(/[^A-Z0-9+\/]/ig, '');

    var bytes = []
    , imod4 = 0

    for (var i = 0; i < base64.length; imod4 = ++i % 4) {
        if (!imod4) continue

        bytes.push(
            (
                (base64map.indexOf(base64.charAt(i - 1)) & (Math.pow(2, -2 * imod4 + 8) - 1)) <<
                (imod4 * 2)
            ) |
                (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2))
        );
    }

    return bytes;
}

/**
 * Hex only (allowing bin would be potentially risky, as 01010101 = \x01 * 4 or 85)
 */
exports.coerceToBytes = function(input) {
    if (typeof input != 'string') return input
    return exports.hexToBytes(input);
}

exports.binToBytes = function(bin) {
    return bin.match(/......../g).map(function(x) {
        return parseInt(x,2)
    });
}

exports.bytesToBin = function(bytes) {
    return bytes.map(function(x) {
        return exports.lpad(x.toString(2), '0', 8)
    }).join('');
}

exports.bytesToString = function(bytes) {
    return bytes.map(function(x){
        return String.fromCharCode(x)
    }).join('');
}

exports.stringToBytes = function(string) {
    return string.split('').map(function(x) {
        return x.charCodeAt(0)
    });
}

/**
 * Create a byte array representing a number with the given length
 */
exports.numToBytes = function(num, bytes) {
    if (bytes === undefined) bytes = 8;
    if (bytes === 0) return [];
    return [num % 256].concat(module.exports.numToBytes(Math.floor(num / 256), bytes - 1));
}

/**
 * Convert a byte array to the number that it represents
 */
exports.bytesToNum = function(bytes) {
    if (bytes.length === 0) return 0;
    return bytes[0] + 256 * module.exports.bytesToNum(bytes.slice(1));
}

/**
 * Turn an integer into a "var_int".
 *
 * "var_int" is a variable length integer used by Bitcoin's binary format.
 *
 * Returns a byte array.
 */
exports.numToVarInt = function(num) {
    if (num < 253) return [num];
    if (num < 65536) return [253].concat(exports.numToBytes(num, 2));
    if (num < 4294967296) return [254].concat(exports.numToBytes(num, 4));
    return [253].concat(exports.numToBytes(num, 8));
}

exports.bytesToWords = function (bytes) {
    var words = [];
    for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
        words[b >>> 5] |= bytes[i] << (24 - b % 32);
    }
    return words;
}

exports.wordsToBytes = function (words) {
    var bytes = [];
    for (var b = 0; b < words.length * 32; b += 8) {
        bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
    }
    return bytes;
}

exports.bytesToWordArray = function (bytes) {
  return new WordArray.init(exports.bytesToWords(bytes), bytes.length)
}

exports.wordArrayToBytes = function (wordArray) {
  return exports.wordsToBytes(wordArray.words)
}

