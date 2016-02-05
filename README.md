# BitcoinJS (bitcoinjs-lib)

[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib)
[![NPM](https://img.shields.io/npm/v/bitcoinjs-lib.svg)](https://www.npmjs.org/package/bitcoinjs-lib)
[![tip for next commit](https://tip4commit.com/projects/735.svg)](http://tip4commit.com/projects/735)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)


The pure JavaScript Bitcoin library for node.js and browsers.
A continued implementation of the original `0.1.3` version used by over a million wallet users; the backbone for almost all Bitcoin web wallets in production today.


## Features

- Clean: Pure JavaScript, concise code, easy to read.
- Tested: Coverage > 90%, third-party integration tests.
- Careful: Two person approval process for small, focused pull requests.
- Compatible: Works on Node.js and all modern browsers.
- Powerful: Support for advanced features, such as multi-sig, HD Wallets.
- Secure: Strong random number generation, PGP signed releases, trusted developers.
- Principled: No support for browsers with crap RNG (IE < 11)
- Standardized: Node community coding style, Browserify, Node's stdlib and Buffers.
- Fast: Optimized code, uses typed arrays instead of byte arrays for performance.
- Experiment-friendly: Bitcoin Mainnet and Testnet support.
- Altcoin-ready: Capable of working with bitcoin-derived cryptocurrencies (such as Dogecoin).


## Should I use this in production?

If you are thinking of using the master branch of this library in production, *stop*.
Master is not stable; it is our development branch, and only tagged releases may be classified as stable.

If you are looking for the original, it is tagged as `0.1.3`. Unless you need it for dependency reasons, it is strongly recommended that you use (or upgrade to) the newest version, which adds major functionality, cleans up the interface, fixes many bugs, and adds over 1,300 more tests.


## Installation

`npm install bitcoinjs-lib`


## Setup

### Node.js

    var bitcoin = require('bitcoinjs-lib')


### Browser

If you're familiar with how to use browserify, ignore this and proceed normally.
These steps are advisory only and allow you to use the API to its full extent.

[Browserify](https://github.com/substack/node-browserify) is assumed to be installed for these steps.

From your repository, create a `foobar.js` file

``` javascript
var foobar = {
  base58: require('bs58'),
  bitcoin: require('bitcoinjs-lib'),
  ecurve: require('ecurve'),
  BigInteger: require('bigi'),
  Buffer: require('buffer')
}

module.exports = foobar
```

Each of these included packages are seperate to `bitcoinjs-lib`, and must be installed separately.
They are however used in the bitcoinjs-lib public API.

Using browserify, compile `foobar.js` for use in the browser:

    $ browserify foobar.js -s foobar > foobar.js

You will then be able to load `foobar.js` into your browser, with each of the dependencies above accessible from the global `foobar` object.

**NOTE**: See our package.json for the currently supported version of browserify used by this repository.

**NOTE**: When uglifying the javascript, you must exclude the following variable names from being mangled: `Array`, `BigInteger`, `Boolean`, `Buffer`, `ECPair`, `Function`, `Number`, `Point` and `Script`.
This is because of the function-name-duck-typing used in [typeforce](https://github.com/dcousens/typeforce).


## Examples

The below examples are implemented as integration tests, they should be very easy to understand.  Otherwise, pull requests are appreciated.

- [Generate a random address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L8)
- [Generate a address from a SHA256 hash](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L20)
- [Generate a address and WIF for Litecoin](https://github.com/bitcoin/bitcoinjs-lib/blob/master/test/integration/basic.js#L29)
- [Import an address via WIF](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L43)
- [Create a Transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L50)
- [Sign a Bitcoin message](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L9)
- [Verify a Bitcoin message](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L17)
- [Create an OP RETURN transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L24)
- [Create a 2-of-3 multisig P2SH address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/multisig.js#L8)
- [Spend from a 2-of-4 multisig P2SH address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/multisig.js#L22)
- [Generate a single-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/crypto.js#L7)
- [Generate a dual-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/crypto.js#L52)
- [Recover a BIP32 parent private key from the parent public key and a derived non-hardened child private key](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/crypto.js#L54)
- [Recover a Private key from duplicate R values in a signature](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/crypto.js#L101)

If you have a use case that you feel could be listed here, please [ask for it](https://github.com/bitcoinjs/bitcoinjs-lib/issues/new)!


## Projects utilizing BitcoinJS

- [BitAddress](https://www.bitaddress.org)
- [Blockchain.info](https://blockchain.info/wallet)
- [Blocktrail](https://www.blocktrail.com/)
- [Brainwallet](https://brainwallet.github.io)
- [Coinkite](https://coinkite.com)
- [Coinpunk](https://coinpunk.com)
- [Dark Wallet](https://darkwallet.unsystem.net)
- [DecentralBank](http://decentralbank.com/)
- [Dogechain Wallet](https://dogechain.info)
- [EI8HT Wallet](http://ei8.ht/)
- [GreenAddress](https://greenaddress.it)
- [Hive Wallet](https://www.hivewallet.com)
- [QuickCoin](https://wallet.quickcoin.co)
- [Robocoin](https://wallet.robocoin.com)
- [Skyhook ATM](http://projectskyhook.com)


## Contributors

Stefan Thomas is the inventor and creator of this project. His pioneering work made Bitcoin web wallets possible.

Since then, many people have contributed. [Click here](https://github.com/bitcoinjs/bitcoinjs-lib/graphs/contributors) to see the comprehensive list.

Daniel Cousens, Wei Lu, JP Richardson and Kyle Drake lead the major refactor of the library from 0.1.3 to 1.0.0.


## Contributing

We are always accepting of pull requests, but we do adhere to specific standards in regards to coding style, test driven development and commit messages.

Please make your best effort to adhere to these when contributing to save on trivial corrections.


### Running the test suite

    $ npm test
    $ npm run-script coverage


## Complementing Libraries

- [BIP21](https://github.com/bitcoinjs/bip21) - A BIP21 compatible URL encoding utility library
- [BIP38](https://github.com/bitcoinjs/bip38) - Passphrase-protected private keys
- [BIP39](https://github.com/bitcoinjs/bip39) - Mnemonic generation for deterministic keys
- [BIP32-Utils](https://github.com/bitcoinjs/bip32-utils) - A set of utilities for working with BIP32
- [BIP32-Wallet](https://github.com/bitcoinjs/bip32-wallet) - A BIP32 Wallet backed by bitcoinjs-lib, lite on features but heavily tested
- [BIP66](https://github.com/bitcoinjs/bip66) - Strict DER signature decoding
- [BIP69](https://github.com/bitcoinjs/bip69) - Mnemonic generation for deterministic keys
- [Base58](https://github.com/cryptocoinjs/bs58) - Base58 encoding/decoding
- [Base58 Check](https://github.com/bitcoinjs/bs58check) - Base58 check encoding/decoding
- [BCoin](https://github.com/indutny/bcoin) - BIP37 / Bloom Filters / SPV client
- [insight](https://github.com/bitpay/insight) - A bitcoin blockchain API for web wallets.


## Alternatives

- [Bitcore](https://github.com/bitpay/bitcore)
- [Cryptocoin](https://github.com/cryptocoinjs/cryptocoin)


## LICENSE [MIT](LICENSE)


## Copyright

BitcoinJS (c) 2011-2016 bitcoinjs-lib contributors

Released under MIT license
