import { OPS } from './ops';

export function encodingLength(i: number): number {
  return i < OPS.OP_PUSHDATA1 ? 1 : i <= 0xff ? 2 : i <= 0xffff ? 3 : 5;
}

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
