'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.NullablePartial =
  exports.SatoshiSchema =
  exports.UInt32Schema =
  exports.UInt8Schema =
  exports.HexSchema =
  exports.BufferSchema =
  exports.Hash256bitSchema =
  exports.Hash160bitSchema =
  exports.Buffer256bitSchema =
  exports.TAPLEAF_VERSION_MASK =
  exports.NBufferSchemaFactory =
    void 0;
exports.stacksEqual = stacksEqual;
exports.isPoint = isPoint;
exports.isTapleaf = isTapleaf;
exports.isTaptree = isTaptree;
const tools = __importStar(require('uint8array-tools'));
const v = __importStar(require('valibot'));
const ZERO32 = new Uint8Array(32);
const EC_P = tools.fromHex(
  'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
);
const NBufferSchemaFactory = size =>
  v.pipe(v.instance(Uint8Array), v.length(size));
exports.NBufferSchemaFactory = NBufferSchemaFactory;
/**
 * Checks if two arrays of Buffers are equal.
 * @param a - The first array of Buffers.
 * @param b - The second array of Buffers.
 * @returns True if the arrays are equal, false otherwise.
 */
function stacksEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    return tools.compare(x, b[i]) === 0;
  });
}
/**
 * Checks if the given value is a valid elliptic curve point.
 * @param p - The value to check.
 * @returns True if the value is a valid elliptic curve point, false otherwise.
 */
function isPoint(p) {
  if (!(p instanceof Uint8Array)) return false;
  if (p.length < 33) return false;
  const t = p[0];
  const x = p.slice(1, 33);
  if (tools.compare(ZERO32, x) === 0) return false;
  if (tools.compare(x, EC_P) >= 0) return false;
  if ((t === 0x02 || t === 0x03) && p.length === 33) {
    return true;
  }
  const y = p.slice(33);
  if (tools.compare(ZERO32, y) === 0) return false;
  if (tools.compare(y, EC_P) >= 0) return false;
  if (t === 0x04 && p.length === 65) return true;
  return false;
}
exports.TAPLEAF_VERSION_MASK = 0xfe;
function isTapleaf(o) {
  if (!o || !('output' in o)) return false;
  if (!(o.output instanceof Uint8Array)) return false;
  if (o.version !== undefined)
    return (o.version & exports.TAPLEAF_VERSION_MASK) === o.version;
  return true;
}
function isTaptree(scriptTree) {
  if (!Array.isArray(scriptTree)) return isTapleaf(scriptTree);
  if (scriptTree.length !== 2) return false;
  return scriptTree.every(t => isTaptree(t));
}
exports.Buffer256bitSchema = (0, exports.NBufferSchemaFactory)(32);
exports.Hash160bitSchema = (0, exports.NBufferSchemaFactory)(20);
exports.Hash256bitSchema = (0, exports.NBufferSchemaFactory)(32);
exports.BufferSchema = v.instance(Uint8Array);
exports.HexSchema = v.pipe(v.string(), v.regex(/^([0-9a-f]{2})+$/i));
exports.UInt8Schema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(0xff),
);
exports.UInt32Schema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(0xffffffff),
);
exports.SatoshiSchema = v.pipe(
  v.bigint(),
  v.minValue(0n),
  v.maxValue(0x7fffffffffffffffn),
);
const NullablePartial = a =>
  v.object(
    Object.entries(a).reduce(
      (acc, next) => ({ ...acc, [next[0]]: v.nullish(next[1]) }),
      {},
    ),
  );
exports.NullablePartial = NullablePartial;
