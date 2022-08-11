import * as types from './types';
const { typeforce } = types;
import * as varuint from 'varuint-bitcoin';
export { varuint };

// https://github.com/feross/buffer/blob/master/index.js#L1127
function verifuint(value: number | bigint, max: number| bigint): void {
  if (typeof value !== 'number' && typeof value !== 'bigint')
    throw new Error('cannot write a non-number as a number or bigint');
  if (value < 0)
    throw new Error('specified a negative value for writing an unsigned value');
  if (value > max) throw new Error('RangeError: value out of range');
  if (typeof value === 'number' && Math.floor(value) !== value)
    // bigint is enforced int
    throw new Error('value has a fractional component');
}

export function readUInt64BigIntLE(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset);
}

export function readUInt64LE(buffer: Buffer, offset: number): number {
  const result = readUInt64BigIntLE(buffer, offset);
  verifuint(result, 0x001fffffffffffff);
  return Number(result);
}

export function writeUInt64LE(
  buffer: Buffer,
  value: number | bigint,
  offset: number,
): number {
  if (typeof value === 'number') {
    verifuint(value, 0x001fffffffffffff);
  } else if (typeof value === 'bigint') {
    verifuint(value, BigInt('0xffffffffffffffff'));
  } else {
    throw new Error('value must be a number or bigint');
  }
  buffer.writeBigUInt64LE(BigInt(value), offset);
  return offset + 8;
}

export function reverseBuffer(buffer: Buffer): Buffer {
  if (buffer.length < 1) return buffer;
  let j = buffer.length - 1;
  let tmp = 0;
  for (let i = 0; i < buffer.length / 2; i++) {
    tmp = buffer[i];
    buffer[i] = buffer[j];
    buffer[j] = tmp;
    j--;
  }
  return buffer;
}

export function cloneBuffer(buffer: Buffer): Buffer {
  const clone = Buffer.allocUnsafe(buffer.length);
  buffer.copy(clone);
  return clone;
}

/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
export class BufferWriter {
  static withCapacity(size: number): BufferWriter {
    return new BufferWriter(Buffer.alloc(size));
  }

  constructor(public buffer: Buffer, public offset: number = 0) {
    typeforce(types.tuple(types.Buffer, types.UInt32), [buffer, offset]);
  }

  writeUInt8(i: number): void {
    this.offset = this.buffer.writeUInt8(i, this.offset);
  }

  writeInt32(i: number): void {
    this.offset = this.buffer.writeInt32LE(i, this.offset);
  }

  writeUInt32(i: number): void {
    this.offset = this.buffer.writeUInt32LE(i, this.offset);
  }

  writeUInt64(i: number | bigint): void {
    this.offset = writeUInt64LE(this.buffer, i, this.offset);
  }

  writeVarInt(i: number): void {
    varuint.encode(i, this.buffer, this.offset);
    this.offset += varuint.encode.bytes;
  }

  writeSlice(slice: Buffer): void {
    if (this.buffer.length < this.offset + slice.length) {
      throw new Error('Cannot write slice out of bounds');
    }
    this.offset += slice.copy(this.buffer, this.offset);
  }

  writeVarSlice(slice: Buffer): void {
    this.writeVarInt(slice.length);
    this.writeSlice(slice);
  }

  writeVector(vector: Buffer[]): void {
    this.writeVarInt(vector.length);
    vector.forEach((buf: Buffer) => this.writeVarSlice(buf));
  }

  end(): Buffer {
    if (this.buffer.length === this.offset) {
      return this.buffer;
    }
    throw new Error(`buffer size ${this.buffer.length}, offset ${this.offset}`);
  }
}

/**
 * Helper class for reading of bitcoin data types from a buffer.
 */
export class BufferReader {
  constructor(public buffer: Buffer, public offset: number = 0) {
    typeforce(types.tuple(types.Buffer, types.UInt32), [buffer, offset]);
  }

  readUInt8(): number {
    const result = this.buffer.readUInt8(this.offset);
    this.offset++;
    return result;
  }

  readInt32(): number {
    const result = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return result;
  }

  readUInt32(): number {
    const result = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return result;
  }

  readUInt64(): number {
    const result = readUInt64LE(this.buffer, this.offset);
    this.offset += 8;
    return result;
  }

  readUInt64BigInt(): bigint {
    const result = readUInt64BigIntLE(this.buffer, this.offset);
    this.offset += 8;
    return result;
  }

  readVarInt(): number {
    const vi = varuint.decode(this.buffer, this.offset);
    this.offset += varuint.decode.bytes;
    return vi;
  }

  readSlice(n: number): Buffer {
    if (this.buffer.length < this.offset + n) {
      throw new Error('Cannot read slice out of bounds');
    }
    const result = this.buffer.slice(this.offset, this.offset + n);
    this.offset += n;
    return result;
  }

  readVarSlice(): Buffer {
    return this.readSlice(this.readVarInt());
  }

  readVector(): Buffer[] {
    const count = this.readVarInt();
    const vector: Buffer[] = [];
    for (let i = 0; i < count; i++) vector.push(this.readVarSlice());
    return vector;
  }
}
