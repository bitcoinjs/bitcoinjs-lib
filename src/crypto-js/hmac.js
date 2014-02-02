/*!
 * Crypto-JS v2.0.0
 * http://code.google.com/p/crypto-js/
 * Copyright (c) 2009, Jeff Mott. All rights reserved.
 * http://code.google.com/p/crypto-js/wiki/License
 */

var conv = require('../convert'),
    util = require('../util');

// Shortcuts

module.exports = function (hasher, message, key, options) {

	// Convert to byte arrays
	if (message.constructor == String) message = conv.stringToBytes(message);
	if (key.constructor == String) key = conv.stringToBytes(key);
	/* else, assume byte arrays already */

	// Allow arbitrary length keys
	if (key.length > hasher._blocksize)
		key = hasher(key, { asBytes: true });

	// XOR keys with pad constants
	var okey = key.slice(0),
	    ikey = key.slice(0);
	for (var i = 0; i < hasher._blocksize; i++) {
		okey[i] ^= 0x5C;
		ikey[i] ^= 0x36;
	}

	var hmacbytes = hasher(okey.concat(hasher(ikey.concat(message), { asBytes: true })), { asBytes: true });

	return options && options.asBytes ? hmacbytes :
	       options && options.asString ? conv.bytesToString(hmacbytes) :
	       conv.bytesToHex(hmacbytes);

};
