# BitcoinJS (bitcoinjs-lib)

[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib)
[![NPM](https://img.shields.io/npm/v/bitcoinjs-lib.svg)](https://www.npmjs.org/package/bitcoinjs-lib)
[![tip for next commit](https://tip4commit.com/projects/735.svg)](http://tip4commit.com/projects/735)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)


The pure JavaScript Bitcoin library for node.js and browsers.
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


## Should I use this in production?

If you are thinking of using the master branch of this library in production, **stop**.
Master is not stable; it is our development branch, and [only tagged releases may be classified as stable](https://github.com/bitcoinjs/bitcoinjs-lib/tags).


## Installation

`npm install bitcoinjs-lib`


## Setup

### Node.js

    var bitcoin = require('bitcoinjs-lib')


### Browser

If you're familiar with how to use browserify, ignore this and proceed normally.
These steps are advisory only,  and may not be necessary for your application.

[Browserify](https://github.com/substack/node-browserify) is assumed to be installed for these steps.

From your repository, create an `index.js` file
``` javascript
module.exports = {
  base58: require('bs58'),
  bitcoin: require('bitcoinjs-lib'),
  ecurve: require('ecurve'),
  BigInteger: require('bigi')
}
```

Install each of the above packages locally
``` bash
npm install bs58 bitcoinjs-lib ecurve bigi
```

After installation, use browserify to compile `index.js` for use in the browser:
``` bash
    $ browserify index.js --standalone foo > app.js
```

You will now be able to use `<script src="app.js" />` in your browser, with each of the above exports accessible via the global `foo` object (or whatever you chose for the `--standalone` parameter above).

**NOTE**: See our package.json for the currently supported version of browserify used by this repository.

**NOTE**: When uglifying the javascript, you must exclude the following variable names from being mangled: `Array`, `BigInteger`, `Boolean`, `ECPair`, `Function`, `Number`, `Point` and `Script`.
This is because of the function-name-duck-typing used in [typeforce](https://github.com/dcousens/typeforce).
Example:
``` bash
uglifyjs ... --mangle --reserved 'Array,BigInteger,Boolean,ECPair,Function,Number,Point'
```

**NOTE**: If you expect this library to run on an iOS 10 device, ensure that you are using [buffer@5.0.5](https://www.npmjs.com/package/buffer) or greater.

### Flow

Definitions for [Flow typechecker](https://flowtype.org/) are available in flow-typed repository.

[You can either download them directly](https://github.com/flowtype/flow-typed/blob/master/definitions/npm/bitcoinjs-lib_v2.x.x/flow_%3E%3Dv0.17.x/bitcoinjs-lib_v2.x.x.js) from the repo, or with the flow-typed CLI

    # npm install -g flow-typed
    $ flow-typed install -f 0.27 bitcoinjs-lib@2.2.0 # 0.27 for flow version, 2.2.0 for bitcoinjs-lib version

The definitions are complete and up to date with version 2.2.0. The definitions are maintained by [@runn1ng](https://github.com/runn1ng).

## Examples

The below examples are implemented as integration tests, they should be very easy to understand.  Otherwise, pull requests are appreciated.

- [Generate a random address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L9)
- [Generate a address from a SHA256 hash](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L20)
- [Generate a address and WIF for Litecoin](https://github.com/bitcoin/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L29)
- [Import an address via WIF](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L43)
- [Create a Transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L50)
- [Create an OP RETURN transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/advanced.js#L24)
- [Create a 2-of-3 multisig P2SH address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/multisig.js#L9)
- [Spend from a 2-of-4 multisig P2SH address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/multisig.js#L25)
- [Generate a single-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/stealth.js)
- [Generate a dual-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/stealth.js)
- [Create a BIP32 wallet external address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/8e1c69183f74acce06d6e35b614e504b18bb04e1/test/integration/bip32.js)
- [Create a BIP44, bitcoin, account 0, external address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/8e1c69183f74acce06d6e35b614e504b18bb04e1/test/integration/bip32.js)
- [Recover a BIP32 parent private key from the parent public key and a derived non-hardened child private key](https://github.com/bitcoinjs/bitcoinjs-lib/blob/8e1c69183f74acce06d6e35b614e504b18bb04e1/test/integration/bip32.js)
- [Recover a Private key from duplicate R values in a signature](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/crypto.js)
- [Create a CLTV locked transaction where the expiry is past](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/cltv.js#L36)
- [Create a CLTV locked transaction where the parties bypass the expiry](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/cltv.js#L70)
- [Create a CLTV locked transaction which fails due to expiry in the future](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/cltv.js#L102)
- [Use BIP39 to generate a BIP32 wallet address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/dd3e501/test/integration/bip32.js)

If you have a use case that you feel could be listed here, please [ask for it](https://github.com/bitcoinjs/bitcoinjs-lib/issues/new)!


## Projects utilizing BitcoinJS

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


## Contributors

Stefan Thomas is the inventor and creator of this project. His pioneering work made Bitcoin web wallets possible.
Daniel Cousens, Wei Lu, JP Richardson and Kyle Drake lead the major refactor of the library from 0.1.3 to 1.0.0.

Since then, many people have contributed. [Click here](https://github.com/bitcoinjs/bitcoinjs-lib/graphs/contributors) to see the comprehensive list.


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
- [BIP66](https://github.com/bitcoinjs/bip66) - Strict DER signature decoding
- [BIP69](https://github.com/bitcoinjs/bip69) - Lexicographical Indexing of Transaction Inputs and Outputs
- [Base58](https://github.com/cryptocoinjs/bs58) - Base58 encoding/decoding
- [Base58 Check](https://github.com/bitcoinjs/bs58check) - Base58 check encoding/decoding
- [BCoin](https://github.com/indutny/bcoin) - BIP37 / Bloom Filters / SPV client
- [coinselect](https://github.com/bitcoinjs/coinselect) - A fee-optimizing, transaction input selection module for bitcoinjs-lib.
- [insight](https://github.com/bitpay/insight) - A bitcoin blockchain API for web wallets.
- [merkle-lib](https://github.com/bitcoinjs/merkle-lib) - A performance conscious library for merkle root and tree calculations.
- [minimaldata](https://github.com/bitcoinjs/minimaldata) - A module to check bitcoin policy: SCRIPT_VERIFY_MINIMALDATA


## Alternatives

- [Bitcore](https://github.com/bitpay/bitcore)
- [Cryptocoin](https://github.com/cryptocoinjs/cryptocoin)


## LICENSE [MIT](LICENSE)


## Copyright

BitcoinJS (c) 2011-2016 bitcoinjs-lib contributors

Released under MIT license
