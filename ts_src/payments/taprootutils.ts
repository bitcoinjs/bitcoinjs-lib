import { Buffer as NBuffer } from 'buffer';
import * as bcrypto from '../crypto';

import { varuint } from '../bufferutils';
import { Tapleaf, Taptree, isTapleaf } from '../types';

export const LEAF_VERSION_TAPSCRIPT = 0xc0;

export function rootHashFromPath(
  controlBlock: Buffer,
  leafHash: Buffer,
): Buffer {
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

interface HashLeaf {
  hash: Buffer;
}

interface HashBranch {
  hash: Buffer;
  left: HashTree;
  right: HashTree;
}

const isHashBranch = (ht: HashTree): ht is HashBranch =>
  'left' in ht && 'right' in ht;

export type HashTree = HashLeaf | HashBranch;

/**
 * Build the hash tree from the scripts binary tree.
 * The binary tree can be balanced or not.
 * @param scriptTree - is a list representing a binary tree where an element can be:
 *  - a taproot leaf [(output, version)], or
 *  - a pair of two taproot leafs [(output, version), (output, version)], or
 *  - one taproot leaf and a list of elements
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
 * Given a MAST tree, it finds the path of a particular hash.
 * @param node - the root of the tree
 * @param hash - the hash to search for
 * @returns - and array of hashes representing the path, undefined if no path is found
 */
export function findScriptPath(
  node: HashTree,
  hash: Buffer,
): Buffer[] | undefined {
  if (!isHashBranch(node)) {
    if (node.hash.equals(hash)) {
      return [];
    } else {
      return undefined;
    }
  }

  const leftPath = findScriptPath(node.left, hash);
  if (leftPath !== undefined) return [node.right.hash, ...leftPath];

  const rightPath = findScriptPath(node.right, hash);
  if (rightPath !== undefined) return [node.left.hash, ...rightPath];

  return undefined;
}

export function tapleafHash(leaf: Tapleaf): Buffer {
  const version = leaf.version || LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    'TapLeaf',
    NBuffer.concat([NBuffer.from([version]), serializeScript(leaf.output)]),
  );
}

export function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return bcrypto.taggedHash(
    'TapTweak',
    NBuffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}

function tapBranchHash(a: Buffer, b: Buffer): Buffer {
  return bcrypto.taggedHash('TapBranch', NBuffer.concat([a, b]));
}

function serializeScript(s: Buffer): Buffer {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = NBuffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return NBuffer.concat([buffer, s]);
}
