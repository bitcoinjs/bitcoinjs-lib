# BitcoinJS (bitcoinjs-lib)
[![Build Status](https://travis-ci.org/bitcoinjs/bitcoinjs-lib.png?branch=master)](https://travis-ci.org/bitcoinjs/bitcoinjs-lib)
[![NPM](https://img.shields.io/npm/v/bitcoinjs-lib.svg)](https://www.npmjs.org/package/bitcoinjs-lib)

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

A javascript Bitcoin library for node.js and browsers.

Released under the terms of the [MIT LICENSE](LICENSE).

## Should I use this in production?
If you are thinking of using the *master* branch of this library in production, **stop**.
Master is not stable; it is our development branch, and [only tagged releases may be classified as stable](https://github.com/bitcoinjs/bitcoinjs-lib/tags).


## Can I trust this code?
> Don't trust. Verify.

We recommend every user of this library and the [bitcoinjs](https://github.com/bitcoinjs) ecosystem audit and verify any underlying code for its validity and suitability.

Mistakes and bugs happen, but with your help in resolving and reporting [issues](https://github.com/bitcoinjs/bitcoinjs-lib/issues), together we can produce open source software that is:

- Easy to audit and verify,
- Tested, with test coverage >95%,
- Advanced and feature rich,
- Standardized, using [standard](http://github.com/standard/standard) and Node `Buffer`'s throughout, and
- Friendly, with a strong and helpful community, ready to answer questions.

## Documentation
Presently,  we do not have any formal documentation other than our [examples](#examples), please [ask for help](https://github.com/bitcoinjs/bitcoinjs-lib/issues/new) if our examples aren't enough to guide you.


## Installation
``` bash
npm install bitcoinjs-lib
```

Typically we support the [Node Maintenance LTS version](https://github.com/nodejs/Release).
If in doubt, see the [.travis.yml](.travis.yml) for what versions are used by our continuous integration tests.

**WARNING**: We presently don't provide any tooling to verify that the release on `npm` matches GitHub.  As such, you should verify anything downloaded by `npm` against your own verified copy.


## Usage

### Browser
The recommended method of using `bitcoinjs-lib` in your browser is through [Browserify](https://github.com/substack/node-browserify).
If you're familiar with how to use browserify, ignore this and carry on, otherwise, it is recommended to read the tutorial at http://browserify.org/.

**NOTE**: We use Node Maintenance LTS features, if you need strict ES5, use [`--transform babelify`](https://github.com/babel/babelify) in conjunction with your `browserify` step (using an [`es2015`](http://babeljs.io/docs/plugins/preset-es2015/) preset).

**NOTE**: If you expect this library to run on an iOS 10 device, ensure that you are using [buffer@5.0.5](https://github.com/feross/buffer/pull/155) or greater.

### Typescript or VSCode users
Type declarations for Typescript [are available](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/0897921174860ec3d5318992d2323b3ae8100a68/types/bitcoinjs-lib) for version `^3.0.0` of the library.

``` bash
npm install @types/bitcoinjs-lib
```

For VSCode (and other editors), it is advised to install the type declarations, as Intellisense uses that information to help you code (autocompletion, static analysis).

**WARNING**: These Typescript definitions are not maintained by the maintainers of this repository, and are instead maintained at [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped).
Please report any issues or problems there.


### Flow
[Flow-type](https://flowtype.org/) definitions for are available in the [flow-*typed* repository](https://github.com/flowtype/flow-typed/tree/master/definitions/npm/bitcoinjs-lib_v2.x.x) for version `^2.0.0` of the library.

You can [download them directly](https://github.com/flowtype/flow-typed/blob/master/definitions/npm/bitcoinjs-lib_v2.x.x/flow_v0.17.x-/bitcoinjs-lib_v2.x.x.js), or using the flow-typed CLI:

``` bash
npm install -g flow-typed
flow-typed install -f 0.27 bitcoinjs-lib@2.2.0
```

These definitions are maintained by [@runn1ng](https://github.com/runn1ng).


## Examples
The below examples are implemented as integration tests, they should be very easy to understand.
Otherwise, pull requests are appreciated.
Some examples interact (via HTTPS) with a 3rd Party Blockchain Provider (3PBP).

- [Generate a random address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L22)
- [Generate an address from a SHA256 hash](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L29)
- [Import an address via WIF](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L40)
- [Generate a 2-of-3 P2SH multisig address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L47)
- [Generate a SegWit address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L60)
- [Generate a SegWit P2SH address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L67)
- [Generate a SegWit 3-of-4 multisig address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L76)
- [Generate a SegWit 2-of-2 P2SH multisig address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L90)
- [Support the retrieval of transactions for an address (3rd party blockchain)](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L104)
- [Generate a Testnet address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L123)
- [Generate a Litecoin address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/addresses.js#L133)
- [Create a 1-to-1 Transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L13)
- [Create a 2-to-2 Transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L28)
- [Create (and broadcast via 3PBP) a typical Transaction](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L47)
- [Create (and broadcast via 3PBP) a Transaction with an OP\_RETURN output](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L83)
- [Create (and broadcast via 3PBP) a Transaction with a 2-of-4 P2SH(multisig) input](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L105)
- [Create (and broadcast via 3PBP) a Transaction with a SegWit P2SH(P2WPKH) input](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L143)
- [Create (and broadcast via 3PBP) a Transaction with a SegWit P2WPKH input](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L174)
- [Create (and broadcast via 3PBP) a Transaction with a SegWit P2PK input](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L218)
- [Create (and broadcast via 3PBP) a Transaction with a SegWit 3-of-4 P2SH(P2WSH(multisig)) input](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L263)
- [Verify a Transaction signature](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/transactions.js#L304)
- [Import a BIP32 testnet xpriv and export to WIF](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.js#L12)
- [Export a BIP32 xpriv, then import it](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.js#L20)
- [Export a BIP32 xpub](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.js#L31)
- [Create a BIP32, bitcoin, account 0, external address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.js#L40)
- [Create a BIP44, bitcoin, account 0, external address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.js#L55)
- [Create a BIP49, bitcoin testnet, account 0, external address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.js#L71)
- [Use BIP39 to generate BIP32 addresses](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/bip32.js#L86)
- [Create (and broadcast via 3PBP) a Transaction where Alice can redeem the output after the expiry (in the past)](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/cltv.js#L43)
- [Create (and broadcast via 3PBP) a Transaction where Alice can redeem the output after the expiry (in the future)](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/cltv.js#L88)
- [Create (and broadcast via 3PBP) a Transaction where Alice and Bob can redeem the output at any time](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/cltv.js#L144)
- [Create (but fail to broadcast via 3PBP) a Transaction where Alice attempts to redeem before the expiry](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/cltv.js#L190)
- [Recover a private key from duplicate R values](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/crypto.js#L14)
- [Recover a BIP32 parent private key from the parent public key, and a derived, non-hardened child private key](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/crypto.js#L68)
- [Generate a single-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/stealth.js#L72)
- [Generate a single-key stealth address (randomly)](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/stealth.js#L91)
- [Recover parent recipient.d, if a derived private key is leaked (and nonce was revealed)](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/stealth.js#L107)
- [Generate a dual-key stealth address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/stealth.js#L124)
- [Generate a dual-key stealth address (randomly)](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/test/integration/stealth.js#L147)

If you have a use case that you feel could be listed here, please [ask for it](https://github.com/bitcoinjs/bitcoinjs-lib/issues/new)!


## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).


### Running the test suite

``` bash
npm test
npm run-script coverage
```

## Complementing Libraries
- [BIP21](https://github.com/bitcoinjs/bip21) - A BIP21 compatible URL encoding library
- [BIP38](https://github.com/bitcoinjs/bip38) - Passphrase-protected private keys
- [BIP39](https://github.com/bitcoinjs/bip39) - Mnemonic generation for deterministic keys
- [BIP32-Utils](https://github.com/bitcoinjs/bip32-utils) - A set of utilities for working with BIP32
- [BIP66](https://github.com/bitcoinjs/bip66) - Strict DER signature decoding
- [BIP68](https://github.com/bitcoinjs/bip68) - Relative lock-time encoding library
- [BIP69](https://github.com/bitcoinjs/bip69) - Lexicographical Indexing of Transaction Inputs and Outputs
- [Base58](https://github.com/cryptocoinjs/bs58) - Base58 encoding/decoding
- [Base58 Check](https://github.com/bitcoinjs/bs58check) - Base58 check encoding/decoding
- [Bech32](https://github.com/bitcoinjs/bech32) - A BIP173 compliant Bech32 encoding library
- [coinselect](https://github.com/bitcoinjs/coinselect) - A fee-optimizing, transaction input selection module for bitcoinjs-lib.
- [merkle-lib](https://github.com/bitcoinjs/merkle-lib) - A performance conscious library for merkle root and tree calculations.
- [minimaldata](https://github.com/bitcoinjs/minimaldata) - A module to check bitcoin policy: SCRIPT_VERIFY_MINIMALDATA


## Alternatives
- [BCoin](https://github.com/indutny/bcoin)
- [Bitcore](https://github.com/bitpay/bitcore)
- [Cryptocoin](https://github.com/cryptocoinjs/cryptocoin)


## LICENSE [MIT](LICENSE)
