'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.encode = exports.decode = void 0;
function decode(buffer, maxLength, minimal) {
  maxLength = maxLength || 4;
  minimal = minimal === undefined ? true : minimal;
  const length = buffer.length;
  if (length === 0) return 0;
  if (length > maxLength) throw new TypeError('Script number overflow');
  if (minimal) {
    if ((buffer[length - 1] & 0x7f) === 0) {
      if (length <= 1 || (buffer[length - 2] & 0x80) === 0)
        throw new Error('Non-minimally encoded script number');
    }
  }
  // 40-bit
  if (length === 5) {
    const a = buffer.readUInt32LE(0);
    const b = buffer.readUInt8(4);
    if (b & 0x80) return -((b & ~0x80) * 0x100000000 + a);
    return b * 0x100000000 + a;
  }
  // 32-bit / 24-bit / 16-bit / 8-bit
  let result = 0;
  for (let i = 0; i < length; ++i) {
    result |= buffer[i] << (8 * i);
  }
  if (buffer[length - 1] & 0x80)
    return -(result & ~(0x80 << (8 * (length - 1))));
  return result;
}
exports.decode = decode;
function scriptNumSize(i) {
  return i > 0x7fffffff
    ? 5
    : i > 0x7fffff
    ? 4
    : i > 0x7fff
    ? 3
    : i > 0x7f
    ? 2
    : i > 0x00
    ? 1
    : 0;
}
function encode(_number) {
  let value = Math.abs(_number);
  const size = scriptNumSize(value);
  const buffer = Buffer.allocUnsafe(size);
  const negative = _number < 0;
  for (let i = 0; i < size; ++i) {
    buffer.writeUInt8(value & 0xff, i);
    value >>= 8;
  }
  if (buffer[size - 1] & 0x80) {
    buffer.writeUInt8(negative ? 0x80 : 0x00, size - 1);
  } else if (negative) {
    buffer[size - 1] |= 0x80;
  }
  return buffer;
}
exports.encode = encode;
