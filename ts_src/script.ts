/**
 * Script tools, including decompile, compile, toASM, fromASM, toStack, isCanonicalPubKey, isCanonicalScriptSignature
 * @packageDocumentation
 */
import * as bip66 from './bip66';
import { OPS, REVERSE_OPS } from './ops';
import { Stack } from './payments';
import * as pushdata from './push_data';
import * as scriptNumber from './script_number';
import * as scriptSignature from './script_signature';
import * as types from './types';
const { typeforce } = types;

const OP_INT_BASE = OPS.OP_RESERVED; // OP_1 - 1
export { OPS };

function isOPInt(value: number): boolean {
  return (
    types.Number(value) &&
    (value === OPS.OP_0 ||
      (value >= OPS.OP_1 && value <= OPS.OP_16) ||
      value === OPS.OP_1NEGATE)
  );
}

function isPushOnlyChunk(value: number | Buffer): boolean {
  return types.Buffer(value) || isOPInt(value as number);
}

export function isPushOnly(value: Stack): boolean {
  return types.Array(value) && value.every(isPushOnlyChunk);
}

export function countNonPushOnlyOPs(value: Stack): number {
  return value.length - value.filter(isPushOnlyChunk).length;
}

function asMinimalOP(buffer: Buffer): number | void {
  if (buffer.length === 0) return OPS.OP_0;
  if (buffer.length !== 1) return;
  if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0];
  if (buffer[0] === 0x81) return OPS.OP_1NEGATE;
}

function chunksIsBuffer(buf: Buffer | Stack): buf is Buffer {
  return Buffer.isBuffer(buf);
}

function chunksIsArray(buf: Buffer | Stack): buf is Stack {
  return types.Array(buf);
}

function singleChunkIsBuffer(buf: number | Buffer): buf is Buffer {
  return Buffer.isBuffer(buf);
}

/**
 * Compiles an array of chunks into a Buffer.
 *
 * @param chunks - The array of chunks to compile.
 * @returns The compiled Buffer.
 * @throws Error if the compilation fails.
 */
export function compile(chunks: Buffer | Stack): Buffer {
  // TODO: remove me
  if (chunksIsBuffer(chunks)) return chunks;

  typeforce(types.Array, chunks);

  const bufferSize = chunks.reduce((accum: number, chunk) => {
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

  const buffer = Buffer.allocUnsafe(bufferSize);
  let offset = 0;

  chunks.forEach(chunk => {
    // data chunk
    if (singleChunkIsBuffer(chunk)) {
      // adhere to BIP62.3, minimal push policy
      const opcode = asMinimalOP(chunk);
      if (opcode !== undefined) {
        buffer.writeUInt8(opcode, offset);
        offset += 1;
        return;
      }

      offset += pushdata.encode(buffer, chunk.length, offset);
      chunk.copy(buffer, offset);
      offset += chunk.length;

      // opcode
    } else {
      buffer.writeUInt8(chunk, offset);
      offset += 1;
    }
  });

  if (offset !== buffer.length) throw new Error('Could not decode chunks');
  return buffer;
}

export function decompile(buffer: Buffer | Array<number | Buffer>): Stack {
  if (chunksIsArray(buffer)) return buffer;

  typeforce(types.Buffer, buffer);

  const chunks: Array<number | Buffer> = [];
  let i = 0;

  while (i < buffer.length) {
    const opcode = buffer[i];

    // data chunk
    if (opcode > OPS.OP_0 && opcode <= OPS.OP_PUSHDATA4) {
      const d = pushdata.decode(buffer, i);

      // did reading a pushDataInt fail?
      if (d === null) return [];
      i += d.size;

      // attempt to read too much data?
      if (i + d.number > buffer.length) return [];

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
export function toASM(chunks: Buffer | Array<number | Buffer>): string {
  if (chunksIsBuffer(chunks)) {
    chunks = decompile(chunks);
  }

  return chunks
    .map(chunk => {
      // data?
      if (singleChunkIsBuffer(chunk)) {
        const op = asMinimalOP(chunk);
        if (op === undefined) return chunk.toString('hex');
        chunk = op as number;
      }

      // opcode!
      return REVERSE_OPS[chunk];
    })
    .join(' ');
}

/**
 * Converts an ASM string to a Buffer.
 * @param asm The ASM string to convert.
 * @returns The converted Buffer.
 */
export function fromASM(asm: string): Buffer {
  typeforce(types.String, asm);

  return compile(
    asm.split(' ').map(chunkStr => {
      // opcode?
      if (OPS[chunkStr] !== undefined) return OPS[chunkStr];
      typeforce(types.Hex, chunkStr);

      // data!
      return Buffer.from(chunkStr, 'hex');
    }),
  );
}

/**
 * Converts the given chunks into a stack of buffers.
 *
 * @param chunks - The chunks to convert.
 * @returns The stack of buffers.
 */
export function toStack(chunks: Buffer | Array<number | Buffer>): Buffer[] {
  chunks = decompile(chunks);
  typeforce(isPushOnly, chunks);

  return chunks.map(op => {
    if (singleChunkIsBuffer(op)) return op;
    if (op === OPS.OP_0) return Buffer.allocUnsafe(0);

    return scriptNumber.encode(op - OP_INT_BASE);
  });
}

export function isCanonicalPubKey(buffer: Buffer): boolean {
  return types.isPoint(buffer);
}

export function isDefinedHashType(hashType: number): boolean {
  const hashTypeMod = hashType & ~0x80;

  // return hashTypeMod > SIGHASH_ALL && hashTypeMod < SIGHASH_SINGLE
  return hashTypeMod > 0x00 && hashTypeMod < 0x04;
}

export function isCanonicalScriptSignature(buffer: Buffer): boolean {
  if (!Buffer.isBuffer(buffer)) return false;
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false;

  return bip66.check(buffer.slice(0, -1));
}

export const number = scriptNumber;
export const signature = scriptSignature;
