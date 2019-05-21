import * as types from './types';
const bip66 = require('bip66');

const typeforce = require('typeforce');

const ZERO = Buffer.alloc(1, 0);
function toDER(x: Buffer): Buffer {
  let i = 0;
  while (x[i] === 0) ++i;
  if (i === x.length) return ZERO;
  x = x.slice(i);
  if (x[0] & 0x80) return Buffer.concat([ZERO, x], 1 + x.length);
  return x;
}

function fromDER(x: Buffer): Buffer {
  if (x[0] === 0x00) x = x.slice(1);
  const buffer = Buffer.alloc(32, 0);
  const bstart = Math.max(0, 32 - x.length);
  x.copy(buffer, bstart);
  return buffer;
}

interface ScriptSignature {
  signature: Buffer;
  hashType: number;
}

// BIP62: 1 byte hashType flag (only 0x01, 0x02, 0x03, 0x81, 0x82 and 0x83 are allowed)
export function decode(buffer: Buffer): ScriptSignature {
  const hashType = buffer.readUInt8(buffer.length - 1);
  const hashTypeMod = hashType & ~0x80;
  if (hashTypeMod <= 0 || hashTypeMod >= 4)
    throw new Error('Invalid hashType ' + hashType);

  const decoded = bip66.decode(buffer.slice(0, -1));
  const r = fromDER(decoded.r);
  const s = fromDER(decoded.s);
  const signature = Buffer.concat([r, s], 64);

  return { signature, hashType };
}

export function encode(signature: Buffer, hashType: number): Buffer {
  typeforce(
    {
      signature: types.BufferN(64),
      hashType: types.UInt8,
    },
    { signature, hashType },
  );

  const hashTypeMod = hashType & ~0x80;
  if (hashTypeMod <= 0 || hashTypeMod >= 4)
    throw new Error('Invalid hashType ' + hashType);

  const hashTypeBuffer = Buffer.allocUnsafe(1);
  hashTypeBuffer.writeUInt8(hashType, 0);

  const r = toDER(signature.slice(0, 32));
  const s = toDER(signature.slice(32, 64));

  return Buffer.concat([bip66.encode(r, s), hashTypeBuffer]);
}
