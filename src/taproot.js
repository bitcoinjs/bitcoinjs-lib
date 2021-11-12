'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.tapLeafHash = exports.findScriptPath = exports.toHashTree = exports.rootHashFromPath = exports.tweakKey = exports.liftX = void 0;
const buffer_1 = require('buffer');
const BN = require('bn.js');
const bcrypto = require('./crypto');
// todo: use varuint-bitcoin??
const varuint = require('bip174/src/lib/converter/varint');
const types_1 = require('./types');
// todo: !!!Temp, to be replaced. Only works because bip32 has it as dependecy. Linting will fail.
const ecc = require('tiny-secp256k1');
const LEAF_VERSION_TAPSCRIPT = 0xc0;
const TAP_LEAF_TAG = 'TapLeaf';
const TAP_BRANCH_TAG = 'TapBranch';
const TAP_TWEAK_TAG = 'TapTweak';
const EC_P_BN = new BN(types_1.EC_P);
const EC_P_REDUCTION = BN.red(EC_P_BN);
const EC_P_QUADRATIC_RESIDUE = EC_P_BN.addn(1).divn(4);
const BN_2 = new BN(2);
const BN_3 = new BN(3);
const BN_7 = new BN(7);
function liftX(buffer) {
  if (!buffer_1.Buffer.isBuffer(buffer)) return null;
  if (buffer.length !== 32) return null;
  if (buffer.compare(types_1.ZERO32) === 0) return null;
  if (buffer.compare(types_1.EC_P) >= 0) return null;
  const x = new BN(buffer);
  const x1 = x.toRed(EC_P_REDUCTION);
  const ySq = x1
    .redPow(BN_3)
    .add(BN_7)
    .mod(EC_P_BN);
  const y = ySq.redPow(EC_P_QUADRATIC_RESIDUE);
  if (!ySq.eq(y.redPow(BN_2))) {
    return null;
  }
  const y1 = y.isEven() ? y : EC_P_BN.sub(y);
  return buffer_1.Buffer.concat([
    buffer_1.Buffer.from([0x04]),
    buffer_1.Buffer.from(x1.toBuffer('be', 32)),
    buffer_1.Buffer.from(y1.toBuffer('be', 32)),
  ]);
}
exports.liftX = liftX;
function tweakKey(pubKey, h) {
  if (!buffer_1.Buffer.isBuffer(pubKey)) return null;
  if (pubKey.length !== 32) return null;
  if (h && h.length !== 32) return null;
  const tweakHash = bcrypto.taggedHash(
    TAP_TWEAK_TAG,
    buffer_1.Buffer.concat(h ? [pubKey, h] : [pubKey]),
  );
  if (tweakHash.compare(types_1.GROUP_ORDER) >= 0) {
    // todo: add test for this case
    throw new TypeError('Tweak value over the SECP256K1 Order');
  }
  const P = liftX(pubKey);
  if (P === null) return null;
  const Q = pointAddScalar(P, tweakHash);
  return {
    parity: Q[64] % 2,
    x: Q.slice(1, 33),
  };
}
exports.tweakKey = tweakKey;
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
function tapBranchHash(a, b) {
  return bcrypto.taggedHash(TAP_BRANCH_TAG, buffer_1.Buffer.concat([a, b]));
}
function serializeScript(s) {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = buffer_1.Buffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return buffer_1.Buffer.concat([buffer, s]);
}
// todo: do not use ecc
function pointAddScalar(P, h) {
  return ecc.pointAddScalar(P, h);
}
