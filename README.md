# BitcoinJS (bitcoinjs-lib)

[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib) [![Coverage Status](https://coveralls.io/repos/bitcoinjs/bitcoinjs-lib/badge.png)](https://coveralls.io/r/bitcoinjs/bitcoinjs-lib)

[![Browser Support](https://ci.testling.com/bitcoinjs/bitcoinjs-lib.png)](https://ci.testling.com/bitcoinjs/bitcoinjs-lib)

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
If you are thinking of using the master branch of this library in production, stop.
Master is not stable; it is our development branch, and only tagged releases may be classified as stable.

If you are looking for the original, it is tagged as `0.1.3`. Unless you need it for dependency reasons, it is highly recommended that you use the newest version, which adds major functionality, fixes many bugs, and is well tested.


## Installation

`npm install bitcoinjs-lib`


## Setup

### Node.js

    var bitcoin = require('bitcoinjs-lib')

From the repo:

    var bitcoin = require('./src/index.js')


### Browser

Compile `bitcoinjs-min.js` with the following command:

    $ npm run-script compile

After loading this file in your browser, you will be able to use the global `bitcoin` object.


## Usage

These examples assume you are running bitcoinjs-lib in the browser.


### Generating a Bitcoin address

```javascript

key = bitcoin.ECKey.makeRandom()

// Print your private key (in WIF format)
console.log(key.toWIF())
// => 8c112cf628362ecf4d482f68af2dbb50c8a2cb90d226215de925417aa9336a48

// Print your public key (toString defaults to a Bitcoin address)
console.log(key.pub.getAddress().toString())
// => 14bZ7YWde4KdRb5YN7GYkToz3EHVCvRxkF
```

### Creating a Transaction

```javascript
tx = new bitcoin.Transaction()

// Add the input (who is paying) of the form [previous transaction hash, index of the output to use]
tx.addInput("aa94ab02c182214f090e99a0d57021caffd0f195a81c24602b1028b130b63e31", 0)

// Add the output (who to pay to) of the form [payee's address, amount in satoshis]
tx.addOutput("1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK", 15000)

// Initialize a private key using WIF
key = bitcoin.ECKey.fromWIF("L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy")

// Sign the first input with the new key
tx.sign(0, key)

// Print transaction serialized as hex
console.log(tx.toHex())
// => 0100000001313eb630b128102b60241ca895f1d0ffca2170d5a0990e094f2182c102ab94aa000000008a47304402200169f1f844936dc60df54e812345f5dd3e6681fea52e33c25154ad9cc23a330402204381ed8e73d74a95b15f312f33d5a0072c7a12dd6c3294df6e8efbe4aff27426014104e75628573696aed32d7656fb35e9c71ea08eb6492837e13d2662b9a36821d0fff992692fd14d74fdec20fae29128ba12653249cbeef521fc5eba84dde0689f27ffffffff01983a0000000000001976a914ad618cf4333b3b248f9744e8e81db2964d0ae39788ac00000000

// You could now push the transaction onto the Bitcoin network manually (see https://blockchain.info/pushtx)
```


## Projects utilizing bitcoinjs-lib

- [Blockchain.info Wallet](https://blockchain.info/wallet)
- [Bitaddress.org](https://www.bitaddress.org)
- [Coinpunk](https://coinpunk.com)
- [DarkWallet](https://darkwallet.unsystem.net)
- [GreenAddress](https://greenaddress.it)
- [Dogechain Wallet](https://dogechain.info)
- [Justcoin Exchange](https://justcoin.com)
- [Brainwallet](https://brainwallet.github.io)
- [Skyhook ATM](http://projectskyhook.com)

Feel free to send pull requests to have your project/startup listed here.


## Contributing

### Instructions

1. Fork the repo
2. Push changes to your fork
3. Create a pull request


### Running the test suite

    $ npm test
    $ npm run-script coverage


## Alternatives / Complementing Libraries


- [BCoin](https://github.com/indutny/bcoin)
- [Bitcore](https://github.com/bitpay/bitcore)
- [Cryptocoin](https://github.com/cryptocoinjs/cryptocoin)


## License

This library is free and open-source software released under the MIT license.


## Copyright

BitcoinJS (c) 2011-2012 Stefan Thomas
Released under MIT license
