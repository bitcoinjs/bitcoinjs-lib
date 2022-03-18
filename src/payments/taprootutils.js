'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.tapTweakHash = exports.tapleafHash = exports.findScriptPath = exports.toHashTree = exports.rootHashFromPath = exports.LEAF_VERSION_TAPSCRIPT = void 0;
const buffer_1 = require('buffer');
const bcrypto = require('../crypto');
const bufferutils_1 = require('../bufferutils');
const types_1 = require('../types');
const TAP_LEAF_TAG = 'TapLeaf';
const TAP_BRANCH_TAG = 'TapBranch';
const TAP_TWEAK_TAG = 'TapTweak';
exports.LEAF_VERSION_TAPSCRIPT = 0xc0;
function rootHashFromPath(controlBlock, tapleafMsg) {
  const k = [tapleafMsg];
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
exports.rootHashFromPath = rootHashFromPath;
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
 * @returns - and array of hashes representing the path, or an empty array if no pat is found
 */
function findScriptPath(node, hash) {
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
exports.findScriptPath = findScriptPath;
function tapleafHash(leaf) {
  const version = leaf.version || exports.LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    TAP_LEAF_TAG,
    buffer_1.Buffer.concat([
      buffer_1.Buffer.from([version]),
      serializeScript(leaf.output),
    ]),
  );
}
exports.tapleafHash = tapleafHash;
function tapTweakHash(pubKey, h) {
  return bcrypto.taggedHash(
    TAP_TWEAK_TAG,
    buffer_1.Buffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}
exports.tapTweakHash = tapTweakHash;
function tapBranchHash(a, b) {
  return bcrypto.taggedHash(TAP_BRANCH_TAG, buffer_1.Buffer.concat([a, b]));
}
function serializeScript(s) {
  const varintLen = bufferutils_1.varuint.encodingLength(s.length);
  const buffer = buffer_1.Buffer.allocUnsafe(varintLen); // better
  bufferutils_1.varuint.encode(s.length, buffer);
  return buffer_1.Buffer.concat([buffer, s]);
}
