// SegWit version 1 P2TR output type for Taproot defined in
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki

import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import * as taproot from '../taproot';
import { Payment, PaymentOpts } from './index';
import * as lazy from './lazy';
const typef = require('typeforce');
const OPS = bscript.OPS;
const ecc = require('tiny-secp256k1');

const { bech32m } = require('bech32');

/**
 * A secp256k1 x coordinate with unknown discrete logarithm used for eliminating
 * keypath spends, equal to SHA256(uncompressedDER(SECP256K1_GENERATOR_POINT)).
 */
const H = Buffer.from(
  '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
  'hex',
);

// output: OP_1 {witnessProgram}
export function p2tr(a: Payment, opts?: PaymentOpts): Payment {
  if (!a.address && !a.pubkey && !a.pubkeys && !a.scripts && !a.output)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  typef(
    {
      network: typef.maybe(typef.Object),

      address: typef.maybe(typef.String),
      // the output script should be a fixed 34 bytes.
      // 1 byte for OP_1 indicating segwit version 1, one byte for 0x20 to push
      // the next 32 bytes, followed by the 32 byte witness program
      output: typef.maybe(typef.BufferN(34)),
      // a single pubkey
      pubkey: typef.maybe(ecc.isPoint),
      // the pub keys used for aggregate musig signing
      pubkeys: typef.maybe(typef.arrayOf(ecc.isPoint)),

      scripts: typef.maybe(typef.arrayOf(typef.Buffer)),
      weights: typef.maybe(typef.arrayOf(typef.Number)),
    },
    a,
  );

  const network = a.network || BITCOIN_NETWORK;

  const o: Payment = { network };

  lazy.prop(o, 'address', () => {
    if (!o.output) return;

    // we remove the first two bytes (OP_1 0x20) from the output script to
    // only encode the 32 byte witness program as bech32m
    const words = bech32m.toWords(o.output.slice(2));
    words.unshift(0x01);
    return bech32m.encode(network.bech32, words);
  });
  lazy.prop(o, 'output', () => {
    let internalPubkey: Buffer;
    if (a.pubkey) {
      // single pubkey
      internalPubkey = a.pubkey;
    } else if (a.pubkeys && a.pubkeys.length) {
      // multiple pubkeys
      internalPubkey = taproot.aggregateMuSigPubkeys(a.pubkeys);
      console.error('internal ' + internalPubkey.toString('hex'));
    } else {
      // no key path
      if (!a.scripts) return; // must have either scripts or pubkey(s)

      // If there is no key path spending condition, we use an internal key with unknown secret key.
      // TODO: In order to avoid leaking the information that key path spending is not possible it
      // is recommended to pick a fresh integer r in the range 0...n-1 uniformly at random and use
      // H + rG as internal key. It is possible to prove that this internal key does not have a
      // known discrete logarithm with respect to G by revealing r to a verifier who can then
      // reconstruct how the internal key was created.
      internalPubkey = H;
    }

    let tapTreeRoot: Buffer | undefined;
    if (a.scripts) {
      tapTreeRoot = taproot.getHuffmanTaptreeRoot(a.scripts, a.weights);
    }
    const taprootPubkey = taproot.tapTweakPubkey(internalPubkey, tapTreeRoot);

    // OP_1 indicates segwit version 1
    return bscript.compile([OPS.OP_1, taprootPubkey]);
  });
  lazy.prop(o, 'name', () => {
    const nameParts = ['p2tr'];
    return nameParts.join('-');
  });

  // extended validation
  if (opts.validate) {
    // TODO: complete extended validation
    if (a.output) {
      if (a.output[0] !== OPS.OP_1 || a.output[1] !== 0x20)
        throw new TypeError('Output is invalid');
    }
  }

  return Object.assign(o, a);
}
