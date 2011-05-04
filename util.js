// BigInteger monkey patching
BigInteger.valueOf = nbv;
BigInteger.prototype.toByteArrayUnsigned = function () {
	var ba = this.toByteArray();
	return ba.map(function (v) {
		return (v < 0) ? v + 256 : v;
	});
};

// Console ignore
var names = ["log", "debug", "info", "warn", "error", "assert", "dir",
			 "dirxml", "group", "groupEnd", "time", "timeEnd", "count",
			 "trace", "profile", "profileEnd"];

if ("undefined" == typeof window.console) window.console = {};
for (var i = 0; i < names.length; ++i)
    if ("undefined" == typeof window.console[names[i]])
		window.console[names[i]] = function() {};

// Bitcoin utility functions
Bitcoin.Util = {
	isArray: Array.isArray || function(o) {
		return Object.prototype.toString.call(o) === '[object Array]';
	},
	makeFilledArray: function (len, val) {
		var array = [];
		var i = 0;
		while (i < len) {
			array[i++] = val;
		}
		return array;
	},
	numToVarInt: function (i) {
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
	},
	valueToBigInt: function (valueBuffer) {
		if (valueBuffer instanceof BigInteger) return valueBuffer;
		return new BigInteger(valueBuffer);
	},
	formatValue: function (valueBuffer) {
		var value = this.valueToBigInt(valueBuffer).toString();
		var integerPart = value.length > 8 ? value.substr(0, value.length-8) : '0';
		var decimalPart = value.length > 8 ? value.substr(value.length-8) : value;
		while (decimalPart.length < 8) decimalPart = "0"+decimalPart;
		decimalPart = decimalPart.replace(/0*$/, '');
		while (decimalPart.length < 2) decimalPart += "0";
		return integerPart+"."+decimalPart;
	},
	sha256ripe160: function (data) {
		return Crypto.RIPEMD160(Crypto.SHA256(data, {asBytes: true}), {asBytes: true});
	}
};
