# BitcoinJS (bitcoinjs-lib)

[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib) [![Coverage Status](https://coveralls.io/repos/bitcoinjs/bitcoinjs-lib/badge.png)](https://coveralls.io/r/bitcoinjs/bitcoinjs-lib)

[![NPM](https://nodei.co/npm/bitcoinjs-lib.png)](https://nodei.co/npm/bitcoinjs-lib/)

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
If you are thinking of using the master branch of this library in production, *stop*.
Master is not stable; it is our development branch, and only tagged releases may be classified as stable.

If you are looking for the original, it is tagged as `0.1.3`. Unless you need it for dependency reasons, it is strongly recommended that you use (or upgrade to) the newest version, which adds major functionality, cleans up the interface, fixes many bugs, and adds over 1,300 more tests.


## Installation

`npm install bitcoinjs-lib`


## Setup

### Node.js

    var bitcoin = require('bitcoinjs-lib')

From the repo:

    var bitcoin = require('./src/index.js')


### Browser

From the repository: Compile `bitcoinjs-min.js` with the following command:

    $ npm run-script compile

From NPM:

    $ npm -g install bitcoinjs-lib browserify uglify-js
    $ browserify -r bitcoinjs-lib -s Bitcoin | uglifyjs > bitcoinjs.min.js

After loading this file in your browser, you will be able to use the global `bitcoin` object.


## Usage

These examples assume you are running bitcoinjs-lib in the browser.


### Generating a Bitcoin address

```javascript

key = bitcoin.ECKey.makeRandom()

// Print your private key (in WIF format)
console.log(key.toWIF())
// => Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct

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

### Creating a P2SH Multsig Address

``` javascript
var bitcoin = require('bitcoinjs-lib')
 
var privKeys = [bitcoin.ECKey.makeRandom(), bitcoin.ECKey.makeRandom(), bitcoin.ECKey.makeRandom()]
var pubKeys = privKeys.map(function(x) { return x.pub })
 
var redeemScript = bitcoin.scripts.multisigOutput(2, pubKeys) // 2 of 3
var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash())
 
var multisigAddress = bitcoin.Address.fromOutputScript(scriptPubKey).toString()

console.log("multisigP2SH:", multisigAddress)
// => multisigP2SH: 35k9EWv2F1X5JKXHSF1DhTm7Ybdiwx4RkD
```



## Projects utilizing BitcoinJS

- [Coinpunk](https://coinpunk.com)
- [Hive Wallet](https://www.hivewallet.com)
- [Justchain Exchange](https://justcoin.com)
- [Skyhook ATM](http://projectskyhook.com)
- [BitAddress](https://www.bitaddress.org)
- [Blockchain.info](https://blockchain.info/wallet)
- [Brainwallet](https://brainwallet.github.io)
- [Dark Wallet](https://darkwallet.unsystem.net)
- [Dogechain Wallet](https://dogechain.info)
- [GreenAddress](https://greenaddress.it)
- [DecentralBank](http://decentralbank.com)
 
## Contributors

Stefan Thomas is the inventor and creator of this project. His pioneering work made Bitcoin web wallets possible.

Since then, many people have contributed. [Click here](https://github.com/bitcoinjs/bitcoinjs-lib/graphs/contributors) to see the comprehensive list.

Daniel Cousens, Wei Lu, JP Richardson and Kyle Drake lead the major refactor of the library from 0.1.3 to 1.0.0.

## Contributing

Join the ongoing IRC development channel at `#bitcoinjs-dev` on Freenode.
We are always accepting of Pull requests, but we do adhere to specific standards in regards to coding style, test driven development and commit messages.

Please make your best effort to adhere to these when contributing to save on trivial corrections.


### Running the test suite

    $ npm test
    $ npm run-script coverage


## Complementing Libraries

- [bip39](https://github.com/weilu/bip39) - Wei Lu's Mnemonic code generator
- [BCoin](https://github.com/indutny/bcoin) - BIP37 / Bloom Filters / SPV client
- [scryptsy](https://github.com/cryptocoinjs/scryptsy) - Private key encryption (BIP38)
- [insight](https://github.com/bitpay/insight) - A bitcoin blockchain API for web wallets.


## Alternatives

- [Bitcore](https://github.com/bitpay/bitcore)
- [Cryptocoin](https://github.com/cryptocoinjs/cryptocoin)

## License

This library is free and open-source software released under the MIT license.


## Copyright

BitcoinJS (c) 2011-2012 Stefan Thomas
Released under MIT license
