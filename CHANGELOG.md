# 3.0.0
From this release users can expect out-of-the-box Segregated Witness support.
The majority of breaking changes have been in how `script` encoding/decoding occurs,  with the introduction of witness stacks.

__added__
- Added `script.types` enums (#679)
- Added `script.*.*.{check,encode,decode[,encodeStack,decodeStack]}` functions (#681, #682)
- Added minimal `TransactionBuilder.prototype.build` absurd fee-safety (#696)
- Added `script.(decompile/compile)PushOnly` and `script.toStack` functions (#700)
- Added `Transaction.prototype.toBuffer` Segregated Witness serialization support (#684, #701)
- Added `Transaction.prototype.hasWitnesses` (#718)
- Added `script.witnessCommitment.*` template

__fixed__
- Fixed `script` must compile minimally (#638)
- Fixed `Transaction` and `Block` versions should be Int32, signed integers (#662)

__removed__
- Removed `ecdsa.calcPubKeyRecoveryParam`, `ecdsa.recoverPubKey` (#456)
- Removed `buffer-equals`/`buffer-compare` dependencies (#650)
- Removed `HDNode.prototype.toString` (#665)
- Removed `dogecoin` network (#675)

__renamed__
- Removed `script.*` functions in favour of `bitcoin.script.*.(input/output).(encode/decode/check)` style (#682)

# 2.3.0
__added__
- Added `HDNode.prototype.isNeutered` (#536)
- Added `HDNode.prototype.derivePath` (#538)
- Added typeforce checking for `HDNode.prototype.derive*` (#539)
- Added `Transaction.prototype.isCoinbase` (#578)
- Added `Block.prototype.checkMerkleRoot` (#580)
- Added `Block.calculateMerkleRoot` (#580)
- Added `TransactionBuilder.prototype.setVersion` (#599)
- Added `script.isWitnessPubKeyHashOutput` (#602)
- Added `script.isWitnessScriptHashOutput` (#602)
- Added `script.witnessPubKeyHashOutput` (#602)
- Added `script.witnessScriptHashOutput` (#602)
- Added `script.witnessScriptHashInput` (#602)

__fixed__
- Fixed "BIP32 is undefined" when network list given to `HDNode` but no compatible version found (#550)
- Fixed `writePushDataInt` output to adhere to minimal data push policy (#617)


# 2.2.0
__added__
- Added `Block.calculateTarget` for difficulty calculations (#509)
- Added `Block.prototype.checkProofOfWork` (#509)
- Added `opcodes.OP_CHECKLOCKTIMEVERIFY` alias for `OP_NOP2` (#511)
- Added `script.number.[encode/decode]` for CScriptNum-encoded `Buffer`s (#516)
- Added `TransactionBuilder.prototype.setLockTime` (#507)

__fixed__
- Bumped `typeforce` version to fix erroneous error message from `types.Hash*bit` types (#534)


# 2.1.4
__fixed__
- script.isPubKeyHashOutput and script.isScriptHashOutput no longer allow for non-minimal data pushes (per bitcoin/bitcoin `IsStandard` policy) (#499)
- TransactionBuilder.addOutput now allows for SIGHASH_SINGLE, throwing if the contract is violated (#504)
- remove use of `const`, use ES5 only (#502)


# 2.1.3
__fixed__
- Bumped typeforce to 1.5.5 (see #493)


# 2.1.2
__fixed__
- Add missing CHANGELOG entry for 2.1.1


# 2.1.1
__changed__
- removed use of `buffer-reverse`, dependency only kept for `bufferutils.reverse`, to be deprecated (#478)

__fixed__
- `isMultisigOutput` no longer allows data chunks for `m`/`n` (#482)
- `isMultisigOutput`'s `n` value must now match the number of public keys (as per bitcoin/bitcoin) (#484)


# 2.1.0
From this release users should use the HDNode directly (compared to accessing `.keyPair`) when performing ECDSA operations such as `sign` or `verify`.
Ideally you shoud not have to directly access `HDNode` internals for general usage,  as it can often be confusing and error prone.

__added__
- `ECPair.prototype.getNetwork`
- `HDNode.prototype.getNetwork`, wraps the underyling keyPair's `getNetwork` method
- `HDNode.prototype.getPublicKeyBuffer`, wraps the underyling keyPair's `getPublicKeyBuffer` method
- `HDNode.prototype.sign`, wraps the underlying keyPair's `sign` method
- `HDNode.prototype.verify`, wraps the underlying keyPair's `verify` method


# 2.0.0
In this release we have strived to simplify the API,  [using native types](https://github.com/bitcoinjs/bitcoinjs-lib/issues/407) wherevever possible to encourage cross-compatibility with other open source community modules.

The `ecdsa` module has been removed in lieu of using a new ECDSA module (for performance and safety reasons) during the `2.x.y` major release.
Several other cumbersome modules have been removed,  with their new independent modules recommended for usage instead for greater modularity in your projects.

-----------------------------

Backward incompatible changes:

__added__
- export `address`, for `address` based [utility functions](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/address.js), most compatible, just without `Address` instantiation, see #401, #444
- export `script`, for `script` based [utility functions](https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script.js), mostly compatible, just without `Script` instantiation, see #438, #444
- export `ECPair`, a merged replacement for `ECKey`/`ECPubKey`, invalid types will throw via `typeforce`

__changed__
- `address.toOutputScript`, `ECPair.prototype.fromWIF` and `HDNode.prototype.fromBase58` no longer automatically detect the network, `networks.bitcoin` is always assumed unless given.
- `assert` was used for type checking, now replaced by `typeforce`
- `BIP66` compliant strict DER signature validation was added to `ECSignature.fromDER`, changing the exact exception messages slightly, see #448.

- `new HDNode(d/Q, chainCode, network)` -> `new HDNode(keyPair, chainCode)`, now uses `ECPair`
- `HDNode.prototype.toBase58(false)` -> `HDNode.prototype.neutered().toBase58()` for exporting an extended public key
- `HDNode.prototype.toBase58(true)` -> `HDNode.prototype.toBase58()` for exporting an extended private key

- `Transaction.prototype.hashForSignature(prevOutScript, inIndex, hashType)` -> `Transaction.prototype.hashForSignature(inIndex, prevOutScript, hashType)`
- `Transaction.prototype.addInput(hash, ...)`: `hash` could be a string, Transaction or Buffer -> `hash` can now **only** be a `Buffer`.
- `Transaction.prototype.addOutput(scriptPubKey, ...)`: `scriptPubKey ` could be a string, `Address` or a `Buffer` -> `scriptPubKey` can now **only** be a `Buffer`.
- `TransactionBuilder` API unchanged.

__removed__
- export `Address`, `strings` are now used,  benchwith no performance loss for most use cases
- export `base58check`, use [`bs58check`](https://github.com/bitcoinjs/bs58check) instead
- export `ecdsa`, use [`ecurve`](https://github.com/cryptocoinjs/ecurve) instead
- export `ECKey`, use new export `ECPair` instead
- export `ECPubKey`, use new export `ECPair` instead
- export `Wallet`, see README.md#complementing-libraries instead
- export `Script`, use new utility export `script` instead (#438 for more information)

- `crypto.HmacSHA256 `, use [node crypto](https://nodejs.org/api/crypto.html) instead
- `crypto.HmacSHA512 `, use [node crypto](https://nodejs.org/api/crypto.html) instead

- `Transaction.prototype.sign`, use `TransactionBuilder.prototype.sign`
- `Transaction.prototype.signInput`, use `TransactionBuilder.prototype.sign`
- `Transaction.prototype.validateInput`, use `Transaction.prototype.hashForSignature` and `ECPair.verify`

- `HDNode.fromBuffer`, use `HDNode.fromBase58` instead
- `HDNode.fromHex`, use `HDNode.fromBase58` instead
- `HDNode.toBuffer`, use `HDNode.prototype.toBase58` instead
- `HDNode.toHex`, use `HDNode.prototype.toBase58` instead

- `networks.*.magic`, see the comment [here](https://github.com/bitcoinjs/bitcoinjs-lib/pull/432/files#r36715792)
- `networks.[viacoin|viacointestnet|gamerscoin|jumbucks|zetacoin]`, import these yourself (see #383/a0e6ee7)
- `networks.*.estimateFee`, out-dated

__renamed__
- `Message` -> `message`
- `scripts` -> `script`
- `scripts.dataOutput ` -> `script.nullDataOutput` (per [convention](https://org/en/glossary/null-data-transaction))
