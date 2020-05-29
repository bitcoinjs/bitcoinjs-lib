# 5.1.9
__fixed__
- Fixed errors for psbt.txOutputs getter (#1578)

# 5.1.8
__fixed__
- Throw errors when p2wsh or p2wpkh contain uncompressed pubkeys (#1573)

__added__
- Add txInputs and txOutputs for Psbt (#1561)

__changed__
- (Not exposed) Added BufferWriter to help ease maintenance of certain forks of this library (#1533)

# 5.1.7
__fixed__
- Fixed Transaction class Output interface typing for TypeScript (#1506)
- Add `weight()` to Block class, add optional includeWitness arg to Transaction byteLength method (#1515)
- Match the old TransactionBuilder behavior of allowing for multiple instances of the same pubkey to be in a p2ms script for PSBT (#1519)

__added__
- Allow the API consumer to pass in the finalizer functions to allow for any type of transaction to be finalized. It places the most crucial part of transaction construction on the consumer, and should be used with caution. (#1491)

# 5.1.6
__fixed__
- `PsbtOutputExtended` did not support using the address attribute properly. It is now fixed.

# 5.1.5
__added__
- `Psbt` now has `getFee(): number` for use when all inputs are finalized. It returns the satoshi fee of the transaction. Calling getFee, getFeeRate, or extractTransaction will cache these values so if you call one after the other, the second call will return immediately.

# 5.1.4
__changed__
- `Psbt` inputs using segwit scripts can now work with nonWitnessUtxo as well as the original witnessUtxo. The reasoning for this is that nonWitnessUtxo has all the information contained in the witnessUtxo, so rejecting signing even though we have all the info we need is unnecessary. Trying to sign a non-segwit script with a witnessUtxo will still throw an Error as it should.

# 5.1.3
__changed__
- TypeScript types: Made Signer and SignerAsync use any for network since we only check for equivalence. (#1448)
- TypeScript types: Made the args for addInput and addOutput for Psbt actually accept updateInput and updateOutput parameters. (#1449)

# 5.1.2
__added__
- `ECPair` and `bip32` objects now have a lowR boolean attribute defaulted to false. You may set it to true to ensure that the sign method uses low R values (#1442) (This is to enable low R usage in Psbt, since we decided not to give the low R flag to the Psbt class, since it makes more sense to be an attribute of the Signer interface)

# 5.1.1
__changed__
- Name inconsistencies for Psbt class. (Quick fix)

# 5.1.0
__added__
- A new `Psbt` class for creating, distributing, combining, signing, and compiling Transactions (#1425)
- A `name` attribute to the Payment interface. P2SH and P2WSH are nested with `'-'` as separator, and p2ms is in the format of `'p2ms(m of n)''` all others are just hard coded. (#1433)

__changed__
- `TransactionBuilder`: Migrate to stricter type checks during sign by switching to a single object parameter (#1416)
- `tests`: Use regtest-client as separate library (#1421)

# 5.0.5
__added__
- Added `ECPairInterface` `Stack` and `StackElement` interfaces to the main index.ts export (TypeScript only affected)

# 5.0.4
__added__
- low R value support for ECPair, bip32, and TransactionBuilder (default off) via `txb.setLowR()` (#1385)

__fixed__
- Fixed Various TypeScript types that have been pushed out since v5.0.0 (#1388)

# 5.0.0
__added__
- TypeScript support (#1319)
- `Block.prototype.checkTxRoots` will check the merkleRoot and witnessCommit if it exists against the transactions array. (e52abec) (0426c66)

__changed__
- `Transaction.prototype.getHash` now has `forWitness?: boolean` which when true returns the hash for wtxid (a652d04)
- `Block.calculateMerkleRoot` now has `forWitness?: boolean` which when true returns the witness commit (a652d04)

__removed__
- `Block.prototype.checkMerkleRoot` was removed, please use `checkTxRoots` (0426c66)

# 4.0.5
__fixed__
- Fixed bug where Angular apps break due to lack of crypto at build time. Reverted #1373 and added (6bead5d).

# 4.0.4
__fixed__
- Fixed bug where Electron v4 breaks due to lack of `'rmd160'` alias for ripemd160 hash. (#1373)

# 4.0.3
__fixed__
- Fixed `TransactionBuilder` to require that the Transaction has outputs before signing (#1151)
- Fixed `payments.p2sh`, which now takes the network from the redeem attribute if one is not given in the object argument (#1232)
- Fixed `Block.calculateTarget` to allow for exponents up to 29 (#1285)
- Fixed some low priority rarely occurring bugs with multisig payments and `TransactionBuilder` multisig processing (#1307)

__added__
- Regtest network object to `networks` (#1261)

# 4.0.2
__fixed__
- Fixed `TransactionBuilder` not throwing when payment type validation should fail (#1195)

__removed__
- Removed rogue `package.json` from `src/payments` (#1216)

# 4.0.1
__fixed__
- Fixed `tiny-secp256k1` dependency version (used `ecurve`) (#1139)
- Fixed `TransactionBuilder` throwing when trying to sign `P2WSH(P2WPKH)` (#1135)

# 4.0.0
__added__
- Added [`bip32`](https://github.com/bitcoinjs/bip32) dependency as a primary export (#1073)
- Added `ECPair.fromPrivateKey` (#1070)
- Added `payments` export, with support for `p2pkh`, `p2pk`, `p2ms`, `p2sh`, `p2wpkh`, `p2wsh` and `embed` payment types (#1096, #1119)
- Added `script.signature.encode/decode` for script signatures (#459)

__changed__
- `ECPair.prototype.sign` now returns a 64-byte signature `Buffer`, not an `ECSignature` object (#1084)
- `ECPair` (and all ECDSA code) now uses [`tiny-secp256k1`](https://github.com/bitcoinjs/tiny-secp256k1), which uses the [`libsecp256k1` library](https://github.com/bitcoin-core/secp256k1) (#1070)
- `TransactionBuilder` internal variables are now `__` prefixed to discourage public usage (#1038)
- `TransactionBuilder` now defaults to version 2 transaction versions (#1036)
- `script.decompile` now returns `[Buffer]` or `null`, if decompilation failed (#1039)

__fixed__
- Fixed `TransactionBuilder` rejecting uncompressed public keys to comply with BIP143 (#987)

__removed__
- Removed Node 4/5 LTS support (#1080)
- Removed `ECPair.fromPublicKeyBuffer`, use `ECPair.fromPublicKey` (#1070)
- Removed `ECPair.prototype.getAddress`, use `payments.p2pkh` instead (#1085)
- Removed `ECPair.prototype.getPrivateKey`, use `ECPair.prototype.privateKey` property (#1070)
- Removed `ECPair.prototype.getPublicKey`, use `ECPair.prototype.publicKey` property (#1070)
- Removed `ECPair.prototype.getNetwork`, use `ECPair.prototype.network` property (#1070)
- Removed `ECSignature`, use `script.signature.encode/decode` instead (#459)
- Removed `HDNode`, use `bip32` export instead (#1073)
- Removed `bufferutils` (#1035)
- Removed `networks.litecoin`, BYO non-Bitcoin networks instead (#1095)
- Removed `script.isCanonicalSignature`, use `script.isCanonicalScriptSignature` instead (#1094)
- Removed `script.*.input/output/check` functions (`templates`), use `payments.*` instead (`templates` previously added in #681, #682) (#1119)
- Removed dependency `bigi`, uses `bn.js` internally now (via `tiny-secp256k1`) (#1070, #1112)
- Removed public access to `ECPair` constructor, use exported functions `ECPair.fromPrivateKey`, `ECPair.fromWIF`, `ECPair.makeRandom`, or `ECPair.fromPublicKey` (#1070)

# 3.3.2
__fixed__
- Fixed `decodeStack` arbitrarily supporting non-Array arguments (#942)

# 3.3.1
__changed__
- Increased the `TransactionBuilder` `maximumFeeRate` from 1000 to 2500 satoshis/byte. (#931)

# 3.3.0
__added__
- Added `ECSignature.prototype.toRSBuffer`/`ECSignature.fromRSBuffer` (#915)
- Added support to `TransactionBuilder` for 64-byte signatures via `.sign` (#915)
- Added support to `TransactionBuilder` for the `.publicKey` standard as an alternative to `.getPublicKey()` (#915)

# 3.2.1
__fixed__
- Fixed `script.scripthash.input.check` recursion (#898)
- Fixed `TransactionBuilder` sometimes ignoring witness value (#901)
- Fixed `script.witnessScriptHash.input` implementation (previously used the P2SH impl.) (#911)

# 3.2.0
__added__
- Added `address.fromBech32/toBech32` (#846)

# 3.1.0
__added__
- Added `Transaction.prototype.virtualSize` (#811)
- Added `Transaction.prototype.weight` (#811)

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
- Added `TransactionBuilder.prototype.sign` now has two additional parameters, `witnessValue`, and `witnessScript`
- Added `Transaction.hashForWitnessV0` and `Transaction.setWitness` (5c2fdb60436714f18440dc709f0be065928c1e49)

__fixed__
- Fixed `script` must compile minimally (#638)
- Fixed `Transaction` and `Block` versions should be Int32, signed integers (#662)

__removed__
- Removed `ecdsa.calcPubKeyRecoveryParam`, `ecdsa.recoverPubKey` (#456)
- Removed `buffer-equals`/`buffer-compare` dependencies (#650)
- Removed `HDNode.prototype.toString` (#665)
- Removed `dogecoin` network (#675)
- Removed `message` export, moved to [`bitcoinjs-message`](https://github.com/bitcoinjs/bitcoinjs-message) (#456)

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
