import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { describe, it } from 'mocha';
import * as bitcoin from 'bitcoinjs-lib';
import { regtestUtils } from './_regtest.js';
import { randomBytes } from 'crypto';

import p2msFixtures from '../fixtures/p2ms.json';
import p2pkFixtures from '../fixtures/p2pk.json';
import p2pkhFixtures from '../fixtures/p2pkh.json';
import p2wpkhFixtures from '../fixtures/p2wpkh.json';

const rng = (size: number) => randomBytes(size);

const testSuite = [
  {
    paymentName: 'p2ms',
    fixtures: p2msFixtures,
  },
  {
    paymentName: 'p2pk',
    fixtures: p2pkFixtures,
  },
  {
    paymentName: 'p2pkh',
    fixtures: p2pkhFixtures,
  },
  {
    paymentName: 'p2wpkh',
    fixtures: p2wpkhFixtures,
  },
];

const ECPair = ECPairFactory(ecc);
const NETWORK = regtestUtils.network;
const keyPairs = [
  ECPair.makeRandom({ network: NETWORK, rng }),
  ECPair.makeRandom({ network: NETWORK, rng }),
];

async function buildAndSign(
  depends: any,
  prevOutput: any,
  redeemScript: any,
  witnessScript: any,
): Promise<null> {
  const unspent = await regtestUtils.faucetComplex(
    Buffer.from(prevOutput),
    5e4,
  );
  const utx = await regtestUtils.fetch(unspent.txId);

  const psbt = new bitcoin.Psbt({ network: NETWORK })
    .addInput({
      hash: unspent.txId,
      index: unspent.vout,
      nonWitnessUtxo: Buffer.from(utx.txHex, 'hex'),
      ...(redeemScript ? { redeemScript } : {}),
      ...(witnessScript ? { witnessScript } : {}),
    })
    .addOutput({
      address: regtestUtils.RANDOM_ADDRESS,
      value: BigInt(2e4),
    });

  if (depends.signatures) {
    keyPairs.forEach(keyPair => {
      psbt.signInput(0, keyPair);
    });
  } else if (depends.signature) {
    psbt.signInput(0, keyPairs[0]);
  }

  return regtestUtils.broadcast(
    psbt.finalizeAllInputs().extractTransaction().toHex(),
  );
}

testSuite.forEach(t => {
  const fixtures = t.fixtures;
  const { depends } = fixtures.dynamic;
  const fn: any = (bitcoin.payments as any)[t.paymentName];

  const base: any = {};
  if (depends.pubkey) base.pubkey = keyPairs[0].publicKey;
  if (depends.pubkeys) base.pubkeys = keyPairs.map(x => x.publicKey);
  if (depends.m) base.m = base.pubkeys.length;

  const { output } = fn(base);
  if (!output) throw new TypeError('Missing output');

  describe('bitcoinjs-lib (payments - ' + t.paymentName + ')', () => {
    it('can broadcast as an output, and be spent as an input', async () => {
      Object.assign(depends, { prevOutScriptType: t.paymentName });
      await buildAndSign(depends, output, undefined, undefined);
    });

    it(
      'can (as P2SH(' +
        t.paymentName +
        ')) broadcast as an output, and be spent as an input',
      async () => {
        const p2sh = bitcoin.payments.p2sh({
          redeem: { output },
          network: NETWORK,
        });
        Object.assign(depends, { prevOutScriptType: 'p2sh-' + t.paymentName });
        await buildAndSign(
          depends,
          p2sh.output,
          p2sh.redeem!.output,
          undefined,
        );
      },
    );

    // NOTE: P2WPKH cannot be wrapped in P2WSH, consensus fail
    if (t.paymentName === 'p2wpkh') return;

    it(
      'can (as P2WSH(' +
        t.paymentName +
        ')) broadcast as an output, and be spent as an input',
      async () => {
        const p2wsh = bitcoin.payments.p2wsh({
          redeem: { output },
          network: NETWORK,
        });
        Object.assign(depends, { prevOutScriptType: 'p2wsh-' + t.paymentName });
        await buildAndSign(
          depends,
          p2wsh.output,
          undefined,
          p2wsh.redeem!.output,
        );
      },
    );

    it(
      'can (as P2SH(P2WSH(' +
        t.paymentName +
        '))) broadcast as an output, and be spent as an input',
      async () => {
        const p2wsh = bitcoin.payments.p2wsh({
          redeem: { output },
          network: NETWORK,
        });
        const p2sh = bitcoin.payments.p2sh({
          redeem: { output: p2wsh.output },
          network: NETWORK,
        });

        Object.assign(depends, {
          prevOutScriptType: 'p2sh-p2wsh-' + t.paymentName,
        });
        await buildAndSign(
          depends,
          p2sh.output,
          p2sh.redeem!.output,
          p2wsh.redeem!.output,
        );
      },
    );
  });
});
