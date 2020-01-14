'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bufferutils = require('./bufferutils');
const types = require('./types');
const typeforce = require('typeforce');
const varuint = require('varuint-bitcoin');
/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
class BufferWriter {
  constructor(buffer, offset = 0) {
    typeforce(types.tuple(types.Buffer, types.UInt32), [buffer, offset]);
    this.buffer = buffer;
    this.offset = offset;
  }
  writeUInt8(i) {
    this.offset = this.buffer.writeUInt8(i, this.offset);
  }
  writeInt32(i) {
    this.offset = this.buffer.writeInt32LE(i, this.offset);
  }
  writeUInt32(i) {
    this.offset = this.buffer.writeUInt32LE(i, this.offset);
  }
  writeUInt64(i) {
    this.offset = bufferutils.writeUInt64LE(this.buffer, i, this.offset);
  }
  writeVarInt(i) {
    varuint.encode(i, this.buffer, this.offset);
    this.offset += varuint.encode.bytes;
  }
  writeSlice(slice) {
    this.offset += slice.copy(this.buffer, this.offset);
  }
  writeVarSlice(slice) {
    this.writeVarInt(slice.length);
    this.writeSlice(slice);
  }
  writeVector(vector) {
    this.writeVarInt(vector.length);
    vector.forEach(buf => this.writeVarSlice(buf));
  }
}
exports.BufferWriter = BufferWriter;
