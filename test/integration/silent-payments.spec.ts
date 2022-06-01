import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { describe, it } from 'mocha';

import { regtestUtils } from './_regtest';
import * as bitcoin from '../..';
import { toXOnly } from '../../src/psbt/bip371';

const rng = require('randombytes');
const regtest = regtestUtils.network;
bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

describe('bitcoinjs-lib (silent payments)', () => {
  it('can create (and broadcast via 3PBP) a simple silent payment', async () => {
    const { senderKeyPair, receiverKeyPair, sharedSecret } = initParticipants();
    // this is what the sender sees/scans
    const silentPublicKey = toXOnly(receiverKeyPair.publicKey);

    // the input being spent
    const { output: p2wpkhOutput } = bitcoin.payments.p2wpkh({
      pubkey: senderKeyPair.publicKey,
      network: regtest,
    });

    // amount from faucet
    const amount = 42e4;
    // amount to send
    const sendAmount = amount - 1e4;
    // get faucet
    const unspent = await regtestUtils.faucetComplex(p2wpkhOutput!, amount);

    const psbt = new bitcoin.Psbt({ network: regtest });
    psbt.addInput({
      hash: unspent.txId,
      index: 0,
      witnessUtxo: { value: amount, script: p2wpkhOutput! },
    });

    // destination
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: silentPublicKey,
      hash: sharedSecret,
      network: regtest,
    });
    psbt.addOutput({ value: sendAmount, address: address! });

    psbt.signInput(0, senderKeyPair);

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toBuffer();

    const hex = rawTx.toString('hex');

    await regtestUtils.broadcast(hex);
    await regtestUtils.verify({
      txId: tx.getId(),
      address: address!,
      vout: 0,
      value: sendAmount,
    });
  });
});

function initParticipants() {
  const receiverKeyPair = bip32.fromSeed(rng(64), regtest);
  const senderKeyPair = bip32.fromSeed(rng(64), regtest);


  const senderSharedSecret = ecc.pointMultiply(
    receiverKeyPair.publicKey,
    senderKeyPair.privateKey!,
  );

  const receiverSharedSecred = ecc.pointMultiply(
    senderKeyPair.publicKey,
    receiverKeyPair.privateKey!,
  );

  if (!toBuffer(receiverSharedSecred!).equals(toBuffer(senderSharedSecret!)))
    throw new Error('Shared secret missmatch.');

  return {
    receiverKeyPair,
    senderKeyPair,
    sharedSecret: toXOnly(Buffer.from(receiverSharedSecred!)),
  };
}

const toBuffer = (a: Uint8Array) => Buffer.from(a);
