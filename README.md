# GroestlcoinJS (groestlcoinjs-lib)

The pure JavaScript Groestlcoin library for node.js and browsers.
Used by over a million wallet users and the backbone for almost all Groestlcoin web wallets in production today.


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
- Experiment-friendly: Groestlcoin Mainnet and Testnet support.

## Installation

`npm install groestlcoinjs-lib`


## Setup

### Node.js

    var bitcoin = require('groestlcoinjs-lib')


### Browser

If you're familiar with how to use browserify, ignore this and proceed normally.
These steps are advisory only,  and may not be necessary for your application.

[Browserify](https://github.com/substack/node-browserify) is assumed to be installed for these steps.

From your repository, create an `index.js` file
``` javascript
module.exports = {
  base58: require('bs58'),
  bitcoin: require('groestlcoinjs-lib'),
  ecurve: require('ecurve'),
  BigInteger: require('bigi')
}
```

Install each of the above packages locally
``` bash
npm install bs58 groestlcoinjs-lib ecurve bigi
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

## Examples

The below examples are implemented as integration tests, they should be very easy to understand.  Otherwise, pull requests are appreciated.

- [Generate a random address](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L9)
- [Generate a address from a SHA256 hash](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L20)
- [Generate a address and WIF for Litecoin](https://github.com/bitcoinjs/bitcoinjs-lib/blob/d853806/test/integration/basic.js#L30)
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


## Projects utilizing GroestlcoinJS

- [CoinID](https://coinid.org)
- [Melis Wallet](https://melis.io)
- [Jaxx](https://jaxx.io)


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

- [Bitcore](https://github.com/groestlcoin/groestlcore)

## LICENSE [MIT](LICENSE)


## Copyright

BitcoinJS (c) 2011-2016 bitcoinjs-lib contributors

Released under MIT license
