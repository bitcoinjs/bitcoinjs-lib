'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bitcoin = require('../..');
const _regtest_1 = require('./_regtest');
const regtestUtils = require('./_regtest');
const { describe, it } = require('mocha');
const keyPairs = [
  bitcoin.ECPair.makeRandom({ network: _regtest_1.network }),
  bitcoin.ECPair.makeRandom({ network: _regtest_1.network }),
];
async function buildAndSign(depends, prevOutput, redeemScript, witnessScript) {
  const unspent = await regtestUtils.faucetComplex(prevOutput, 5e4);
  const txb = new bitcoin.TransactionBuilder(_regtest_1.network);
  txb.addInput(unspent.txId, unspent.vout, null, prevOutput);
  txb.addOutput(regtestUtils.RANDOM_ADDRESS, 2e4);
  if (depends.signatures) {
    keyPairs.forEach(keyPair => {
      txb.sign(0, keyPair, redeemScript, null, unspent.value, witnessScript);
    });
  } else if (depends.signature) {
    txb.sign(0, keyPairs[0], redeemScript, null, unspent.value, witnessScript);
  }
  return regtestUtils.broadcast(txb.build().toHex());
}
['p2ms', 'p2pk', 'p2pkh', 'p2wpkh'].forEach(k => {
  const fixtures = require('../../ts_test/fixtures/' + k);
  const { depends } = fixtures.dynamic;
  const fn = bitcoin.payments[k];
  const base = {};
  if (depends.pubkey) base.pubkey = keyPairs[0].publicKey;
  if (depends.pubkeys) base.pubkeys = keyPairs.map(x => x.publicKey);
  if (depends.m) base.m = base.pubkeys.length;
  const { output } = fn(base);
  if (!output) throw new TypeError('Missing output');
  describe('bitcoinjs-lib (payments - ' + k + ')', () => {
    // @ts-ignore
    it('can broadcast as an output, and be spent as an input', async () => {
      await buildAndSign(depends, output, null, null);
    });
    it(
      'can (as P2SH(' +
        k +
        ')) broadcast as an output, and be spent as an input',
      // @ts-ignore
      async () => {
        const p2sh = bitcoin.payments.p2sh({
          redeem: { output },
          network: _regtest_1.network,
        });
        await buildAndSign(depends, p2sh.output, p2sh.redeem.output, null);
      },
    );
    // NOTE: P2WPKH cannot be wrapped in P2WSH, consensus fail
    if (k === 'p2wpkh') return;
    it(
      'can (as P2WSH(' +
        k +
        ')) broadcast as an output, and be spent as an input',
      // @ts-ignore
      async () => {
        const p2wsh = bitcoin.payments.p2wsh({
          redeem: { output },
          network: _regtest_1.network,
        });
        await buildAndSign(depends, p2wsh.output, null, p2wsh.redeem.output);
      },
    );
    it(
      'can (as P2SH(P2WSH(' +
        k +
        '))) broadcast as an output, and be spent as an input',
      // @ts-ignore
      async () => {
        const p2wsh = bitcoin.payments.p2wsh({
          redeem: { output },
          network: _regtest_1.network,
        });
        const p2sh = bitcoin.payments.p2sh({
          redeem: { output: p2wsh.output },
          network: _regtest_1.network,
        });
        await buildAndSign(
          depends,
          p2sh.output,
          p2sh.redeem.output,
          p2wsh.redeem.output,
        );
      },
    );
  });
});
