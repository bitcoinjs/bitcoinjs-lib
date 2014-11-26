# BitcoinJS (bitcoinjs-lib)

[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib)
[![Coverage Status](https://coveralls.io/repos/bitcoinjs/bitcoinjs-lib/badge.png)](https://coveralls.io/r/bitcoinjs/bitcoinjs-lib)
[![tip for next commit](http://tip4commit.com/projects/735.svg)](http://tip4commit.com/projects/735)

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

From Bower:

    $ bower install bitcoinjs-lib --save

then include in html

    <script src="bower_componenets/bitcoinjs-lib/bitcoin-js.min.js"></script>

From the repository: Compile `bitcoinjs-min.js` with the following command:

    $ npm run-script compile

From NPM:

    $ npm -g install bitcoinjs-lib browserify uglify-js
    $ browserify -r bitcoinjs-lib -s bitcoin | uglifyjs > bitcoinjs.min.js

After loading this file in your browser, you will be able to use the global `bitcoin` object.


## Examples

The below examples are implemented as integration tests, but should be very easy to follow.  Pull requests welcome.

- [Generate a random address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L8)
- [Generate a address from a SHA256 hash](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L20)
- [Import an address via WIF](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L29)
- [Create a Transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/basic.js#L36)
- [Sign a Bitcoin message](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L9)
- [Verify a Bitcoin message](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L17)
- [Generate a single-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L25)
- [Generate a dual-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L58)
- [Create an OP RETURN transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/advanced.js#L60)
- [Create a 2-of-3 multisig P2SH address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/multisig.js#L8)
- [Spend from a 2-of-2 multisig P2SH address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/multisig.js#L22)


## Projects utilizing BitcoinJS

- [BitAddress](https://www.bitaddress.org)
- [Blockchain.info](https://blockchain.info/wallet)
- [Brainwallet](https://brainwallet.github.io)
- [Coinkite](https://coinkite.com)
- [Coinpunk](https://coinpunk.com)
- [Dark Wallet](https://darkwallet.unsystem.net)
- [DecentralBank](http://decentralbank.co)
- [Dogechain Wallet](https://dogechain.info)
- [GreenAddress](https://greenaddress.it)
- [Hive Wallet](https://www.hivewallet.com)
- [Justchain Exchange](https://justcoin.com)
- [QuickCoin](https://wallet.quickcoin.co)
- [Skyhook ATM](http://projectskyhook.com)


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

- [BIP39](https://github.com/weilu/bip39) - Mnemonic code for generating deterministic keys
- [BIP38](https://github.com/cryptocoinjs/bip38) - Passphrase-protected private keys
- [BCoin](https://github.com/indutny/bcoin) - BIP37 / Bloom Filters / SPV client
- [insight](https://github.com/bitpay/insight) - A bitcoin blockchain API for web wallets.


## Alternatives

- [Bitcore](https://github.com/bitpay/bitcore)
- [Cryptocoin](https://github.com/cryptocoinjs/cryptocoin)


## License

This library is free and open-source software released under the MIT license.


## Copyright

BitcoinJS (c) 2011-2014 Bitcoinjs-lib contributors
Released under MIT license
