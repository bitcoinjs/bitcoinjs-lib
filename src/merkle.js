'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.computeMastRoot = exports.fastMerkleRoot = void 0;
const buffer_1 = require('buffer');
const bcrypto = require('./crypto');
// todo: use varuint-bitcoin??
const varuint = require('bip174/src/lib/converter/varint');
// todo: find better place for these consts
const TAP_LEAF_TAG = buffer_1.Buffer.from('TapLeaf', 'utf8');
const TAP_BRANCH_TAG = buffer_1.Buffer.from('TapBranch', 'utf8');
const LEAF_VERSION_TAPSCRIPT = 0xc0;
function fastMerkleRoot(values, digestFn) {
  if (!Array.isArray(values)) throw TypeError('Expected values Array');
  if (typeof digestFn !== 'function')
    throw TypeError('Expected digest Function');
  let length = values.length;
  const results = values.concat();
  while (length > 1) {
    let j = 0;
    for (let i = 0; i < length; i += 2, ++j) {
      const left = results[i];
      const right = i + 1 === length ? left : results[i + 1];
      const data = Buffer.concat([left, right]);
      results[j] = digestFn(data);
    }
    length = j;
  }
  return results[0];
}
exports.fastMerkleRoot = fastMerkleRoot;
// todo: solve any[]
function computeMastRoot(scripts) {
  if (scripts.length === 1) {
    const script = scripts[0];
    if (Array.isArray(script)) {
      return computeMastRoot(script);
    }
    script.version = script.version || LEAF_VERSION_TAPSCRIPT;
    if ((script.version & 1) !== 0) throw new Error('Invalid script version'); // todo typedef error
    // todo: if (script.output)scheck is bytes
    const scriptOutput = buffer_1.Buffer.from(script.output, 'hex');
    return bcrypto.taggedHash(
      TAP_LEAF_TAG,
      buffer_1.Buffer.concat([
        buffer_1.Buffer.from([script.version]),
        serializeScript(scriptOutput),
      ]),
    );
  }
  // todo: this is a binary tree, use zero an one index
  const half = Math.trunc(scripts.length / 2);
  let leftHash = computeMastRoot(scripts.slice(0, half));
  let rightHash = computeMastRoot(scripts.slice(half));
  if (leftHash.compare(rightHash) === 1)
    [leftHash, rightHash] = [rightHash, leftHash];
  return bcrypto.taggedHash(
    TAP_BRANCH_TAG,
    buffer_1.Buffer.concat([leftHash, rightHash]),
  );
}
exports.computeMastRoot = computeMastRoot;
function serializeScript(s) {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = buffer_1.Buffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return buffer_1.Buffer.concat([buffer, s]);
}
