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
exports.signature = exports.number = exports.OPS = void 0;
exports.isPushOnly = isPushOnly;
exports.countNonPushOnlyOPs = countNonPushOnlyOPs;
exports.compile = compile;
exports.decompile = decompile;
exports.toASM = toASM;
exports.fromASM = fromASM;
exports.toStack = toStack;
exports.isCanonicalPubKey = isCanonicalPubKey;
exports.isDefinedHashType = isDefinedHashType;
exports.isCanonicalScriptSignature = isCanonicalScriptSignature;
/**
 * Script tools, including decompile, compile, toASM, fromASM, toStack, isCanonicalPubKey, isCanonicalScriptSignature
 * @packageDocumentation
 */
const bip66 = __importStar(require('./bip66.cjs'));
const ops_js_1 = require('./ops.cjs');
Object.defineProperty(exports, 'OPS', {
  enumerable: true,
  get: function () {
    return ops_js_1.OPS;
  },
});
const pushdata = __importStar(require('./push_data.cjs'));
const scriptNumber = __importStar(require('./script_number.cjs'));
const scriptSignature = __importStar(require('./script_signature.cjs'));
const types = __importStar(require('./types.cjs'));
const tools = __importStar(require('uint8array-tools'));
const v = __importStar(require('valibot'));
const OP_INT_BASE = ops_js_1.OPS.OP_RESERVED; // OP_1 - 1
const StackSchema = v.array(v.union([v.instance(Uint8Array), v.number()]));
function isOPInt(value) {
  return (
    v.is(v.number(), value) &&
    (value === ops_js_1.OPS.OP_0 ||
      (value >= ops_js_1.OPS.OP_1 && value <= ops_js_1.OPS.OP_16) ||
      value === ops_js_1.OPS.OP_1NEGATE)
  );
}
function isPushOnlyChunk(value) {
  return v.is(types.BufferSchema, value) || isOPInt(value);
}
function isPushOnly(value) {
  return v.is(v.pipe(v.any(), v.everyItem(isPushOnlyChunk)), value);
}
function countNonPushOnlyOPs(value) {
  return value.length - value.filter(isPushOnlyChunk).length;
}
function asMinimalOP(buffer) {
  if (buffer.length === 0) return ops_js_1.OPS.OP_0;
  if (buffer.length !== 1) return;
  if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0];
  if (buffer[0] === 0x81) return ops_js_1.OPS.OP_1NEGATE;
}
function chunksIsBuffer(buf) {
  return buf instanceof Uint8Array;
}
function chunksIsArray(buf) {
  return v.is(StackSchema, buf);
}
function singleChunkIsBuffer(buf) {
  return buf instanceof Uint8Array;
}
/**
 * Compiles an array of chunks into a Buffer.
 *
 * @param chunks - The array of chunks to compile.
 * @returns The compiled Buffer.
 * @throws Error if the compilation fails.
 */
function compile(chunks) {
  // TODO: remove me
  if (chunksIsBuffer(chunks)) return chunks;
  v.parse(StackSchema, chunks);
  const bufferSize = chunks.reduce((accum, chunk) => {
    // data chunk
    if (singleChunkIsBuffer(chunk)) {
      // adhere to BIP62.3, minimal push policy
      if (chunk.length === 1 && asMinimalOP(chunk) !== undefined) {
        return accum + 1;
      }
      return accum + pushdata.encodingLength(chunk.length) + chunk.length;
    }
    // opcode
    return accum + 1;
  }, 0.0);
  const buffer = new Uint8Array(bufferSize);
  let offset = 0;
  chunks.forEach(chunk => {
    // data chunk
    if (singleChunkIsBuffer(chunk)) {
      // adhere to BIP62.3, minimal push policy
      const opcode = asMinimalOP(chunk);
      if (opcode !== undefined) {
        tools.writeUInt8(buffer, offset, opcode);
        offset += 1;
        return;
      }
      offset += pushdata.encode(buffer, chunk.length, offset);
      buffer.set(chunk, offset);
      offset += chunk.length;
      // opcode
    } else {
      tools.writeUInt8(buffer, offset, chunk);
      offset += 1;
    }
  });
  if (offset !== buffer.length) throw new Error('Could not decode chunks');
  return buffer;
}
function decompile(buffer) {
  // TODO: remove me
  if (chunksIsArray(buffer)) return buffer;
  v.parse(types.BufferSchema, buffer);
  const chunks = [];
  let i = 0;
  while (i < buffer.length) {
    const opcode = buffer[i];
    // data chunk
    if (opcode > ops_js_1.OPS.OP_0 && opcode <= ops_js_1.OPS.OP_PUSHDATA4) {
      const d = pushdata.decode(buffer, i);
      // did reading a pushDataInt fail?
      if (d === null) return null;
      i += d.size;
      // attempt to read too much data?
      if (i + d.number > buffer.length) return null;
      const data = buffer.slice(i, i + d.number);
      i += d.number;
      // decompile minimally
      const op = asMinimalOP(data);
      if (op !== undefined) {
        chunks.push(op);
      } else {
        chunks.push(data);
      }
      // opcode
    } else {
      chunks.push(opcode);
      i += 1;
    }
  }
  return chunks;
}
/**
 * Converts the given chunks into an ASM (Assembly) string representation.
 * If the chunks parameter is a Buffer, it will be decompiled into a Stack before conversion.
 * @param chunks - The chunks to convert into ASM.
 * @returns The ASM string representation of the chunks.
 */
function toASM(chunks) {
  if (chunksIsBuffer(chunks)) {
    chunks = decompile(chunks);
  }
  if (!chunks) {
    throw new Error('Could not convert invalid chunks to ASM');
  }
  return chunks
    .map(chunk => {
      // data?
      if (singleChunkIsBuffer(chunk)) {
        const op = asMinimalOP(chunk);
        if (op === undefined) return tools.toHex(chunk);
        chunk = op;
      }
      // opcode!
      return ops_js_1.REVERSE_OPS[chunk];
    })
    .join(' ');
}
/**
 * Converts an ASM string to a Buffer.
 * @param asm The ASM string to convert.
 * @returns The converted Buffer.
 */
function fromASM(asm) {
  v.parse(v.string(), asm);
  return compile(
    asm.split(' ').map(chunkStr => {
      // opcode?
      if (ops_js_1.OPS[chunkStr] !== undefined) return ops_js_1.OPS[chunkStr];
      v.parse(types.HexSchema, chunkStr);
      // data!
      return tools.fromHex(chunkStr);
    }),
  );
}
/**
 * Converts the given chunks into a stack of buffers.
 *
 * @param chunks - The chunks to convert.
 * @returns The stack of buffers.
 */
function toStack(chunks) {
  chunks = decompile(chunks);
  v.parse(v.custom(isPushOnly), chunks);
  return chunks.map(op => {
    if (singleChunkIsBuffer(op)) return op;
    if (op === ops_js_1.OPS.OP_0) return new Uint8Array(0);
    return scriptNumber.encode(op - OP_INT_BASE);
  });
}
function isCanonicalPubKey(buffer) {
  return types.isPoint(buffer);
}
function isDefinedHashType(hashType) {
  const hashTypeMod = hashType & ~0x80;
  return hashTypeMod > 0x00 && hashTypeMod < 0x04;
}
function isCanonicalScriptSignature(buffer) {
  if (!(buffer instanceof Uint8Array)) return false;
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false;
  return bip66.check(buffer.slice(0, -1));
}
exports.number = scriptNumber;
exports.signature = scriptSignature;
