import * as types from './types.js';
import * as varuint from 'varuint-bitcoin';
import * as v from 'valibot';
export { varuint };
import * as tools from 'uint8array-tools';
const MAX_JS_NUMBER = 0x001fffffffffffff;
// https://github.com/feross/buffer/blob/master/index.js#L1127
function verifuint(value, max) {
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
export function reverseBuffer(buffer) {
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
export function cloneBuffer(buffer) {
  const clone = new Uint8Array(buffer.length);
  clone.set(buffer);
  return clone;
}
/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
export class BufferWriter {
  buffer;
  offset;
  static withCapacity(size) {
    return new BufferWriter(new Uint8Array(size));
  }
  constructor(buffer, offset = 0) {
    this.buffer = buffer;
    this.offset = offset;
    v.parse(v.tuple([types.BufferSchema, types.UInt32Schema]), [
      buffer,
      offset,
    ]);
  }
  writeUInt8(i) {
    this.offset = tools.writeUInt8(this.buffer, this.offset, i);
  }
  writeInt32(i) {
    this.offset = tools.writeInt32(this.buffer, this.offset, i, 'LE');
  }
  writeInt64(i) {
    this.offset = tools.writeInt64(this.buffer, this.offset, BigInt(i), 'LE');
  }
  writeUInt32(i) {
    this.offset = tools.writeUInt32(this.buffer, this.offset, i, 'LE');
  }
  writeUInt64(i) {
    this.offset = tools.writeUInt64(this.buffer, this.offset, BigInt(i), 'LE');
  }
  writeVarInt(i) {
    const { bytes } = varuint.encode(i, this.buffer, this.offset);
    this.offset += bytes;
  }
  writeSlice(slice) {
    if (this.buffer.length < this.offset + slice.length) {
      throw new Error('Cannot write slice out of bounds');
    }
    this.buffer.set(slice, this.offset);
    this.offset += slice.length;
  }
  writeVarSlice(slice) {
    this.writeVarInt(slice.length);
    this.writeSlice(slice);
  }
  writeVector(vector) {
    this.writeVarInt(vector.length);
    vector.forEach(buf => this.writeVarSlice(buf));
  }
  end() {
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
  buffer;
  offset;
  constructor(buffer, offset = 0) {
    this.buffer = buffer;
    this.offset = offset;
    v.parse(v.tuple([types.BufferSchema, types.UInt32Schema]), [
      buffer,
      offset,
    ]);
  }
  readUInt8() {
    const result = tools.readUInt8(this.buffer, this.offset);
    this.offset++;
    return result;
  }
  readInt32() {
    const result = tools.readInt32(this.buffer, this.offset, 'LE');
    this.offset += 4;
    return result;
  }
  readUInt32() {
    const result = tools.readUInt32(this.buffer, this.offset, 'LE');
    this.offset += 4;
    return result;
  }
  readInt64() {
    const result = tools.readInt64(this.buffer, this.offset, 'LE');
    this.offset += 8;
    return result;
  }
  readVarInt() {
    const { bigintValue, bytes } = varuint.decode(this.buffer, this.offset);
    this.offset += bytes;
    return bigintValue;
  }
  readSlice(n) {
    verifuint(n, MAX_JS_NUMBER);
    const num = Number(n);
    if (this.buffer.length < this.offset + num) {
      throw new Error('Cannot read slice out of bounds');
    }
    const result = this.buffer.slice(this.offset, this.offset + num);
    this.offset += num;
    return result;
  }
  readVarSlice() {
    return this.readSlice(this.readVarInt());
  }
  readVector() {
    const count = this.readVarInt();
    const vector = [];
    for (let i = 0; i < count; i++) vector.push(this.readVarSlice());
    return vector;
  }
}
