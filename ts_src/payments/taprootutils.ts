import { Buffer as NBuffer } from 'buffer';
import * as bcrypto from '../crypto';

import { varuint } from '../bufferutils';
import { TaprootLeaf } from '../types';

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
export function toHashTree(scriptTree: TaprootLeaf[]): HashTree {
  if (scriptTree.length === 1) {
    const script = scriptTree[0];
    if (Array.isArray(script)) {
      return toHashTree(script);
    }
    script.version = script.version || LEAF_VERSION_TAPSCRIPT;
    if ((script.version & 1) !== 0)
      throw new TypeError('Invalid script version');

    return {
      hash: tapLeafHash(script.output, script.version),
    };
  }

  let left = toHashTree([scriptTree[0]]);
  let right = toHashTree([scriptTree[1]]);

  if (left.hash.compare(right.hash) === 1) [left, right] = [right, left];
  return {
    hash: tapBranchHash(left.hash, right.hash),
    left,
    right,
  };
}
/**
 * Check if the tree is a binary tree with leafs of type TaprootLeaf
 */
export function isTapTree(scriptTree: TaprootLeaf[]): boolean {
  if (scriptTree.length > 2) return false;
  if (scriptTree.length === 1) {
    const script = scriptTree[0];
    if (Array.isArray(script)) {
      return isTapTree(script);
    }
    if (!script.output) return false;
    script.version = script.version || LEAF_VERSION_TAPSCRIPT;
    if ((script.version & 1) !== 0) return false;

    return true;
  }

  if (!isTapTree([scriptTree[0]])) return false;
  if (!isTapTree([scriptTree[1]])) return false;

  return true;
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

export function tapLeafHash(script: Buffer, version?: number): Buffer {
  version = version || LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    TAP_LEAF_TAG,
    NBuffer.concat([NBuffer.from([version]), serializeScript(script)]),
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
