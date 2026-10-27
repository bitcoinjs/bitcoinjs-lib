import { bitcoin as BITCOIN_NETWORK } from '../networks.js';
import * as bscript from '../script.js';
import {
  isTaptree,
  TAPLEAF_VERSION_MASK,
  stacksEqual,
  NBufferSchemaFactory,
  BufferSchema,
} from '../types.js';
import {
  toHashTree,
  rootHashFromP2MRPath,
  findScriptPath,
  tapleafHash,
  LEAF_VERSION_TAPSCRIPT,
} from './bip341.js';
import { Payment, PaymentOpts } from './index.js';
import * as lazy from './lazy.js';
import { bech32m } from 'bech32';
import { fromBech32 } from '../address.js';
import * as tools from 'uint8array-tools';
import * as v from 'valibot';

const OPS = bscript.OPS;
const P2MR_WITNESS_VERSION = 0x02;
const ANNEX_PREFIX = 0x50;

/**
 * Creates a Pay-to-Merkle-Root (P2MR) payment object (BIP 360).
 *
 * P2MR is a SegWit version 2 output type that commits directly to the
 * Merkle root of a script tree without an internal public key.
 * It supports only script-path spending (no key-path spend),
 * providing resistance to long exposure quantum attacks.
 *
 * @param a - The payment object containing the necessary data for P2MR.
 * @param opts - Optional payment options.
 * @returns The P2MR payment object.
 * @throws {TypeError} If the provided data is invalid or insufficient.
 */
export function p2mr(a: Payment, opts?: PaymentOpts): Payment {
  if (
    !a.address &&
    !a.output &&
    !a.hash &&
    !a.scriptTree &&
    !(a.witness && a.witness.length > 1)
  )
    throw new TypeError('Not enough data');

  opts = Object.assign({ validate: true }, opts || {});

  v.parse(
    v.partial(
      v.object({
        address: v.string(),
        input: NBufferSchemaFactory(0),
        network: v.object({}),
        output: NBufferSchemaFactory(34),
        hash: NBufferSchemaFactory(32), // merkle root of the script tree
        witness: v.array(BufferSchema),
        scriptTree: v.custom(isTaptree, 'Taptree is not of type isTaptree'),
        redeem: v.partial(
          v.object({
            output: BufferSchema, // tapleaf script
            redeemVersion: v.number(), // tapleaf version
            witness: v.array(BufferSchema),
          }),
        ),
        redeemVersion: v.number(),
      }),
    ),
    a,
  );

  const _address = lazy.value(() => {
    return fromBech32(a.address!);
  });

  // remove annex if present, ignored by taproot/P2MR
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
  const o: Payment = { name: 'p2mr', network };

  lazy.prop(o, 'address', () => {
    if (!o.hash) return;

    const words = bech32m.toWords(o.hash);
    words.unshift(P2MR_WITNESS_VERSION);
    return bech32m.encode(network.bech32, words);
  });

  lazy.prop(o, 'hash', () => {
    const hashTree = _hashTree();
    if (hashTree) return hashTree.hash;
    if (a.output) return a.output.slice(2);
    if (a.address) return _address().data;
    const w = _witness();
    if (w && w.length > 1) {
      const controlBlock = w[w.length - 1];
      const leafVersion = controlBlock[0] & TAPLEAF_VERSION_MASK;
      const script = w[w.length - 2];
      const leafHash = tapleafHash({ output: script, version: leafVersion });
      return rootHashFromP2MRPath(controlBlock, leafHash);
    }
    return null;
  });

  lazy.prop(o, 'output', () => {
    if (!o.hash) return;
    // P2MR scriptPubKey: OP_2 OP_PUSHBYTES_32 <32-byte merkle_root>
    return bscript.compile([OPS.OP_2, o.hash]);
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

  lazy.prop(o, 'witness', () => {
    if (a.witness) return a.witness;
    const hashTree = _hashTree();
    if (hashTree && a.redeem && a.redeem.output) {
      const leafHash = tapleafHash({
        output: a.redeem.output,
        version: o.redeemVersion,
      });
      const path = findScriptPath(hashTree, leafHash);
      if (!path) return;
      // P2MR control block: [control_byte] [32*m byte merkle_path]
      // No internal pubkey (unlike P2TR).
      // Parity bit is always 1 for P2MR.
      const controlBlock = tools.concat(
        [Uint8Array.from([o.redeemVersion! | 1])].concat(path),
      );
      return [a.redeem.output, controlBlock];
    }
  });

  // extended validation
  if (opts.validate) {
    let hash: Uint8Array = Uint8Array.from([]);

    if (a.address) {
      if (network && network.bech32 !== _address().prefix)
        throw new TypeError('Invalid prefix or Network mismatch');
      if (_address().version !== P2MR_WITNESS_VERSION)
        throw new TypeError('Invalid address version');
      if (_address().data.length !== 32)
        throw new TypeError('Invalid address data');
      hash = _address().data;
    }

    if (a.hash) {
      if (hash.length > 0 && tools.compare(hash, a.hash) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = a.hash;
    }

    if (a.output) {
      if (
        a.output.length !== 34 ||
        a.output[0] !== OPS.OP_2 ||
        a.output[1] !== 0x20
      )
        throw new TypeError('Output is invalid');
      if (hash.length > 0 && tools.compare(hash, a.output.slice(2)) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = a.output.slice(2);
    }

    const hashTree = _hashTree();

    if (a.hash && hashTree) {
      if (tools.compare(a.hash, hashTree.hash) !== 0)
        throw new TypeError('Hash mismatch');
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
        if (
          o.redeem.output &&
          tools.compare(a.redeem.output, o.redeem.output) !== 0
        )
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
      // P2MR only supports script-path spending (no key-path)
      if (witness.length < 2) {
        throw new TypeError(
          'P2MR does not support key-path spending. Witness must have at least 2 elements.',
        );
      }

      // Script-path spending validation
      const controlBlock = witness[witness.length - 1];
      if (controlBlock.length < 1)
        throw new TypeError(
          `The control-block length is too small. Got ${controlBlock.length}, expected min 1.`,
        );

      if ((controlBlock.length - 1) % 32 !== 0)
        throw new TypeError(
          `The control-block length of ${controlBlock.length} is incorrect!`,
        );

      const m = (controlBlock.length - 1) / 32;
      if (m > 128)
        throw new TypeError(
          `The script path is too long. Got ${m}, expected max 128.`,
        );

      // P2MR parity bit must always be 1
      if ((controlBlock[0] & 1) !== 1)
        throw new TypeError('P2MR control block parity bit must be 1');

      const leafVersion = controlBlock[0] & TAPLEAF_VERSION_MASK;
      const script = witness[witness.length - 2];

      const leafHash = tapleafHash({ output: script, version: leafVersion });
      const rootHash = rootHashFromP2MRPath(controlBlock, leafHash);

      if (hash.length && tools.compare(hash, rootHash) !== 0)
        throw new TypeError('Hash mismatch for p2mr witness');
    }
  }

  return Object.assign(o, a);
}
