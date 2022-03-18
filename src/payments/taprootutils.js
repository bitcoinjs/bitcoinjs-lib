'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.tapTweakHash = exports.tapleafHash = exports.findScriptPath = exports.toHashTree = exports.rootHashFromPath = exports.LEAF_VERSION_TAPSCRIPT = void 0;
const buffer_1 = require('buffer');
const bcrypto = require('../crypto');
const bufferutils_1 = require('../bufferutils');
const types_1 = require('../types');
exports.LEAF_VERSION_TAPSCRIPT = 0xc0;
function rootHashFromPath(controlBlock, leafHash) {
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
exports.rootHashFromPath = rootHashFromPath;
const isHashBranch = ht => 'left' in ht && 'right' in ht;
/**
 * Build the hash tree from the scripts binary tree.
 * The binary tree can be balanced or not.
 * @param scriptTree - is a list representing a binary tree where an element can be:
 *  - a taproot leaf [(output, version)], or
 *  - a pair of two taproot leafs [(output, version), (output, version)], or
 *  - one taproot leaf and a list of elements
 */
function toHashTree(scriptTree) {
  if ((0, types_1.isTapleaf)(scriptTree))
    return { hash: tapleafHash(scriptTree) };
  const hashes = [toHashTree(scriptTree[0]), toHashTree(scriptTree[1])];
  hashes.sort((a, b) => a.hash.compare(b.hash));
  const [left, right] = hashes;
  return {
    hash: tapBranchHash(left.hash, right.hash),
    left,
    right,
  };
}
exports.toHashTree = toHashTree;
/**
 * Given a MAST tree, it finds the path of a particular hash.
 * @param node - the root of the tree
 * @param hash - the hash to search for
 * @returns - and array of hashes representing the path, undefined if no path is found
 */
function findScriptPath(node, hash) {
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
exports.findScriptPath = findScriptPath;
function tapleafHash(leaf) {
  const version = leaf.version || exports.LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    'TapLeaf',
    buffer_1.Buffer.concat([
      buffer_1.Buffer.from([version]),
      serializeScript(leaf.output),
    ]),
  );
}
exports.tapleafHash = tapleafHash;
function tapTweakHash(pubKey, h) {
  return bcrypto.taggedHash(
    'TapTweak',
    buffer_1.Buffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}
exports.tapTweakHash = tapTweakHash;
function tapBranchHash(a, b) {
  return bcrypto.taggedHash('TapBranch', buffer_1.Buffer.concat([a, b]));
}
function serializeScript(s) {
  const varintLen = bufferutils_1.varuint.encodingLength(s.length);
  const buffer = buffer_1.Buffer.allocUnsafe(varintLen); // better
  bufferutils_1.varuint.encode(s.length, buffer);
  return buffer_1.Buffer.concat([buffer, s]);
}
