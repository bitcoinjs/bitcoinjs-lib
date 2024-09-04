import { Buffer as NBuffer } from 'buffer';
import { getEccLib } from '../ecc_lib';
import * as bcrypto from '../crypto';

import { varuint } from '../bufferutils';
import { Tapleaf, Taptree, isTapleaf } from '../types';

export const LEAF_VERSION_TAPSCRIPT = 0xc0;
export const MAX_TAPTREE_DEPTH = 128;

interface HashLeaf {
  hash: Buffer;
}

interface HashBranch {
  hash: Buffer;
  left: HashTree;
  right: HashTree;
}

interface TweakedPublicKey {
  parity: number;
  x: Buffer;
}

const isHashBranch = (ht: HashTree): ht is HashBranch =>
  'left' in ht && 'right' in ht;

/**
 * Binary tree representing leaf, branch, and root node hashes of a Taptree.
 * Each node contains a hash, and potentially left and right branch hashes.
 * This tree is used for 2 purposes: Providing the root hash for tweaking,
 * and calculating merkle inclusion proofs when constructing a control block.
 */
export type HashTree = HashLeaf | HashBranch;

/**
 * Calculates the root hash from a given control block and leaf hash.
 * @param controlBlock - The control block buffer.
 * @param leafHash - The leaf hash buffer.
 * @returns The root hash buffer.
 * @throws {TypeError} If the control block length is less than 33.
 */
export function rootHashFromPath(
  controlBlock: Buffer,
  leafHash: Buffer,
): Buffer {
  if (controlBlock.length < 33)
    throw new TypeError(
      `The control-block length is too small. Got ${controlBlock.length}, expected min 33.`,
    );
  const m = (controlBlock.length - 33) / 32;

  let kj = leafHash;
  for (let j = 0; j < m; j++) {
    const ej = controlBlock.slice(33 + 32 * j, 65 + 32 * j);
    if (kj.compare(ej) < 0) {
      kj = tapBranchHash(kj, ej);
    } else {
      kj = tapBranchHash(ej, kj);
    }
  }

  return kj;
}

/**
 * Build a hash tree of merkle nodes from the scripts binary tree.
 * @param scriptTree - the tree of scripts to pairwise hash.
 */
export function toHashTree(scriptTree: Taptree): HashTree {
  if (isTapleaf(scriptTree)) return { hash: tapleafHash(scriptTree) };

  const hashes = [toHashTree(scriptTree[0]), toHashTree(scriptTree[1])];
  hashes.sort((a, b) => a.hash.compare(b.hash));
  const [left, right] = hashes;

  return {
    hash: tapBranchHash(left.hash, right.hash),
    left,
    right,
  };
}

/**
 * Calculates the Merkle root from an array of Taproot leaf hashes.
 *
 * @param {Buffer[]} leafHashes - Array of Taproot leaf hashes.
 * @returns {Buffer} - The Merkle root.
 */
export function calculateScriptTreeMerkleRoot(
  leafHashes: Buffer[],
): Buffer | undefined {
  if (!leafHashes || leafHashes.length === 0) {
    return undefined;
  }

  // sort the leaf nodes
  leafHashes.sort(Buffer.compare);

  // create the initial hash node
  let currentLevel = leafHashes;

  // build Merkle Tree
  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      nextLevel.push(
        i + 1 < currentLevel.length ? tapBranchHash(left, right) : left,
      );
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Given a HashTree, finds the path from a particular hash to the root.
 * @param node - the root of the tree
 * @param hash - the hash to search for
 * @returns - array of sibling hashes, from leaf (inclusive) to root
 * (exclusive) needed to prove inclusion of the specified hash. undefined if no
 * path is found
 */
export function findScriptPath(
  node: HashTree,
  hash: Buffer,
): Buffer[] | undefined {
  if (isHashBranch(node)) {
    const leftPath = findScriptPath(node.left, hash);
    if (leftPath !== undefined) return [...leftPath, node.right.hash];

    const rightPath = findScriptPath(node.right, hash);
    if (rightPath !== undefined) return [...rightPath, node.left.hash];
  } else if (node.hash.equals(hash)) {
    return [];
  }

  return undefined;
}

/**
 * Calculates the tapleaf hash for a given Tapleaf object.
 * @param leaf - The Tapleaf object to calculate the hash for.
 * @returns The tapleaf hash as a Buffer.
 */
export function tapleafHash(leaf: Tapleaf): Buffer {
  const version = leaf.version || LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    'TapLeaf',
    NBuffer.concat([NBuffer.from([version]), serializeScript(leaf.output)]),
  );
}

/**
 * Computes the taproot tweak hash for a given public key and optional hash.
 * If a hash is provided, the public key and hash are concatenated before computing the hash.
 * If no hash is provided, only the public key is used to compute the hash.
 *
 * @param pubKey - The public key buffer.
 * @param h - The optional hash buffer.
 * @returns The taproot tweak hash.
 */
export function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return bcrypto.taggedHash(
    'TapTweak',
    NBuffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}

/**
 * Tweak a public key with a given tweak hash.
 * @param pubKey - The public key to be tweaked.
 * @param h - The tweak hash.
 * @returns The tweaked public key or null if the input is invalid.
 */
export function tweakKey(
  pubKey: Buffer,
  h: Buffer | undefined,
): TweakedPublicKey | null {
  if (!NBuffer.isBuffer(pubKey)) return null;
  if (pubKey.length !== 32) return null;
  if (h && h.length !== 32) return null;

  const tweakHash = tapTweakHash(pubKey, h);

  const res = getEccLib().xOnlyPointAddTweak(pubKey, tweakHash);
  if (!res || res.xOnlyPubkey === null) return null;

  return {
    parity: res.parity,
    x: NBuffer.from(res.xOnlyPubkey),
  };
}

/**
 * Computes the TapBranch hash by concatenating two buffers and applying the 'TapBranch' tagged hash algorithm.
 *
 * @param a - The first buffer.
 * @param b - The second buffer.
 * @returns The TapBranch hash of the concatenated buffers.
 */
function tapBranchHash(a: Buffer, b: Buffer): Buffer {
  return bcrypto.taggedHash('TapBranch', NBuffer.concat([a, b]));
}

/**
 * Serializes a script by encoding its length as a varint and concatenating it with the script.
 *
 * @param s - The script to be serialized.
 * @returns The serialized script as a Buffer.
 */
function serializeScript(s: Buffer): Buffer {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = NBuffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return NBuffer.concat([buffer, s]);
}
