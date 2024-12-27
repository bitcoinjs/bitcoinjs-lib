/**
 * Script tools module for working with Bitcoin scripts.
 * Provides utilities such as decompiling, compiling, converting to/from ASM, stack manipulation,
 * and script validation functions.
 *
 * @packageDocumentation
 */
import * as bip66 from './bip66.js';
import { OPS } from './ops.js';
import * as pushdata from './push_data.js';
import * as scriptNumber from './script_number.js';
import * as scriptSignature from './script_signature.js';
import * as types from './types.js';
import * as tools from 'uint8array-tools';
import * as v from 'valibot';
/** Base opcode for OP_INT values. */
const OP_INT_BASE = OPS.OP_RESERVED; // OP_1 - 1
export { OPS };
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
    (value === OPS.OP_0 ||
      (value >= OPS.OP_1 && value <= OPS.OP_16) ||
      value === OPS.OP_1NEGATE)
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
export function isPushOnly(value) {
  return v.is(v.pipe(v.any(), v.everyItem(isPushOnlyChunk)), value);
}
/**
 * Counts the number of non-push-only opcodes in a stack.
 *
 * @param value - The stack to analyze.
 * @returns The count of non-push-only opcodes.
 */
export function countNonPushOnlyOPs(value) {
  return value.length - value.filter(isPushOnlyChunk).length;
}
/**
 * Converts a minimal script buffer to its corresponding opcode, if applicable.
 *
 * @param buffer - The buffer to check.
 * @returns The corresponding opcode or undefined if not minimal.
 */
function asMinimalOP(buffer) {
  if (buffer.length === 0) return OPS.OP_0;
  if (buffer.length !== 1) return;
  if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0];
  if (buffer[0] === 0x81) return OPS.OP_1NEGATE;
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
export function compile(chunks) {
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
export function decompile(buffer) {
  if (chunksIsArray(buffer)) return buffer;
  v.parse(types.BufferSchema, buffer);
  const chunks = [];
  let i = 0;
  while (i < buffer.length) {
    const opcode = buffer[i];
    if (opcode > OPS.OP_0 && opcode <= OPS.OP_PUSHDATA4) {
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
export function toASM(chunks) {
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
      return OPS[chunk];
    })
    .join(' ');
}
/**
 * Converts an ASM string to a Buffer.
 * @param asm The ASM string to convert.
 * @returns The converted Buffer.
 */
export function fromASM(asm) {
  v.parse(v.string(), asm);
  // Compile the ASM string into a Uint8Array
  return compile(
    asm.split(' ').map(chunk => {
      // Check if the chunk is an opcode
      if (isNaN(Number(chunk)) && chunk in OPS) {
        return OPS[chunk];
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
export function toStack(chunks) {
  chunks = decompile(chunks);
  v.parse(v.custom(isPushOnly), chunks);
  return chunks.map(op => {
    if (singleChunkIsBuffer(op)) return op;
    if (op === OPS.OP_0) return new Uint8Array(0);
    return scriptNumber.encode(op - OP_INT_BASE);
  });
}
/**
 * Checks if the provided buffer is a canonical public key.
 *
 * @param buffer - The buffer to check, expected to be a Uint8Array.
 * @returns A boolean indicating whether the buffer is a canonical public key.
 */
export function isCanonicalPubKey(buffer) {
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
export function isDefinedHashType(hashType) {
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
export function isCanonicalScriptSignature(buffer) {
  if (!(buffer instanceof Uint8Array)) return false;
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false;
  return bip66.check(buffer.slice(0, -1));
}
export const number = scriptNumber;
export const signature = scriptSignature;
