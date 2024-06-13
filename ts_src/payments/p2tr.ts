import { Buffer as NBuffer } from 'buffer';
import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import {
  typeforce as typef,
  isTaptree,
  TAPLEAF_VERSION_MASK,
  stacksEqual,
} from '../types';
import { getEccLib } from '../ecc_lib';
import {
  toHashTree,
  rootHashFromPath,
  findScriptPath,
  tapleafHash,
  tweakKey,
  LEAF_VERSION_TAPSCRIPT,
} from './bip341';
import { Payment, PaymentOpts } from './index';
import * as lazy from './lazy';
import { bech32m } from 'bech32';
import { fromBech32 } from '../address';

const OPS = bscript.OPS;
const TAPROOT_WITNESS_VERSION = 0x01;
const ANNEX_PREFIX = 0x50;

/**
 * Creates a Pay-to-Taproot (P2TR) payment object.
 *
 * @param a - The payment object containing the necessary data for P2TR.
 * @param opts - Optional payment options.
 * @returns The P2TR payment object.
 * @throws {TypeError} If the provided data is invalid or insufficient.
 */
export function p2tr(a: Payment, opts?: PaymentOpts): Payment {
  if (
    !a.address &&
    !a.output &&
    !a.pubkey &&
    !a.internalPubkey &&
    !(a.witness && a.witness.length > 1)
  )
    throw new TypeError('Not enough data');

  opts = Object.assign({ validate: true }, opts || {});

  typef(
    {
      address: typef.maybe(typef.String),
      input: typef.maybe(typef.BufferN(0)),
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.BufferN(34)),
      internalPubkey: typef.maybe(typef.BufferN(32)),
      hash: typef.maybe(typef.BufferN(32)), // merkle root hash, the tweak
      pubkey: typef.maybe(typef.BufferN(32)), // tweaked with `hash` from `internalPubkey`
      signature: typef.maybe(typef.anyOf(typef.BufferN(64), typef.BufferN(65))),
      witness: typef.maybe(typef.arrayOf(typef.Buffer)),
      scriptTree: typef.maybe(isTaptree),
      redeem: typef.maybe({
        output: typef.maybe(typef.Buffer), // tapleaf script
        redeemVersion: typef.maybe(typef.Number), // tapleaf version
        witness: typef.maybe(typef.arrayOf(typef.Buffer)),
      }),
      redeemVersion: typef.maybe(typef.Number),
    },
    a,
  );

  const _address = lazy.value(() => {
    return fromBech32(a.address!);
  });

  // remove annex if present, ignored by taproot
  const _witness = lazy.value(() => {
    if (!a.witness || !a.witness.length) return;
    if (
      a.witness.length >= 2 &&
      a.witness[a.witness.length - 1][0] === ANNEX_PREFIX
    ) {
      return a.witness.slice(0, -1);
    }
    return a.witness.slice();
  });

  const _hashTree = lazy.value(() => {
    if (a.scriptTree) return toHashTree(a.scriptTree);
    if (a.hash) return { hash: a.hash };
    return;
  });

  const network = a.network || BITCOIN_NETWORK;
  const o: Payment = { name: 'p2tr', network };

  lazy.prop(o, 'address', () => {
    if (!o.pubkey) return;

    const words = bech32m.toWords(o.pubkey);
    words.unshift(TAPROOT_WITNESS_VERSION);
    return bech32m.encode(network.bech32, words);
  });

  lazy.prop(o, 'hash', () => {
    const hashTree = _hashTree();
    if (hashTree) return hashTree.hash;
    const w = _witness();
    if (w && w.length > 1) {
      const controlBlock = w[w.length - 1];
      const leafVersion = controlBlock[0] & TAPLEAF_VERSION_MASK;
      const script = w[w.length - 2];
      const leafHash = tapleafHash({ output: script, version: leafVersion });
      return rootHashFromPath(controlBlock, leafHash);
    }
    return null;
  });
  lazy.prop(o, 'output', () => {
    if (!o.pubkey) return;
    return bscript.compile([OPS.OP_1, o.pubkey]);
  });
  lazy.prop(o, 'redeemVersion', () => {
    if (a.redeemVersion) return a.redeemVersion;
    if (
      a.redeem &&
      a.redeem.redeemVersion !== undefined &&
      a.redeem.redeemVersion !== null
    ) {
      return a.redeem.redeemVersion;
    }

    return LEAF_VERSION_TAPSCRIPT;
  });
  lazy.prop(o, 'redeem', () => {
    const witness = _witness(); // witness without annex
    if (!witness || witness.length < 2) return;

    return {
      output: witness[witness.length - 2],
      witness: witness.slice(0, -2),
      redeemVersion: witness[witness.length - 1][0] & TAPLEAF_VERSION_MASK,
    };
  });
  lazy.prop(o, 'pubkey', () => {
    if (a.pubkey) return a.pubkey;
    if (a.output) return a.output.slice(2);
    if (a.address) return _address().data;
    if (o.internalPubkey) {
      const tweakedKey = tweakKey(o.internalPubkey, o.hash);
      if (tweakedKey) return tweakedKey.x;
    }
  });
  lazy.prop(o, 'internalPubkey', () => {
    if (a.internalPubkey) return a.internalPubkey;
    const witness = _witness();
    if (witness && witness.length > 1)
      return witness[witness.length - 1].slice(1, 33);
  });
  lazy.prop(o, 'signature', () => {
    if (a.signature) return a.signature;
    const witness = _witness(); // witness without annex
    if (!witness || witness.length !== 1) return;
    return witness[0];
  });

  lazy.prop(o, 'witness', () => {
    if (a.witness) return a.witness;
    const hashTree = _hashTree();
    if (hashTree && a.redeem && a.redeem.output && a.internalPubkey) {
      const leafHash = tapleafHash({
        output: a.redeem.output,
        version: o.redeemVersion,
      });
      const path = findScriptPath(hashTree, leafHash);
      if (!path) return;
      const outputKey = tweakKey(a.internalPubkey, hashTree.hash);
      if (!outputKey) return;
      const controlBock = NBuffer.concat(
        [
          NBuffer.from([o.redeemVersion! | outputKey.parity]),
          a.internalPubkey,
        ].concat(path),
      );
      return [a.redeem.output, controlBock];
    }
    if (a.signature) return [a.signature];
  });

  // extended validation
  if (opts.validate) {
    let pubkey: Buffer = NBuffer.from([]);
    if (a.address) {
      if (network && network.bech32 !== _address().prefix)
        throw new TypeError('Invalid prefix or Network mismatch');
      if (_address().version !== TAPROOT_WITNESS_VERSION)
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
      const tweakedKey = tweakKey(a.internalPubkey, o.hash);
      if (pubkey.length > 0 && !pubkey.equals(tweakedKey!.x))
        throw new TypeError('Pubkey mismatch');
      else pubkey = tweakedKey!.x;
    }

    if (pubkey && pubkey.length) {
      if (!getEccLib().isXOnlyPoint(pubkey))
        throw new TypeError('Invalid pubkey for p2tr');
    }

    const hashTree = _hashTree();

    if (a.hash && hashTree) {
      if (!a.hash.equals(hashTree.hash)) throw new TypeError('Hash mismatch');
    }

    if (a.redeem && a.redeem.output && hashTree) {
      const leafHash = tapleafHash({
        output: a.redeem.output,
        version: o.redeemVersion,
      });
      if (!findScriptPath(hashTree, leafHash))
        throw new TypeError('Redeem script not in tree');
    }

    const witness = _witness();

    // compare the provided redeem data with the one computed from witness
    if (a.redeem && o.redeem) {
      if (a.redeem.redeemVersion) {
        if (a.redeem.redeemVersion !== o.redeem.redeemVersion)
          throw new TypeError('Redeem.redeemVersion and witness mismatch');
      }

      if (a.redeem.output) {
        if (bscript.decompile(a.redeem.output)!.length === 0)
          throw new TypeError('Redeem.output is invalid');

        // output redeem is constructed from the witness
        if (o.redeem.output && !a.redeem.output.equals(o.redeem.output))
          throw new TypeError('Redeem.output and witness mismatch');
      }
      if (a.redeem.witness) {
        if (
          o.redeem.witness &&
          !stacksEqual(a.redeem.witness, o.redeem.witness)
        )
          throw new TypeError('Redeem.witness and witness mismatch');
      }
    }

    if (witness && witness.length) {
      if (witness.length === 1) {
        // key spending
        if (a.signature && !a.signature.equals(witness[0]))
          throw new TypeError('Signature mismatch');
      } else {
        // script path spending
        const controlBlock = witness[witness.length - 1];
        if (controlBlock.length < 33)
          throw new TypeError(
            `The control-block length is too small. Got ${controlBlock.length}, expected min 33.`,
          );

        if ((controlBlock.length - 33) % 32 !== 0)
          throw new TypeError(
            `The control-block length of ${controlBlock.length} is incorrect!`,
          );

        const m = (controlBlock.length - 33) / 32;
        if (m > 128)
          throw new TypeError(
            `The script path is too long. Got ${m}, expected max 128.`,
          );

        const internalPubkey = controlBlock.slice(1, 33);
        if (a.internalPubkey && !a.internalPubkey.equals(internalPubkey))
          throw new TypeError('Internal pubkey mismatch');

        if (!getEccLib().isXOnlyPoint(internalPubkey))
          throw new TypeError('Invalid internalPubkey for p2tr witness');

        const leafVersion = controlBlock[0] & TAPLEAF_VERSION_MASK;
        const script = witness[witness.length - 2];

        const leafHash = tapleafHash({ output: script, version: leafVersion });
        const hash = rootHashFromPath(controlBlock, leafHash);

        const outputKey = tweakKey(internalPubkey, hash);
        if (!outputKey)
          // todo: needs test data
          throw new TypeError('Invalid outputKey for p2tr witness');

        if (pubkey.length && !pubkey.equals(outputKey.x))
          throw new TypeError('Pubkey mismatch for p2tr witness');

        if (outputKey.parity !== (controlBlock[0] & 1))
          throw new Error('Incorrect parity');
      }
    }
  }

  return Object.assign(o, a);
}
