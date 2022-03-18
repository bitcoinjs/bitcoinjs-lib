import { Buffer as NBuffer } from 'buffer';
import * as bcrypto from '../crypto';

import { varuint } from '../bufferutils';
import { Tapleaf, Taptree, isTapleaf } from '../types';

const TAP_LEAF_TAG = 'TapLeaf';
const TAP_BRANCH_TAG = 'TapBranch';
const TAP_TWEAK_TAG = 'TapTweak';

export const LEAF_VERSION_TAPSCRIPT = 0xc0;

export function rootHashFromPath(
  controlBlock: Buffer,
  tapLeafMsg: Buffer,
): Buffer {
  const k = [tapLeafMsg];
  const e = [];

  const m = (controlBlock.length - 33) / 32;

  for (let j = 0; j < m; j++) {
    e[j] = controlBlock.slice(33 + 32 * j, 65 + 32 * j);
    if (k[j].compare(e[j]) < 0) {
      k[j + 1] = tapBranchHash(k[j], e[j]);
    } else {
      k[j + 1] = tapBranchHash(e[j], k[j]);
    }
  }

  return k[m];
}

export interface HashTree {
  hash: Buffer;
  left?: HashTree;
  right?: HashTree;
}

/**
 * Build the hash tree from the scripts binary tree.
 * The binary tree can be balanced or not.
 * @param scriptTree - is a list representing a binary tree where an element can be:
 *  - a taproot leaf [(output, version)], or
 *  - a pair of two taproot leafs [(output, version), (output, version)], or
 *  - one taproot leaf and a list of elements
 */
export function toHashTree(scriptTree: Taptree): HashTree {
  if (isTapleaf(scriptTree)) return { hash: tapLeafHash(scriptTree) };

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
 * Given a MAST tree, it finds the path of a particular hash.
 * @param node - the root of the tree
 * @param hash - the hash to search for
 * @returns - and array of hashes representing the path, or an empty array if no pat is found
 */
export function findScriptPath(node: HashTree, hash: Buffer): Buffer[] {
  if (node.left) {
    if (node.left.hash.equals(hash)) return node.right ? [node.right.hash] : [];
    const leftPath = findScriptPath(node.left, hash);
    if (leftPath.length)
      return node.right ? [node.right.hash].concat(leftPath) : leftPath;
  }

  if (node.right) {
    if (node.right.hash.equals(hash)) return node.left ? [node.left.hash] : [];
    const rightPath = findScriptPath(node.right, hash);
    if (rightPath.length)
      return node.left ? [node.left.hash].concat(rightPath) : rightPath;
  }

  return [];
}

export function tapLeafHash(leaf: Tapleaf): Buffer {
  const version = leaf.version || LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    TAP_LEAF_TAG,
    NBuffer.concat([NBuffer.from([version]), serializeScript(leaf.output)]),
  );
}

export function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return bcrypto.taggedHash(
    TAP_TWEAK_TAG,
    NBuffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}

function tapBranchHash(a: Buffer, b: Buffer): Buffer {
  return bcrypto.taggedHash(TAP_BRANCH_TAG, NBuffer.concat([a, b]));
}

function serializeScript(s: Buffer): Buffer {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = NBuffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return NBuffer.concat([buffer, s]);
}
