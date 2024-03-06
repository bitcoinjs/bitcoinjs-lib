import * as bip66 from './bip66';
import { isDefinedHashType } from './script';
import * as types from './types';
const { typeforce } = types;

const ZERO = Buffer.alloc(1, 0);
/**
 * Converts a buffer to a DER-encoded buffer.
 * @param x - The buffer to be converted.
 * @returns The DER-encoded buffer.
 */
function toDER(x: Buffer): Buffer {
  let i = 0;
  while (x[i] === 0) ++i;
  if (i === x.length) return ZERO;
  x = x.slice(i);
  if (x[0] & 0x80) return Buffer.concat([ZERO, x], 1 + x.length);
  return x;
}

/**
 * Converts a DER-encoded signature to a buffer.
 * If the first byte of the input buffer is 0x00, it is skipped.
 * The resulting buffer is 32 bytes long, filled with zeros if necessary.
 * @param x - The DER-encoded signature.
 * @returns The converted buffer.
 */
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
/**
 * Decodes a buffer into a ScriptSignature object.
 * @param buffer - The buffer to decode.
 * @returns The decoded ScriptSignature object.
 * @throws Error if the hashType is invalid.
 */
export function decode(buffer: Buffer): ScriptSignature {
  const hashType = buffer.readUInt8(buffer.length - 1);
  if (!isDefinedHashType(hashType)) {
    throw new Error('Invalid hashType ' + hashType);
  }

  const decoded = bip66.decode(buffer.slice(0, -1));
  const r = fromDER(decoded.r);
  const s = fromDER(decoded.s);
  const signature = Buffer.concat([r, s], 64);

  return { signature, hashType };
}

/**
 * Encodes a signature and hash type into a buffer.
 * @param signature - The signature to encode.
 * @param hashType - The hash type to encode.
 * @returns The encoded buffer.
 * @throws Error if the hashType is invalid.
 */
export function encode(signature: Buffer, hashType: number): Buffer {
  typeforce(
    {
      signature: types.BufferN(64),
      hashType: types.UInt8,
    },
    { signature, hashType },
  );

  if (!isDefinedHashType(hashType)) {
    throw new Error('Invalid hashType ' + hashType);
  }

  const hashTypeBuffer = Buffer.allocUnsafe(1);
  hashTypeBuffer.writeUInt8(hashType, 0);

  const r = toDER(signature.slice(0, 32));
  const s = toDER(signature.slice(32, 64));

  return Buffer.concat([bip66.encode(r, s), hashTypeBuffer]);
}
