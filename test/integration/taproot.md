# Taproot

A simple keyspend example that is possible with the current API is below.

## Current state of taproot support

- [x] segwit v1 address support via bech32m
- [x] segwit v1 sighash calculation on Transaction class

## TODO

- [x] p2tr payment API to make script spends easier
- [ ] Support within the Psbt class
   - partial support added

## Example

### Requirements
- npm dependencies
  - bitcoinjs-lib v6.x.x
  - bip32 v3.x.x
  - tiny-secp256k1 v2.x.x
  - regtest-client vx.x.x
- local regtest-server docker container running
  - `docker run -d -p 8080:8080 junderw/bitcoinjs-regtest-server`
- node >= v14

```js
// Run this whole file as async
// Catch any errors at the bottom of the file
// and exit the process with 1 error code
(async () => {

// Order of the curve (N) - 1
const N_LESS_1 = Buffer.from(
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
  'hex'
);
// 1 represented as 32 bytes BE
const ONE = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000001',
  'hex'
);

const crypto = require('crypto');
// bitcoinjs-lib v6
const bitcoin = require('bitcoinjs-lib');
// bip32 v3 wraps tiny-secp256k1
const BIP32Wrapper = require('bip32').default;
const RegtestUtils = require('regtest-client').RegtestUtils;
// tiny-secp256k1 v2 is an ESM module, so we can't "require", and must import async
const ecc = await import('tiny-secp256k1');
// wrap the bip32 library
const bip32 = BIP32Wrapper(ecc);
// set up dependencies
const APIPASS = process.env.APIPASS || 'satoshi';
// docker run -d -p 8080:8080 junderw/bitcoinjs-regtest-server
const APIURL = process.env.APIURL || 'http://127.0.0.1:8080/1';
const regtestUtils = new RegtestUtils({ APIPASS, APIURL });
// End imports

const myKey = bip32.fromSeed(crypto.randomBytes(64), regtestUtils.network);

const output = createKeySpendOutput(myKey.publicKey);
const address = bitcoin.address.fromOutputScript(
  output,
  regtestUtils.network
);
// amount from faucet
const amount = 42e4;
// amount to send
const sendAmount = amount - 1e4;
// get faucet
const unspent = await regtestUtils.faucetComplex(output, amount);

const tx = createSigned(
  myKey,
  unspent.txId,
  unspent.vout,
  sendAmount,
  [output],
  [amount]
);

const hex = tx.toHex();
console.log('Valid tx sent from:');
console.log(address);
console.log('tx hex:');
console.log(hex);
await regtestUtils.broadcast(hex);
await regtestUtils.verify({
  txId: tx.getId(),
  address,
  vout: 0,
  value: sendAmount,
});

// Function for creating a tweaked p2tr key-spend only address
// (This is recommended by BIP341)
function createKeySpendOutput(publicKey) {
  // x-only pubkey (remove 1 byte y parity)
  const myXOnlyPubkey = publicKey.slice(1, 33);
  const commitHash = bitcoin.crypto.taggedHash('TapTweak', myXOnlyPubkey);
  const tweakResult = ecc.xOnlyPointAddTweak(myXOnlyPubkey, commitHash);
  if (tweakResult === null) throw new Error('Invalid Tweak');
  const { xOnlyPubkey: tweaked } = tweakResult;
  // scriptPubkey
  return Buffer.concat([
    // witness v1, PUSH_DATA 32 bytes
    Buffer.from([0x51, 0x20]),
    // x-only tweaked pubkey
    tweaked,
  ]);
}

// Function for signing for a tweaked p2tr key-spend only address
// (Required for the above address)
function signTweaked(messageHash, key) {
  const privateKey =
    key.publicKey[0] === 2
      ? key.privateKey
      : ecc.privateAdd(ecc.privateSub(N_LESS_1, key.privateKey), ONE);
  const tweakHash = bitcoin.crypto.taggedHash(
    'TapTweak',
    key.publicKey.slice(1, 33)
  );
  const newPrivateKey = ecc.privateAdd(privateKey, tweakHash);
  if (newPrivateKey === null) throw new Error('Invalid Tweak');
  return ecc.signSchnorr(messageHash, newPrivateKey, Buffer.alloc(32));
}

// Function for creating signed tx
function createSigned(key, txid, vout, amountToSend, scriptPubkeys, values) {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  // Add input
  tx.addInput(Buffer.from(txid, 'hex').reverse(), vout);
  // Add output
  tx.addOutput(scriptPubkeys[0], amountToSend);
  const sighash = tx.hashForWitnessV1(
    0, // which input
    scriptPubkeys, // All previous outputs of all inputs
    values, // All previous values of all inputs
    bitcoin.Transaction.SIGHASH_DEFAULT // sighash flag, DEFAULT is schnorr-only (DEFAULT == ALL)
  );
  const signature = Buffer.from(signTweaked(sighash, key));
  // witness stack for keypath spend is just the signature.
  // If sighash is not SIGHASH_DEFAULT (ALL) then you must add 1 byte with sighash value
  tx.ins[0].witness = [signature];
  return tx;
}

})().catch((err) => {
  console.error(err);
  process.exit(1);
});
```