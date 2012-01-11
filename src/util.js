// BigInteger monkey patching
BigInteger.valueOf = nbv;
BigInteger.prototype.toByteArrayUnsigned = function () {
  var ba = this.toByteArray();
  if (ba.length) {
    if (ba[0] == 0) {
      ba = ba.slice(1);
    }
    return ba.map(function (v) {
      return (v < 0) ? v + 256 : v;
    });
  } else {
    // Empty array, nothing to do
    return ba;
  }
};
BigInteger.fromByteArrayUnsigned = function (ba) {
  if (!ba.length) {
    return ba.valueOf(0);
  } else if (ba[0] & 0x80) {
    // Prepend a zero so the BigInteger class doesn't mistake this
    // for a negative integer.
    return new BigInteger([0].concat(ba));
  } else {
    return new BigInteger(ba);
  }
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

    // Prepend zero byte to prevent interpretation as negative integer
    return BigInteger.fromByteArrayUnsigned(valueBuffer);
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
  parseValue: function (valueString) {
    var valueComp = valueString.split('.');
    var integralPart = valueComp[0];
    var fractionalPart = valueComp[1] || "0";
    while (fractionalPart.length < 8) fractionalPart += "0";
    fractionalPart = fractionalPart.replace(/^0+/g, '');
    var value = BigInteger.valueOf(parseInt(integralPart));
    value = value.multiply(BigInteger.valueOf(100000000));
    value = value.add(BigInteger.valueOf(parseInt(fractionalPart)));
    return value;
  },
  sha256ripe160: function (data) {
    return Crypto.RIPEMD160(Crypto.SHA256(data, {asBytes: true}), {asBytes: true});
  }
};

for (var i in Crypto.util) {
  if (Crypto.util.hasOwnProperty(i)) {
    Bitcoin.Util[i] = Crypto.util[i];
  }
}
