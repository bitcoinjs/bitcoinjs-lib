# Taproot

A simple keyspend example that is possible with the current API is below.

## Current state of taproot support

- [x] segwit v1 address support via bech32m
- [x] segwit v1 sighash calculation on Transaction class

## TODO

- [ ] p2tr payment API to make script spends easier
- [ ] Support within the Psbt class

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
const crypto = require('crypto');

// bitcoinjs-lib v6
const bitcoin = require('bitcoinjs-lib');
// bip32 v3 wraps tiny-secp256k1
const BIP32Wrapper = require('bip32').default;
const RegtestUtils = require('regtest-client').RegtestUtils;
// tiny-secp256k1 v2 is an ESM module, so we can't "require", and must import async
import('tiny-secp256k1')
  .then(async (ecc) => {
    // End imports

    // set up dependencies
    const APIPASS = process.env.APIPASS || 'satoshi';
    // docker run -d -p 8080:8080 junderw/bitcoinjs-regtest-server
    const APIURL = process.env.APIURL || 'http://127.0.0.1:8080/1';
    const regtestUtils = new RegtestUtils({ APIPASS, APIURL });

    const bip32 = BIP32Wrapper(ecc);

    const myKey = bip32.fromSeed(crypto.randomBytes(64), regtestUtils.network);
    // scriptPubkey
    const output = Buffer.concat([
      // witness v1, PUSH_DATA 32 bytes
      Buffer.from([0x51, 0x20]),
      // x-only pubkey (remove 1 byte y parity)
      myKey.publicKey.slice(1, 33),
    ]);
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
  })
  .catch(console.error);

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
  const signature = Buffer.from(key.signSchnorr(sighash));
  // witness stack for keypath spend is just the signature.
  // If sighash is not SIGHASH_DEFAULT (ALL) then you must add 1 byte with sighash value
  tx.ins[0].witness = [signature];
  return tx;
}
```