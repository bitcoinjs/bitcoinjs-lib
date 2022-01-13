import { Buffer as NBuffer } from 'buffer';
import * as bcrypto from '../crypto';

import { varuint } from '../bufferutils';
import { TaprootLeaf } from '../types';

const LEAF_VERSION_TAPSCRIPT = 0xc0;
const TAP_LEAF_TAG = 'TapLeaf';
const TAP_BRANCH_TAG = 'TapBranch';
const TAP_TWEAK_TAG = 'TapTweak';

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
 * @param scriptsTree - is a list representing a binary tree where an element can be:
 *  - a taproot leaf [(output, version)], or
 *  - a pair of two taproot leafs [(output, version), (output, version)], or
 *  - one taproot leaf and a list of elements
 */
export function toHashTree(scriptsTree: TaprootLeaf[]): HashTree {
  if (scriptsTree.length === 1) {
    const script = scriptsTree[0];
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

  const left = toHashTree([scriptsTree[0]]);
  const right = toHashTree([scriptsTree[1]]);

  let leftHash = left.hash;
  let rightHash = right.hash;

  if (leftHash.compare(rightHash) === 1)
    [leftHash, rightHash] = [rightHash, leftHash];
  return {
    hash: tapBranchHash(leftHash, rightHash),
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
