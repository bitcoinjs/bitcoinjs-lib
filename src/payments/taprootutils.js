'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.tapTweakHash = exports.tapLeafHash = exports.findScriptPath = exports.toHashTree = exports.rootHashFromPath = void 0;
const buffer_1 = require('buffer');
const bcrypto = require('../crypto');
const bufferutils_1 = require('../bufferutils');
const LEAF_VERSION_TAPSCRIPT = 0xc0;
const TAP_LEAF_TAG = 'TapLeaf';
const TAP_BRANCH_TAG = 'TapBranch';
const TAP_TWEAK_TAG = 'TapTweak';
function rootHashFromPath(controlBlock, tapLeafMsg) {
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
exports.rootHashFromPath = rootHashFromPath;
function toHashTree(scripts) {
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
exports.toHashTree = toHashTree;
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
function tapLeafHash(script, version) {
  version = version || LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    TAP_LEAF_TAG,
    buffer_1.Buffer.concat([
      buffer_1.Buffer.from([version]),
      serializeScript(script),
    ]),
  );
}
exports.tapLeafHash = tapLeafHash;
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
