import { describe, it } from 'mocha';
import * as bitcoin from '../..';
import { regtestUtils } from './_regtest';
const NETWORK = regtestUtils.network;
const keyPairs = [
  bitcoin.ECPair.makeRandom({ network: NETWORK }),
  bitcoin.ECPair.makeRandom({ network: NETWORK }),
];
console.warn = () => {}; // Silence the Deprecation Warning

async function buildAndSign(
  depends: any,
  prevOutput: any,
  redeemScript: any,
  witnessScript: any,
) {
  const unspent = await regtestUtils.faucetComplex(prevOutput, 5e4);

  const txb = new bitcoin.TransactionBuilder(NETWORK);
  txb.addInput(unspent.txId, unspent.vout, undefined, prevOutput);
  txb.addOutput(regtestUtils.RANDOM_ADDRESS, 2e4);

  const posType = depends.prevOutScriptType;
  const needsValue = !!witnessScript || posType.slice(-6) === 'p2wpkh';

  if (depends.signatures) {
    keyPairs.forEach(keyPair => {
      txb.sign({
        prevOutScriptType: posType,
        vin: 0,
        keyPair,
        redeemScript,
        witnessValue: needsValue ? unspent.value : undefined,
        witnessScript,
      });
    });
  } else if (depends.signature) {
    txb.sign({
      prevOutScriptType: posType,
      vin: 0,
      keyPair: keyPairs[0],
      redeemScript,
      witnessValue: needsValue ? unspent.value : undefined,
      witnessScript,
    });
  }

  return regtestUtils.broadcast(txb.build().toHex());
}

['p2ms', 'p2pk', 'p2pkh', 'p2wpkh'].forEach(k => {
  const fixtures = require('../fixtures/' + k);
  const { depends } = fixtures.dynamic;
  const fn: any = (bitcoin.payments as any)[k];

  const base: any = {};
  if (depends.pubkey) base.pubkey = keyPairs[0].publicKey;
  if (depends.pubkeys) base.pubkeys = keyPairs.map(x => x.publicKey);
  if (depends.m) base.m = base.pubkeys.length;

  const { output } = fn(base);
  if (!output) throw new TypeError('Missing output');

  describe('bitcoinjs-lib (payments - ' + k + ')', () => {
    it('can broadcast as an output, and be spent as an input', async () => {
      Object.assign(depends, { prevOutScriptType: k });
      await buildAndSign(depends, output, undefined, undefined);
    });

    it(
      'can (as P2SH(' +
        k +
        ')) broadcast as an output, and be spent as an input',
      async () => {
        const p2sh = bitcoin.payments.p2sh({
          redeem: { output },
          network: NETWORK,
        });
        Object.assign(depends, { prevOutScriptType: 'p2sh-' + k });
        await buildAndSign(
          depends,
          p2sh.output,
          p2sh.redeem!.output,
          undefined,
        );
      },
    );

    // NOTE: P2WPKH cannot be wrapped in P2WSH, consensus fail
    if (k === 'p2wpkh') return;

    it(
      'can (as P2WSH(' +
        k +
        ')) broadcast as an output, and be spent as an input',
      async () => {
        const p2wsh = bitcoin.payments.p2wsh({
          redeem: { output },
          network: NETWORK,
        });
        Object.assign(depends, { prevOutScriptType: 'p2wsh-' + k });
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
        k +
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

        Object.assign(depends, { prevOutScriptType: 'p2sh-p2wsh-' + k });
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
