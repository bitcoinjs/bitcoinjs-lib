// convert to/from various values

var base64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

String.prototype.lpad = function(padString, length) {
    var str = this;
    while (str.length < length) str = padString + str;
    return str;
}

// Convert a byte array to a hex string
module.exports.bytesToHex = function(bytes) {
    return bytes.map(function(x) { return x.toString(16).lpad('0',2) }).join('');
};

// Convert a hex string to a byte array
module.exports.hexToBytes = function(hex) {
    return hex.match(/../g).map(function(x) { return parseInt(x,16) });
}

	// Convert a byte array to a base-64 string
module.exports.bytesToBase64 = function(bytes) {

		for(var base64 = [], i = 0; i < bytes.length; i += 3) {
			var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
			for (var j = 0; j < 4; j++) {
				if (i * 8 + j * 6 <= bytes.length * 8)
					base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
				else base64.push("=");
			}
		}

		return base64.join("");
}


	// Convert a base-64 string to a byte array
module.exports.base64ToBytes = function(base64) {

		// Remove non-base-64 characters
		base64 = base64.replace(/[^A-Z0-9+\/]/ig, "");

		for (var bytes = [], i = 0, imod4 = 0; i < base64.length; imod4 = ++i % 4) {
			if (imod4 == 0) continue;
			bytes.push(((base64map.indexOf(base64.charAt(i - 1)) & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2)) |
			           (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
		}

		return bytes;
}

// Hex only (allowing bin would be potentially risky, as 01010101 = \x01 * 4 or 85)
module.exports.coerceToBytes = function(input) {
    if (typeof input == "string") return module.exports.hexToBytes(input);
    return input;
}

module.exports.binToBytes = function(bin) {
    return bin.match(/......../g).map(function(x) { return parseInt(x,2) });
}

module.exports.bytesToBin = function(bytes) {
    return bytes.map(function(x) { return x.toString(2).lpad('0',8) }).join('');
}

module.exports.bytesToString = function(bytes) {
    return bytes.map(function(x){ return String.fromCharCode(x) }).join('');
}

module.exports.stringToBytes = function(string) {
    return string.split('').map(function(x) { return x.charCodeAt(0) });
}

// utf8
