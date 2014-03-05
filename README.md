# bitcoinjs-lib

Bitcoin library for node.js and browsers.

[![browser support](https://ci.testling.com/bitcoinjs/bitcoinjs-lib.png)](https://ci.testling.com/bitcoinjs/bitcoinjs-lib)

# Features

- [HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- Transaction creation and signing
- ECDSA signing and verification

# Installation

`npm install bitcoinjs-lib`

## Building (for browsers)

`npm run-script compile`

## Run the test suite

First install `mocha` (e.g. `npm install -g mocha` ).

Then, just run `mocha` at the root of the `bitcoinjs-lib` checkout directory.

# Usage

## node.js

`var Bitcoin = require('bitcoinjs-lib')`

## Browser

Use the global `Bitcoin` object.

# License

This library is free and open-source software released under the MIT
license.

# Copyright

BitcoinJS (c) 2011-2012 Stefan Thomas
Released under MIT license
http://bitcoinjs.org/

JSBN (c) 2003-2005 Tom Wu
Released under BSD license
http://www-cs-students.stanford.edu/~tjw/jsbn/

CryptoJS (c) 2009–2012 by Jeff Mott
Released under New BSD license
http://code.google.com/p/crypto-js/
