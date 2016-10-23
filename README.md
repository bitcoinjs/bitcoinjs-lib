# ReactNative BitcoinJS (react-native-bitcoinjs-lib)

[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib)
[![NPM](https://img.shields.io/npm/v/bitcoinjs-lib.svg)](https://www.npmjs.org/package/bitcoinjs-lib)
[![tip for next commit](https://tip4commit.com/projects/735.svg)](http://tip4commit.com/projects/735)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)


ReactNative-ready fork of the [original bitcoinjs package](https://github.com/bitcoinjs/bitcoinjs-lib).
Used by over a million wallet users and the backbone for almost all Bitcoin web wallets in production today.


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

## Installation

`npm i react-native-bitcoinjs-lib --save`


## Setup

Create the react native project.

`react-native init fooApp`

Install rn-nodeify to be able to use Node.js libs.

`npm i rn-nodeify -g`

Add this postinstall script to install & hack the Node.js libs for the usage in React Native.

`"postinstall": "rn-nodeify --install stream,buffer,events,assert --hack"`

Install & link required dependencies.

`npm i react-native-bitcoinjs-lib react-native-randombytes --save && react-native link react-native-randombytes`

Run the postinstall, it will create a shim.js file which you need to include in your index file (see Usage).

`npm run postinstall`

Run the app

`react-native run-android`

## Usage

Edit index.android.js and index.ios.js

```javascript
// node.js libs
import './shim' // make sure to use es6 import and not require()
import Bitcoin from 'react-native-bitcoinjs-lib'
[...]
const keypair = Bitcoin.ECPair.makeRandom()
console.log(keypair.getAddress()) // your brand new base58-encoded Bitcoin address
```


## Examples

Run the example app or refer to the [original repository](https://github.com/bitcoinjs/bitcoinjs-lib#examples) for more available examples.


## Projects utilizing BitcoinJS [for Node.js and Browsers](https://github.com/bitcoinjs/bitcoinjs-lib)

- [BitAddress](https://www.bitaddress.org)
- [Blockchain.info](https://blockchain.info/wallet)
- [Blocktrail](https://www.blocktrail.com/)
- [Dark Wallet](https://www.darkwallet.is/)
- [DecentralBank](http://decentralbank.com/)
- [Dogechain Wallet](https://dogechain.info)
- [EI8HT Wallet](http://ei8.ht/)
- [GreenAddress](https://greenaddress.it)
- [Robocoin](https://wallet.robocoin.com)
- [Skyhook ATM](http://projectskyhook.com)

## Projects utilizing BitcoinJS [for React Native](https://github.com/nexustech-solutions/react-native-bitcoinjs-lib)

- [ReactNative Bitcoin Wallet](https://github.com/nexustech-solutions/react-native-bitcoin-wallet)

## Complementing Libraries

- [BIP21](https://github.com/bitcoinjs/bip21) - A BIP21 compatible URL encoding utility library
- [BIP38](https://github.com/bitcoinjs/bip38) - Passphrase-protected private keys
- [BIP39](https://github.com/bitcoinjs/bip39) - Mnemonic generation for deterministic keys
- [BIP32-Utils](https://github.com/bitcoinjs/bip32-utils) - A set of utilities for working with BIP32
- [BIP32-Wallet](https://github.com/bitcoinjs/bip32-wallet) - A BIP32 Wallet backed by bitcoinjs-lib, lite on features but heavily tested
- [BIP66](https://github.com/bitcoinjs/bip66) - Strict DER signature decoding
- [BIP69](https://github.com/bitcoinjs/bip69) - Lexicographical Indexing of Transaction Inputs and Outputs
- [Base58](https://github.com/cryptocoinjs/bs58) - Base58 encoding/decoding
- [Base58 Check](https://github.com/bitcoinjs/bs58check) - Base58 check encoding/decoding
- [BCoin](https://github.com/indutny/bcoin) - BIP37 / Bloom Filters / SPV client
- [insight](https://github.com/bitpay/insight) - A bitcoin blockchain API for web wallets.


## Alternatives

There are currently no alternatives for React Native.

## LICENSE [MIT](LICENSE)


## Copyright

BitcoinJS (c) 2011-2016 bitcoinjs-lib contributors

Released under MIT license
