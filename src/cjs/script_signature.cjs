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
exports.decode = decode;
exports.encode = encode;
const bip66 = __importStar(require('./bip66.cjs'));
const script_js_1 = require('./script.cjs');
const v = __importStar(require('valibot'));
const tools = __importStar(require('uint8array-tools'));
const types_js_1 = require('./types.cjs');
const ZERO = new Uint8Array(1);
/**
 * Converts a buffer to a DER-encoded buffer.
 * @param x - The buffer to be converted.
 * @returns The DER-encoded buffer.
 */
function toDER(x) {
  let i = 0;
  while (x[i] === 0) ++i;
  if (i === x.length) return ZERO;
  x = x.slice(i);
  if (x[0] & 0x80) return tools.concat([ZERO, x]);
  return x;
}
/**
 * Converts a DER-encoded signature to a buffer.
 * If the first byte of the input buffer is 0x00, it is skipped.
 * The resulting buffer is 32 bytes long, filled with zeros if necessary.
 * @param x - The DER-encoded signature.
 * @returns The converted buffer.
 */
function fromDER(x) {
  if (x[0] === 0x00) x = x.slice(1);
  const buffer = new Uint8Array(32);
  const bstart = Math.max(0, 32 - x.length);
  buffer.set(x, bstart);
  return buffer;
}
// BIP62: 1 byte hashType flag (only 0x01, 0x02, 0x03, 0x81, 0x82 and 0x83 are allowed)
/**
 * Decodes a buffer into a ScriptSignature object.
 * @param buffer - The buffer to decode.
 * @returns The decoded ScriptSignature object.
 * @throws Error if the hashType is invalid.
 */
function decode(buffer) {
  const hashType = tools.readUInt8(buffer, buffer.length - 1);
  if (!(0, script_js_1.isDefinedHashType)(hashType)) {
    throw new Error('Invalid hashType ' + hashType);
  }
  const decoded = bip66.decode(buffer.subarray(0, -1));
  const r = fromDER(decoded.r);
  const s = fromDER(decoded.s);
  const signature = tools.concat([r, s]);
  return { signature, hashType };
}
/**
 * Encodes a signature and hash type into a buffer.
 * @param signature - The signature to encode.
 * @param hashType - The hash type to encode.
 * @returns The encoded buffer.
 * @throws Error if the hashType is invalid.
 */
function encode(signature, hashType) {
  v.parse(
    v.object({
      signature: (0, types_js_1.NBufferSchemaFactory)(64),
      hashType: types_js_1.UInt8Schema,
    }),
    { signature, hashType },
  );
  if (!(0, script_js_1.isDefinedHashType)(hashType)) {
    throw new Error('Invalid hashType ' + hashType);
  }
  const hashTypeBuffer = new Uint8Array(1);
  tools.writeUInt8(hashTypeBuffer, 0, hashType);
  const r = toDER(signature.slice(0, 32));
  const s = toDER(signature.slice(32, 64));
  return tools.concat([bip66.encode(r, s), hashTypeBuffer]);
}
