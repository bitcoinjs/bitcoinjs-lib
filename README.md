# bitcoinjs-lib

[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib)

[![Browser Support](https://ci.testling.com/bitcoinjs/bitcoinjs-lib.png)](https://ci.testling.com/bitcoinjs/bitcoinjs-lib)

A pure JavaScript Bitcoin library for node.js and browsers. Backed by (slowly improving) testing, proven by over a million wallet users. The backbone for almost all Bitcoin web wallets in production today.

**Warning**: Master is not stable. Expect the interface to change rapidly, including some of the examples below. This is not the original bitcoinjs-lib that was not updated for a while. The current bitcoinjs-lib has been refactored to clean things up, add new functionality and merge improvements from the community. If you are looking for the original, it will be tagged as `0.1.3`. We will use `0.2.x` for releases based on these changes, so be sure to use the `0.1.3` tag if you need the original version.

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

## Setup

### Node.js

    var bitcoin = require('bitcoinjs-lib')

From the repo:

    var bitcoin = require('./src/index.js')

### Browser

Compile `bitcoinjs-min.js` with the following command:

    $ npm run-script compile

After loading this file in your browser, you will be able to use the global `Bitcoin` object.

## Usage

These examples assume you are running bitcoinjs-lib in the browser.

### Generating a Bitcoin address

```javascript

key = new Bitcoin.ECKey()

// Print your private key (a hex string)
console.log(key.toString())
// => 8c112cf628362ecf4d482f68af2dbb50c8a2cb90d226215de925417aa9336a48

// Print your public key (defaults to a Bitcoin address)
console.log(key.getPub().getAddress())
// => 14bZ7YWde4KdRb5YN7GYkToz3EHVCvRxkF
```

### Creating a Transaction

```javascript
tx = new Bitcoin.Transaction()

// Add the input (who is paying) of the form [previous transaction hash, index of the output to use]
tx.addInput("aa94ab02c182214f090e99a0d57021caffd0f195a81c24602b1028b130b63e31", 0)

// Add the output (who to pay to) of the form [payee's address, amount in satoshis]
tx.addOutput("1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK", 15000)

// Initialize a private key using hex
key = new Bitcoin.ECKey("8c112cf628362ecf4d482f68af2dbb50c8a2cb90d226215de925417aa9336a48")

// Sign the first input with the new key
tx.sign(0, key)

// Print transaction serialized as hex
console.log(tx.serializeHex())
// => 0100000001313eb630b128102b60241ca895f1d0ffca2170d5a0990e094f2182c102ab94aa000000008a47304402200169f1f844936dc60df54e812345f5dd3e6681fea52e33c25154ad9cc23a330402204381ed8e73d74a95b15f312f33d5a0072c7a12dd6c3294df6e8efbe4aff27426014104e75628573696aed32d7656fb35e9c71ea08eb6492837e13d2662b9a36821d0fff992692fd14d74fdec20fae29128ba12653249cbeef521fc5eba84dde0689f27ffffffff01983a0000000000001976a914ad618cf4333b3b248f9744e8e81db2964d0ae39788ac00000000

// You could now push the transaction onto the Bitcoin network manually (see https://blockchain.info/pushtx)
```


## Projects utilizing bitcoinjs-lib

- [Blockchain.info Wallet](http://blockchain.info/wallet)
- [Bitaddress.org](https://www.bitaddress.org)
- [Coinpunk](https://coinpunk.com)
- [DarkWallet](https://darkwallet.unsystem.net)
- [GreenAddress](https://greenaddress.it)

Feel free to send pull requests to have your project/startup listed here.

## Contributing

### Instructions

1. Fork the repo
2. Push changes to your fork
3. Create a pull request

### Running the test suite

    $ npm test

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

