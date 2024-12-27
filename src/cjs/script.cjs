'use strict';
/**
 * Script tools module for working with Bitcoin scripts.
 * Provides utilities such as decompiling, compiling, converting to/from ASM, stack manipulation,
 * and script validation functions.
 *
 * @packageDocumentation
 */
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
/** Base opcode for OP_INT values. */
const OP_INT_BASE = ops_js_1.OPS.OP_RESERVED; // OP_1 - 1
/** Validation schema for a Bitcoin script stack. */
const StackSchema = v.array(v.union([v.instance(Uint8Array), v.number()]));
/**
 * Determines if a value corresponds to an OP_INT opcode.
 *
 * @param value - The opcode to check.
 * @returns True if the value is an OP_INT, false otherwise.
 */
function isOPInt(value) {
  return (
    v.is(v.number(), value) &&
    (value === ops_js_1.OPS.OP_0 ||
      (value >= ops_js_1.OPS.OP_1 && value <= ops_js_1.OPS.OP_16) ||
      value === ops_js_1.OPS.OP_1NEGATE)
  );
}
/**
 * Checks if a script chunk is push-only (contains only data or OP_INT opcodes).
 *
 * @param value - The chunk to check.
 * @returns True if the chunk is push-only, false otherwise.
 */
function isPushOnlyChunk(value) {
  return v.is(types.BufferSchema, value) || isOPInt(value);
}
/**
 * Determines if a stack consists of only push operations.
 *
 * @param value - The stack to check.
 * @returns True if all elements in the stack are push-only, false otherwise.
 */
function isPushOnly(value) {
  return v.is(v.pipe(v.any(), v.everyItem(isPushOnlyChunk)), value);
}
/**
 * Counts the number of non-push-only opcodes in a stack.
 *
 * @param value - The stack to analyze.
 * @returns The count of non-push-only opcodes.
 */
function countNonPushOnlyOPs(value) {
  return value.length - value.filter(isPushOnlyChunk).length;
}
/**
 * Converts a minimal script buffer to its corresponding opcode, if applicable.
 *
 * @param buffer - The buffer to check.
 * @returns The corresponding opcode or undefined if not minimal.
 */
function asMinimalOP(buffer) {
  if (buffer.length === 0) return ops_js_1.OPS.OP_0;
  if (buffer.length !== 1) return;
  if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0];
  if (buffer[0] === 0x81) return ops_js_1.OPS.OP_1NEGATE;
}
/**
 * Determines if a buffer or stack is a Uint8Array.
 *
 * @param buf - The buffer or stack to check.
 * @returns True if the input is a Uint8Array, false otherwise.
 */
function chunksIsBuffer(buf) {
  return buf instanceof Uint8Array;
}
/**
 * Determines if a buffer or stack is a valid stack.
 *
 * @param buf - The buffer or stack to check.
 * @returns True if the input is a stack, false otherwise.
 */
function chunksIsArray(buf) {
  return v.is(StackSchema, buf);
}
/**
 * Determines if a single chunk is a Uint8Array.
 *
 * @param buf - The chunk to check.
 * @returns True if the chunk is a Uint8Array, false otherwise.
 */
function singleChunkIsBuffer(buf) {
  return buf instanceof Uint8Array;
}
/**
 * Compiles an array of script chunks into a Uint8Array.
 *
 * @param chunks - The chunks to compile.
 * @returns The compiled script as a Uint8Array.
 * @throws Error if compilation fails.
 */
function compile(chunks) {
  if (chunksIsBuffer(chunks)) return chunks;
  v.parse(StackSchema, chunks);
  const bufferSize = chunks.reduce((accum, chunk) => {
    if (singleChunkIsBuffer(chunk)) {
      // adhere to BIP62.3, minimal push policy
      if (chunk.length === 1 && asMinimalOP(chunk) !== undefined) {
        return accum + 1;
      }
      return accum + pushdata.encodingLength(chunk.length) + chunk.length;
    }
    return accum + 1;
  }, 0);
  const buffer = new Uint8Array(bufferSize);
  let offset = 0;
  chunks.forEach(chunk => {
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
/**
 * Decompiles a script buffer into an array of chunks.
 *
 * @param buffer - The script buffer to decompile.
 * @returns The decompiled chunks or null if decompilation fails.
 */
function decompile(buffer) {
  if (chunksIsArray(buffer)) return buffer;
  v.parse(types.BufferSchema, buffer);
  const chunks = [];
  let i = 0;
  while (i < buffer.length) {
    const opcode = buffer[i];
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
      if (singleChunkIsBuffer(chunk)) {
        const op = asMinimalOP(chunk);
        if (op === undefined) return tools.toHex(chunk);
        chunk = op;
      }
      // opcode!
      return ops_js_1.OPS[chunk];
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
  // Compile the ASM string into a Uint8Array
  return compile(
    asm.split(' ').map(chunk => {
      // Check if the chunk is an opcode
      if (isNaN(Number(chunk)) && chunk in ops_js_1.OPS) {
        return ops_js_1.OPS[chunk];
      }
      // Validate if the chunk is a hexadecimal string
      v.parse(types.HexSchema, chunk);
      // Convert the chunk to Uint8Array data
      return tools.fromHex(chunk);
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
/**
 * Checks if the provided buffer is a canonical public key.
 *
 * @param buffer - The buffer to check, expected to be a Uint8Array.
 * @returns A boolean indicating whether the buffer is a canonical public key.
 */
function isCanonicalPubKey(buffer) {
  return types.isPoint(buffer);
}
/**
 * Checks if the provided hash type is defined.
 *
 * A hash type is considered defined if its modified value (after masking with ~0x80)
 * is greater than 0x00 and less than 0x04.
 *
 * @param hashType - The hash type to check.
 * @returns True if the hash type is defined, false otherwise.
 */
function isDefinedHashType(hashType) {
  const hashTypeMod = hashType & ~0x80;
  return hashTypeMod > 0x00 && hashTypeMod < 0x04;
}
/**
 * Checks if the provided buffer is a canonical script signature.
 *
 * A canonical script signature is a valid DER-encoded signature followed by a valid hash type byte.
 *
 * @param buffer - The buffer to check.
 * @returns `true` if the buffer is a canonical script signature, `false` otherwise.
 */
function isCanonicalScriptSignature(buffer) {
  if (!(buffer instanceof Uint8Array)) return false;
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false;
  return bip66.check(buffer.slice(0, -1));
}
exports.number = scriptNumber;
exports.signature = scriptSignature;
