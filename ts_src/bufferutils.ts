import * as types from './types.js';
import * as varuint from 'varuint-bitcoin';
import * as v from 'valibot';
export { varuint };
import * as tools from 'uint8array-tools';

const MAX_JS_NUMBER = 0x001fffffffffffff;

// https://github.com/feross/buffer/blob/master/index.js#L1127
function verifuint(value: number | bigint, max: number): void {
  if (typeof value !== 'number' && typeof value !== 'bigint')
    throw new Error('cannot write a non-number as a number');
  if (value < 0 && value < BigInt(0))
    throw new Error('specified a negative value for writing an unsigned value');
  if (value > max && value > BigInt(max))
    throw new Error('RangeError: value out of range');
  if (Math.floor(Number(value)) !== Number(value))
    throw new Error('value has a fractional component');
}

/**
 * Reverses the order of bytes in a buffer.
 * @param buffer - The buffer to reverse.
 * @returns A new buffer with the bytes reversed.
 */
export function reverseBuffer(buffer: Uint8Array): Uint8Array {
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

export function cloneBuffer(buffer: Uint8Array): Uint8Array {
  const clone = new Uint8Array(buffer.length);
  clone.set(buffer);
  return clone;
}

/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
export class BufferWriter {
  static withCapacity(size: number): BufferWriter {
    return new BufferWriter(new Uint8Array(size));
  }

  constructor(
    public buffer: Uint8Array,
    public offset: number = 0,
  ) {
    v.parse(v.tuple([types.BufferSchema, types.UInt32Schema]), [
      buffer,
      offset,
    ]);
  }

  writeUInt8(i: number): void {
    this.offset = tools.writeUInt8(this.buffer, this.offset, i);
  }

  writeInt32(i: number): void {
    this.offset = tools.writeInt32(this.buffer, this.offset, i, 'LE');
  }

  writeInt64(i: number | bigint): void {
    this.offset = tools.writeInt64(this.buffer, this.offset, BigInt(i), 'LE');
  }

  writeUInt32(i: number): void {
    this.offset = tools.writeUInt32(this.buffer, this.offset, i, 'LE');
  }

  writeUInt64(i: number | bigint): void {
    this.offset = tools.writeUInt64(this.buffer, this.offset, BigInt(i), 'LE');
  }

  writeVarInt(i: number): void {
    const { bytes } = varuint.encode(i, this.buffer, this.offset);
    this.offset += bytes;
  }

  writeSlice(slice: Uint8Array): void {
    if (this.buffer.length < this.offset + slice.length) {
      throw new Error('Cannot write slice out of bounds');
    }
    this.buffer.set(slice, this.offset);
    this.offset += slice.length;
  }

  writeVarSlice(slice: Uint8Array): void {
    this.writeVarInt(slice.length);
    this.writeSlice(slice);
  }

  writeVector(vector: Uint8Array[]): void {
    this.writeVarInt(vector.length);
    vector.forEach((buf: Uint8Array) => this.writeVarSlice(buf));
  }

  end(): Uint8Array {
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
  constructor(
    public buffer: Uint8Array,
    public offset: number = 0,
  ) {
    v.parse(v.tuple([types.BufferSchema, types.UInt32Schema]), [
      buffer,
      offset,
    ]);
  }

  readUInt8(): number {
    const result = tools.readUInt8(this.buffer, this.offset);
    this.offset++;
    return result;
  }

  readInt32(): number {
    const result = tools.readInt32(this.buffer, this.offset, 'LE');
    this.offset += 4;
    return result;
  }

  readUInt32(): number {
    const result = tools.readUInt32(this.buffer, this.offset, 'LE');
    this.offset += 4;
    return result;
  }

  readInt64(): bigint {
    const result = tools.readInt64(this.buffer, this.offset, 'LE');
    this.offset += 8;
    return result;
  }

  readVarInt(): bigint {
    const { bigintValue, bytes } = varuint.decode(this.buffer, this.offset);
    this.offset += bytes;
    return bigintValue;
  }

  readSlice(n: number | bigint): Uint8Array {
    verifuint(n, MAX_JS_NUMBER);
    const num = Number(n);
    if (this.buffer.length < this.offset + num) {
      throw new Error('Cannot read slice out of bounds');
    }
    const result = this.buffer.slice(this.offset, this.offset + num);
    this.offset += num;
    return result;
  }

  readVarSlice(): Uint8Array {
    return this.readSlice(this.readVarInt());
  }

  readVector(): Uint8Array[] {
    const count = this.readVarInt();
    const vector: Uint8Array[] = [];
    for (let i = 0; i < count; i++) vector.push(this.readVarSlice());
    return vector;
  }
}
