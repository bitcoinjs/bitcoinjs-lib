import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { describe, it } from 'mocha';

import { regtestUtils } from './_regtest';
import * as bitcoin from '../..';
import { toXOnly } from '../../src/psbt/bip371';

import { tweakSigner } from './taproot.utils';

const rng = require('randombytes');
const regtest = regtestUtils.network;
bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

describe('bitcoinjs-lib (silent payments)', () => {
  it('can create (and broadcast via 3PBP) a simple silent payment', async () => {
    // for simplicity the transactions in this test have only one input and one output

    const { senderKeyPair, receiverKeyPair, sharedSecret } = initParticipants();

    // this is what the sender sees/scans (from twitter bio, public forum, truck door)
    const silentPublicKey = toXOnly(receiverKeyPair.publicKey);

    const senderUtxo = await fundP2pkhUtxo(senderKeyPair.publicKey);

    // amount to pay the silent address
    const payAmount = senderUtxo.value - 1e4;
    const {
      psbt: payPsbt,
      address: tweakedSilentAddress,
    } = buildPayToSilentAddress(
      senderUtxo.txId,
      senderUtxo,
      silentPublicKey,
      payAmount,
      sharedSecret,
    );
    payPsbt.signInput(0, senderKeyPair).finalizeAllInputs();

    // the transaction paying to the silent address
    const payTx = payPsbt.extractTransaction();
    await broadcastAndVerifyTx(payTx, tweakedSilentAddress!, payAmount);

    // the amount the receiver will spend
    const sendAmount = payAmount - 1e4;
    // the utxo with the tweaked silent address
    const receiverUtxo = { value: payAmount, script: payTx.outs[0].script };
    const { psbt: spendPsbt, address } = buildSpendFromSilentAddress(
      payTx.getId(),
      receiverUtxo,
      silentPublicKey,
      sendAmount,
      sharedSecret,
    );

    const tweakedSigner = tweakSigner(receiverKeyPair!, {
      tweakHash: sharedSecret,
      network: regtest,
    });
    spendPsbt.signInput(0, tweakedSigner).finalizeAllInputs();

    // the transaction spending from the silent address
    const spendTx = spendPsbt.extractTransaction();
    await broadcastAndVerifyTx(spendTx, address!, sendAmount);
  });
});

async function fundP2pkhUtxo(senderPubKey: Buffer) {
  // the input being spent
  const { output: p2wpkhOutput } = bitcoin.payments.p2wpkh({
    pubkey: senderPubKey,
    network: regtest,
  });

  // amount from faucet
  const amount = 42e4;
  // get faucet
  const unspent = await regtestUtils.faucetComplex(p2wpkhOutput!, amount);

  return { value: amount, script: p2wpkhOutput!, txId: unspent.txId };
}

async function broadcastAndVerifyTx(
  tx: bitcoin.Transaction,
  address: string,
  value: number,
) {
  await regtestUtils.broadcast(tx.toBuffer().toString('hex'));
  await regtestUtils.verify({
    txId: tx.getId(),
    address: address!,
    vout: 0,
    value,
  });
}

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

function buildPayToSilentAddress(
  prevOutTxId: string,
  witnessUtxo: { value: number; script: Buffer },
  silentPublicKey: Buffer,
  sendAmount: number,
  sharedSecret: Buffer,
) {
  const psbt = new bitcoin.Psbt({ network: regtest });
  psbt.addInput({
    hash: prevOutTxId,
    index: 0,
    witnessUtxo,
  });

  // destination
  const { address } = bitcoin.payments.p2tr({
    internalPubkey: silentPublicKey,
    hash: sharedSecret,
    network: regtest,
  });
  psbt.addOutput({ value: sendAmount, address: address! });

  return { psbt, address };
}

function buildSpendFromSilentAddress(
  prevOutTxId: string,
  witnessUtxo: { value: number; script: Buffer },
  silentPublicKey: Buffer,
  sendAmount: number,
  sharedSecret: Buffer,
) {
  const psbt = new bitcoin.Psbt({ network: regtest });
  psbt.addInput({
    hash: prevOutTxId,
    index: 0,
    witnessUtxo,
    tapInternalKey: silentPublicKey,
    tapMerkleRoot: sharedSecret,
  });

  // random address value, not important
  const address =
    'bcrt1pqknex3jwpsaatu5e5dcjw70nac3fr5k5y3hcxr4hgg6rljzp59nqs6a0vh';
  psbt.addOutput({
    value: sendAmount,
    address,
  });

  return { psbt, address };
}
const toBuffer = (a: Uint8Array) => Buffer.from(a);
