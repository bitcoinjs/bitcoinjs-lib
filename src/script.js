'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const scriptNumber = require('./script_number');
const scriptSignature = require('./script_signature');
const types = require('./types');
const bip66 = require('bip66');
const ecc = require('tiny-secp256k1');
const pushdata = require('pushdata-bitcoin');
const typeforce = require('typeforce');
exports.OPS = require('bitcoin-ops');
const REVERSE_OPS = require('bitcoin-ops/map');
const OP_INT_BASE = exports.OPS.OP_RESERVED; // OP_1 - 1
function isOPInt(value) {
  return (
    types.Number(value) &&
    (value === exports.OPS.OP_0 ||
      (value >= exports.OPS.OP_1 && value <= exports.OPS.OP_16) ||
      value === exports.OPS.OP_1NEGATE)
  );
}
function isPushOnlyChunk(value) {
  return types.Buffer(value) || isOPInt(value);
}
function isPushOnly(value) {
  return types.Array(value) && value.every(isPushOnlyChunk);
}
exports.isPushOnly = isPushOnly;
function asMinimalOP(buffer) {
  if (buffer.length === 0) return exports.OPS.OP_0;
  if (buffer.length !== 1) return;
  if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0];
  if (buffer[0] === 0x81) return exports.OPS.OP_1NEGATE;
}
function chunksIsBuffer(buf) {
  return Buffer.isBuffer(buf);
}
function chunksIsArray(buf) {
  return types.Array(buf);
}
function singleChunkIsBuffer(buf) {
  return Buffer.isBuffer(buf);
}
function compile(chunks) {
  // TODO: remove me
  if (chunksIsBuffer(chunks)) return chunks;
  typeforce(types.Array, chunks);
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
exports.compile = compile;
function decompile(buffer) {
  // TODO: remove me
  if (chunksIsArray(buffer)) return buffer;
  typeforce(types.Buffer, buffer);
  const chunks = [];
  let i = 0;
  while (i < buffer.length) {
    const opcode = buffer[i];
    // data chunk
    if (opcode > exports.OPS.OP_0 && opcode <= exports.OPS.OP_PUSHDATA4) {
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
exports.decompile = decompile;
function toASM(chunks) {
  if (chunksIsBuffer(chunks)) {
    chunks = decompile(chunks);
  }
  return chunks
    .map(chunk => {
      // data?
      if (singleChunkIsBuffer(chunk)) {
        const op = asMinimalOP(chunk);
        if (op === undefined) return chunk.toString('hex');
        chunk = op;
      }
      // opcode!
      return REVERSE_OPS[chunk];
    })
    .join(' ');
}
exports.toASM = toASM;
function fromASM(asm) {
  typeforce(types.String, asm);
  return compile(
    asm.split(' ').map(chunkStr => {
      // opcode?
      if (exports.OPS[chunkStr] !== undefined) return exports.OPS[chunkStr];
      typeforce(types.Hex, chunkStr);
      // data!
      return Buffer.from(chunkStr, 'hex');
    }),
  );
}
exports.fromASM = fromASM;
function toStack(chunks) {
  chunks = decompile(chunks);
  typeforce(isPushOnly, chunks);
  return chunks.map(op => {
    if (singleChunkIsBuffer(op)) return op;
    if (op === exports.OPS.OP_0) return Buffer.allocUnsafe(0);
    return scriptNumber.encode(op - OP_INT_BASE);
  });
}
exports.toStack = toStack;
function isCanonicalPubKey(buffer) {
  return ecc.isPoint(buffer);
}
exports.isCanonicalPubKey = isCanonicalPubKey;
function isDefinedHashType(hashType) {
  const hashTypeMod = hashType & ~0xc0;
  // return hashTypeMod > SIGHASH_ALL && hashTypeMod < SIGHASH_SINGLE
  return hashTypeMod > 0x00 && hashTypeMod < 0x04;
}
exports.isDefinedHashType = isDefinedHashType;
function isCanonicalScriptSignature(buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false;
  return bip66.check(buffer.slice(0, -1));
}
exports.isCanonicalScriptSignature = isCanonicalScriptSignature;
// tslint:disable-next-line variable-name
exports.number = scriptNumber;
exports.signature = scriptSignature;
