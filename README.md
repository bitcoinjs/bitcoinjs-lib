# bitcoinjs-lib

[![browser support](https://ci.testling.com/bitcoinjs/bitcoinjs-lib.png)](https://ci.testling.com/bitcoinjs/bitcoinjs-lib)

A pure JavaScript Bitcoin library for node.js and browsers. Backed by (slowly improving) testing, proven by over a million wallet users. The backbone for almost all Bitcoin web wallets in production today.

This is not the original bitcoinjs-lib that was not updated for a while. The current bitcoinjs-lib has been refactored to clean things up, add new functionality and merge improvements from the community. If you are looking for the original, it will be tagged as `0.1.3`. We will use `0.2.x` for releases based on these changes, so be sure to use the `0.1.3` tag if you need the original version.

## Features

- Bitcoin Testnet and Mainnet (production) support
- [HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- Highly secure random private key / address generation using [window.crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Window.crypto)
- ECDSA signing and verification
- Transaction creation (pay-to-pubkey-hash), support for multisignature transactions
- A (somewhat incomplete) wallet implementation, improvements ongoing

## Installation

`npm install bitcoinjs-lib`

Note: The npm version is currently out of date, are working to resolve this. The best way to use the latest code is to clone the repository.

## Usage

### Run the test suite

    $ npm test

### Node.js

    var bitcoin = require('bitcoinjs-lib')

From the repo:

    var bitcoin = require('./src/index.js')

### Browser

Compile `bitcoinjs-min.js` with the following command:

    $ npm run-script compile

After loading this file in your browser, you will be able to use the global `Bitcoin` object.

## Projects utilizing bitcoinjs-lib

- [Blockchain.info Wallet](http://blockchain.info/wallet)
- [Bitaddress.org](https://www.bitaddress.org)
- [Coinpunk](https://coinpunk.com)

Feel free to send pull requests to have your project/startup listed here.

## Alternatives

- [Bitcore](https://github.com/bitpay/bitcore)
- [Cryptocoin](https://github.com/cryptocoinjs/cryptocoin)

## License

This library is free and open-source software released under the MIT license.

## Copyright

BitcoinJS (c) 2011-2012 Stefan Thomas
Released under MIT license
http://bitcoinjs.org/

JSBN (c) 2003-2005 Tom Wu
Released under BSD license
http://www-cs-students.stanford.edu/~tjw/jsbn/

CryptoJS (c) 2009–2012 by Jeff Mott
Released under New BSD license
http://code.google.com/p/crypto-js/

