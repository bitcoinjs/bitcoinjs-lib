'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.oneOf =
  exports.Null =
  exports.BufferN =
  exports.Function =
  exports.UInt32 =
  exports.UInt8 =
  exports.tuple =
  exports.maybe =
  exports.Hex =
  exports.Buffer =
  exports.String =
  exports.Boolean =
  exports.Array =
  exports.Number =
  exports.Hash256bit =
  exports.Hash160bit =
  exports.Buffer256bit =
  exports.isTaptree =
  exports.isTapleaf =
  exports.TAPLEAF_VERSION_MASK =
  exports.Satoshi =
  exports.isPoint =
  exports.stacksEqual =
  exports.typeforce =
    void 0;
const buffer_1 = require('buffer');
exports.typeforce = require('typeforce');
const ZERO32 = buffer_1.Buffer.alloc(32, 0);
const EC_P = buffer_1.Buffer.from(
  'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
  'hex',
);
/**
 * Checks if two arrays of Buffers are equal.
 * @param a - The first array of Buffers.
 * @param b - The second array of Buffers.
 * @returns True if the arrays are equal, false otherwise.
 */
function stacksEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    return x.equals(b[i]);
  });
}
exports.stacksEqual = stacksEqual;
/**
 * Checks if the given value is a valid elliptic curve point.
 * @param p - The value to check.
 * @returns True if the value is a valid elliptic curve point, false otherwise.
 */
function isPoint(p) {
  if (!buffer_1.Buffer.isBuffer(p)) return false;
  if (p.length < 33) return false;
  const t = p[0];
  const x = p.slice(1, 33);
  if (x.compare(ZERO32) === 0) return false;
  if (x.compare(EC_P) >= 0) return false;
  if ((t === 0x02 || t === 0x03) && p.length === 33) {
    return true;
  }
  const y = p.slice(33);
  if (y.compare(ZERO32) === 0) return false;
  if (y.compare(EC_P) >= 0) return false;
  if (t === 0x04 && p.length === 65) return true;
  return false;
}
exports.isPoint = isPoint;
const SATOSHI_MAX = 21 * 1e14;
function Satoshi(value) {
  return exports.typeforce.UInt53(value) && value <= SATOSHI_MAX;
}
exports.Satoshi = Satoshi;
exports.TAPLEAF_VERSION_MASK = 0xfe;
function isTapleaf(o) {
  if (!o || !('output' in o)) return false;
  if (!buffer_1.Buffer.isBuffer(o.output)) return false;
  if (o.version !== undefined)
    return (o.version & exports.TAPLEAF_VERSION_MASK) === o.version;
  return true;
}
exports.isTapleaf = isTapleaf;
function isTaptree(scriptTree) {
  if (!(0, exports.Array)(scriptTree)) return isTapleaf(scriptTree);
  if (scriptTree.length !== 2) return false;
  return scriptTree.every(t => isTaptree(t));
}
exports.isTaptree = isTaptree;
exports.Buffer256bit = exports.typeforce.BufferN(32);
exports.Hash160bit = exports.typeforce.BufferN(20);
exports.Hash256bit = exports.typeforce.BufferN(32);
exports.Number = exports.typeforce.Number;
exports.Array = exports.typeforce.Array;
exports.Boolean = exports.typeforce.Boolean;
exports.String = exports.typeforce.String;
exports.Buffer = exports.typeforce.Buffer;
exports.Hex = exports.typeforce.Hex;
exports.maybe = exports.typeforce.maybe;
exports.tuple = exports.typeforce.tuple;
exports.UInt8 = exports.typeforce.UInt8;
exports.UInt32 = exports.typeforce.UInt32;
exports.Function = exports.typeforce.Function;
exports.BufferN = exports.typeforce.BufferN;
exports.Null = exports.typeforce.Null;
exports.oneOf = exports.typeforce.oneOf;
