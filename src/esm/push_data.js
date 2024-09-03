import { OPS } from './ops.js';
import * as tools from 'uint8array-tools';
/**
 * Calculates the encoding length of a number used for push data in Bitcoin transactions.
 * @param i The number to calculate the encoding length for.
 * @returns The encoding length of the number.
 */
export function encodingLength(i) {
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
export function encode(buffer, num, offset) {
  const size = encodingLength(num);
  // ~6 bit
  if (size === 1) {
    tools.writeUInt8(buffer, offset, num);
    // 8 bit
  } else if (size === 2) {
    tools.writeUInt8(buffer, offset, OPS.OP_PUSHDATA1);
    tools.writeUInt8(buffer, offset + 1, num);
    // 16 bit
  } else if (size === 3) {
    tools.writeUInt8(buffer, offset, OPS.OP_PUSHDATA2);
    tools.writeUInt16(buffer, offset + 1, num, 'LE');
    // 32 bit
  } else {
    tools.writeUInt8(buffer, offset, OPS.OP_PUSHDATA4);
    tools.writeUInt32(buffer, offset + 1, num, 'LE');
  }
  return size;
}
/**
 * Decodes a buffer and returns information about the opcode, number, and size.
 * @param buffer - The buffer to decode.
 * @param offset - The offset within the buffer to start decoding.
 * @returns An object containing the opcode, number, and size, or null if decoding fails.
 */
export function decode(buffer, offset) {
  const opcode = tools.readUInt8(buffer, offset);
  let num;
  let size;
  // ~6 bit
  if (opcode < OPS.OP_PUSHDATA1) {
    num = opcode;
    size = 1;
    // 8 bit
  } else if (opcode === OPS.OP_PUSHDATA1) {
    if (offset + 2 > buffer.length) return null;
    num = tools.readUInt8(buffer, offset + 1);
    size = 2;
    // 16 bit
  } else if (opcode === OPS.OP_PUSHDATA2) {
    if (offset + 3 > buffer.length) return null;
    num = tools.readUInt16(buffer, offset + 1, 'LE');
    size = 3;
    // 32 bit
  } else {
    if (offset + 5 > buffer.length) return null;
    if (opcode !== OPS.OP_PUSHDATA4) throw new Error('Unexpected opcode');
    num = tools.readUInt32(buffer, offset + 1, 'LE');
    size = 5;
  }
  return {
    opcode,
    number: num,
    size,
  };
}
