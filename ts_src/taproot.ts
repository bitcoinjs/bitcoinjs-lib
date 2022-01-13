import { Buffer as NBuffer } from 'buffer';
import * as bcrypto from './crypto';

// todo: use varuint-bitcoin??
import * as varuint from 'bip174/src/lib/converter/varint';
import { TaprootLeaf } from './types';

// todo: !!!Temp, to be replaced. Only works because bip32 has it as dependecy. Linting will fail.
// const ecc = require('tiny-secp256k1');

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

export function toHashTree(scripts: TaprootLeaf[]): HashTree {
  if (scripts.length === 1) {
    const script = scripts[0];
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
  // todo: this is a binary tree, use zero an one index
  const half = Math.trunc(scripts.length / 2);
  const left = toHashTree(scripts.slice(0, half));
  const right = toHashTree(scripts.slice(half));

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

function tapBranchHash(a: Buffer, b: Buffer): Buffer {
  return bcrypto.taggedHash(TAP_BRANCH_TAG, NBuffer.concat([a, b]));
}

export function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
  return bcrypto.taggedHash(
    TAP_TWEAK_TAG,
    NBuffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}

function serializeScript(s: Buffer): Buffer {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = NBuffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return NBuffer.concat([buffer, s]);
}
