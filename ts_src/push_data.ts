import { OPS } from './ops';

/**
 * Calculates the encoding length of a number used for push data in Bitcoin transactions.
 * @param i The number to calculate the encoding length for.
 * @returns The encoding length of the number.
 */
export function encodingLength(i: number): number {
  return i < OPS.OP_PUSHDATA1 ? 1 : i <= 0xff ? 2 : i <= 0xffff ? 3 : 5;
}

/**
 * Encodes a number into a buffer using a variable-length encoding scheme.
 * The encoded buffer is written starting at the specified offset.
 * Returns the size of the encoded buffer.
 *
 * @param buffer - The buffer to write the encoded data into.
 * @param num - The number to encode.
 * @param offset - The offset at which to start writing the encoded buffer.
 * @returns The size of the encoded buffer.
 */
export function encode(buffer: Buffer, num: number, offset: number): number {
  const size = encodingLength(num);

  // ~6 bit
  if (size === 1) {
    buffer.writeUInt8(num, offset);

    // 8 bit
  } else if (size === 2) {
    buffer.writeUInt8(OPS.OP_PUSHDATA1, offset);
    buffer.writeUInt8(num, offset + 1);

    // 16 bit
  } else if (size === 3) {
    buffer.writeUInt8(OPS.OP_PUSHDATA2, offset);
    buffer.writeUInt16LE(num, offset + 1);

    // 32 bit
  } else {
    buffer.writeUInt8(OPS.OP_PUSHDATA4, offset);
    buffer.writeUInt32LE(num, offset + 1);
  }

  return size;
}

/**
 * Decodes a buffer and returns information about the opcode, number, and size.
 * @param buffer - The buffer to decode.
 * @param offset - The offset within the buffer to start decoding.
 * @returns An object containing the opcode, number, and size, or null if decoding fails.
 */
export function decode(
  buffer: Buffer,
  offset: number,
): {
  opcode: number;
  number: number;
  size: number;
} | null {
  const opcode = buffer.readUInt8(offset);
  let num: number;
  let size: number;

  // ~6 bit
  if (opcode < OPS.OP_PUSHDATA1) {
    num = opcode;
    size = 1;

    // 8 bit
  } else if (opcode === OPS.OP_PUSHDATA1) {
    if (offset + 2 > buffer.length) return null;
    num = buffer.readUInt8(offset + 1);
    size = 2;

    // 16 bit
  } else if (opcode === OPS.OP_PUSHDATA2) {
    if (offset + 3 > buffer.length) return null;
    num = buffer.readUInt16LE(offset + 1);
    size = 3;

    // 32 bit
  } else {
    if (offset + 5 > buffer.length) return null;
    if (opcode !== OPS.OP_PUSHDATA4) throw new Error('Unexpected opcode');

    num = buffer.readUInt32LE(offset + 1);
    size = 5;
  }

  return {
    opcode,
    number: num,
    size,
  };
}
