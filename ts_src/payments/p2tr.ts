import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import { liftX, tweakPublicKey, computeTweakFromScriptPath, typeforce as typef } from '../types';
import { computeMastRoot } from '../merkle';
import { Payment, PaymentOpts } from './index';
import * as lazy from './lazy';
import { bech32m } from 'bech32';
const OPS = bscript.OPS;

const TAPROOT_VERSION = 0x01;
const ANNEX_PREFIX = 0x50;

// witness: {signature}
// input: <>
// output: OP_1 {pubKey}
export function p2tr(a: Payment, opts?: PaymentOpts): Payment {
  if (!a.address && !a.output && !a.pubkey && !a.output && !a.internalPubkey && !(a.witness && a.witness.length > 1))
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

  const _witness = lazy.value(() => {
    if (!a.witness || !a.witness.length) return
    if (a.witness.length >= 2 && (a.witness[a.witness.length - 1][0] === ANNEX_PREFIX)) {
      // remove annex, ignored by taproot
      return a.witness.slice(0, -1);
    }
    return a.witness.slice()
  })

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
    // todo: compute from witness
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
    if (o.internalPubkey) {
      const tweakedKey = tweakPublicKey(o.internalPubkey, o.hash)
      if (tweakedKey) return tweakedKey.x
    }
  });
  lazy.prop(o, 'internalPubkey', () => {
    if (a.internalPubkey) return a.internalPubkey;
    const witness = _witness()
    if (witness && witness.length > 1)
      return witness[witness.length - 1].slice(1, 33);
  });
  lazy.prop(o, 'signature', () => {
    if (a.witness?.length !== 1) return;
    return a.witness[0];
  });
  lazy.prop(o, 'input', () => {
    // todo: not sure
  });
  lazy.prop(o, 'witness', () => {
    if (a.witness) return a.witness
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
        a.output[0] !== OPS.OP_1 ||
        a.output[1] !== 0x20
      )
        throw new TypeError('Output is invalid');
      if (pubkey.length > 0 && !pubkey.equals(a.output.slice(2)))
        throw new TypeError('Pubkey mismatch');
      else pubkey = a.output.slice(2);
    }

    if (a.internalPubkey) {
      const tweakedKey = tweakPublicKey(a.internalPubkey, o.hash)
      if (tweakedKey === null) throw new TypeError('Invalid internalPubkey for p2tr');
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

    // todo: review cache
    const witness = _witness()

    if (witness && witness.length) {
      if (witness.length === 1) {
        // key spending
        if (a.signature && !a.signature.equals(witness[0]))
          throw new TypeError('Signature mismatch');
        // todo: recheck
        // if (!bscript.isSchnorSignature(a.pubkey, a.witness[0]))
        // throw new TypeError('Witness has invalid signature');
      } else {
        // script path spending
        const controlBlock = witness[witness.length - 1];
        if (controlBlock.length < 33)
          throw new TypeError(`The control-block length is too small. Got ${controlBlock.length}, expected min 33.`);

        if ((controlBlock.length - 33) % 32 !== 0)
          throw new TypeError(`The control-block length of ${controlBlock.length} is incorrect!`);

        const m = (controlBlock.length - 33) / 32;
        if (m > 128)
          throw new TypeError(`The script path is too long. Got ${m}, expected max 128.`);

        const internalPubkey = controlBlock.slice(1, 33);
        if (a.internalPubkey && !a.internalPubkey.equals(internalPubkey))
          throw new TypeError('Internal pubkey mismatch');

        const internalPubkeyPoint = liftX(internalPubkey);
        if (!internalPubkeyPoint)
          throw new TypeError('Invalid internalPubkey for p2tr witness');


        const leafVersion = controlBlock[0] & 0b11111110;
        const script = witness[witness.length - 2];
        const tweak = computeTweakFromScriptPath(controlBlock, script, internalPubkey, m, leafVersion)

        const outputKey = tweakPublicKey(internalPubkey, tweak)
        if (!outputKey)
          // todo: needs test data
          throw new TypeError('Invalid outputKey for p2tr witness');

        if (pubkey.length && !pubkey.equals(outputKey.x))
          throw new TypeError('Pubkey mismatch for p2tr witness');

        const controlBlockOddParity = (controlBlock[0] & 1) === 1
        if (outputKey.isOdd !== controlBlockOddParity)
          throw new Error('Incorrect parity')

      }

    }
  }

  return Object.assign(o, a);
}
