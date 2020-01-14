import * as bufferutils from './bufferutils';
import * as types from './types';

const typeforce = require('typeforce');
const varuint = require('varuint-bitcoin');

/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
export class BufferWriter {
  buffer: Buffer;
  offset: number;

  constructor(buffer: Buffer, offset: number = 0) {
    typeforce(types.tuple(types.Buffer, types.UInt32), [buffer, offset]);
    this.buffer = buffer;
    this.offset = offset;
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

  writeUInt64(i: number): void {
    this.offset = bufferutils.writeUInt64LE(this.buffer, i, this.offset);
  }

  writeVarInt(i: number): void {
    varuint.encode(i, this.buffer, this.offset);
    this.offset += varuint.encode.bytes;
  }

  writeSlice(slice: Buffer): void {
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
}
