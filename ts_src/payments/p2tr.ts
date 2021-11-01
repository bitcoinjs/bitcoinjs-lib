import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import { liftX, tweakPublicKey, typeforce as typef } from '../types';
import { computeMastRoot } from '../merkle';
import { Payment, PaymentOpts } from './index';
import * as lazy from './lazy';
import { bech32m } from 'bech32';
const OPS = bscript.OPS;

const TAPROOT_VERSION = 0x01;

// witness: {signature}
// input: <>
// output: OP_1 {pubKey}
export function p2tr(a: Payment, opts?: PaymentOpts): Payment {
  if (!a.address && !a.output && !a.pubkey && !a.output && !a.internalPubkey)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  typef(
    {
      address: typef.maybe(typef.String),
      input: typef.maybe(typef.BufferN(0)),
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.BufferN(34)),
      internalPubkey: typef.maybe(typef.BufferN(32)),
      hash: typef.maybe(typef.BufferN(32)),
      pubkey: typef.maybe(typef.BufferN(32)),
      signature: typef.maybe(bscript.isCanonicalScriptSignature),
      witness: typef.maybe(typef.arrayOf(typef.Buffer)),
      // scriptsTree: typef.maybe(typef.TaprootNode), // use merkel.isMast ?
    },
    a,
  );

  const _address = lazy.value(() => {
    const result = bech32m.decode(a.address!);
    const version = result.words.shift();
    const data = bech32m.fromWords(result.words);
    return {
      version,
      prefix: result.prefix,
      data: Buffer.from(data),
    };
  });

  // todo: clean-up withness (annex), etc

  const network = a.network || BITCOIN_NETWORK;
  const o: Payment = { name: 'p2tr', network };

  lazy.prop(o, 'address', () => {
    if (!o.pubkey) return;

    const words = bech32m.toWords(o.pubkey);
    words.unshift(TAPROOT_VERSION);
    return bech32m.encode(network.bech32, words);
  });


  lazy.prop(o, 'hash', () => {
    if (a.hash) return a.hash;
    if (a.scriptsTree) return computeMastRoot(a.scriptsTree)
    return null
  });
  lazy.prop(o, 'output', () => {
    if (!o.pubkey) return;
    return bscript.compile([OPS.OP_1, o.pubkey]);
  });
  lazy.prop(o, 'pubkey', () => {
    if (a.pubkey) return a.pubkey;
    if (a.output) return a.output.slice(2)
    if (a.address) return _address().data;
    if (a.internalPubkey) {
      const tweakedKey = tweakPublicKey(a.internalPubkey, o.hash)
      if (tweakedKey) return tweakedKey.x
    }
  });
  lazy.prop(o, 'signature', () => {
    if (a.witness?.length !== 1) return;
    return a.witness[0];
  });
  lazy.prop(o, 'input', () => {
    // todo: not sure
  });
  lazy.prop(o, 'witness', () => {
    if (!a.signature) return;
    return [a.signature];
  });

  // extended validation
  if (opts.validate) {
    let pubkey: Buffer = Buffer.from([]);
    if (a.address) {
      if (network && network.bech32 !== _address().prefix)
        throw new TypeError('Invalid prefix or Network mismatch');
      if (_address().version !== TAPROOT_VERSION)
        throw new TypeError('Invalid address version');
      if (_address().data.length !== 32)
        throw new TypeError('Invalid address data');
        pubkey = _address().data;
    }

    if (a.pubkey) {
      if (pubkey.length > 0 && !pubkey.equals(a.pubkey))
        throw new TypeError('Pubkey mismatch');
      else pubkey = a.pubkey;
    }

    if (a.output) {
      if (
        a.output.length !== 34 ||
        a.output[0] !== OPS.OP_1  ||
        a.output[1] !== 0x20
      )
        throw new TypeError('Output is invalid');
      if (pubkey.length > 0 && !pubkey.equals(a.output.slice(2)))
        throw new TypeError('Pubkey mismatch');
      else pubkey = a.output.slice(2);
    }

    // todo: optimze o.hash?
    if (a.internalPubkey) {
      const tweakedKey = tweakPublicKey(a.internalPubkey, o.hash)
      if (tweakedKey === null)  throw new TypeError('Invalid internalPubkey for p2tr');
      if (pubkey.length > 0 && !pubkey.equals(tweakedKey.x))
        throw new TypeError('Pubkey mismatch');
      else pubkey = tweakedKey.x;
    }

    if (pubkey?.length) {
      if (liftX(pubkey) === null)
        throw new TypeError('Invalid pubkey for p2tr');
    }

    if (a.hash && a.scriptsTree) {
      const hash = computeMastRoot(a.scriptsTree)
      if (!a.hash.equals(hash))
        throw new TypeError('Hash mismatch');
    }

    if (a.witness) {
      if (a.witness.length !== 1) throw new TypeError('Witness is invalid');

      // todo: recheck
      // if (!bscript.isCanonicalScriptSignature(a.witness[0]))
        // throw new TypeError('Witness has invalid signature');

      if (a.signature && !a.signature.equals(a.witness[0]))
        throw new TypeError('Signature mismatch');
    }
  }

  return Object.assign(o, a);
}
