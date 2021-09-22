import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import * as taproot from '../taproot';
import { Payment, PaymentOpts } from './index';
import * as lazy from './lazy';
const typef = require('typeforce');
const OPS = bscript.OPS;
const ecc = require('tiny-secp256k1');

const { bech32m } = require('bech32');

/** Internal key with unknown discrete logarithm for eliminating keypath spends */
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

    const words = bech32m.toWords(o.output.slice(2));
    words.unshift(0x01);
    return bech32m.encode(network.bech32, words);
  });
  lazy.prop(o, 'output', () => {
    let internalPubkey: Buffer;
    if (a.pubkey) {
      // single pubkey
      // internalPubkey = taproot.trimFirstByte(a.pubkey);
      internalPubkey = a.pubkey;
    } else if (a.pubkeys && a.pubkeys.length) {
      // multiple pubkeys
      internalPubkey = taproot.aggregateMuSigPubkeys(a.pubkeys);
    } else {
      // no key path spends
      if (!a.scripts) return; // must have either scripts or pubkey(s)

      // use internal key with unknown secret key
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

  return Object.assign(o, a);
}
