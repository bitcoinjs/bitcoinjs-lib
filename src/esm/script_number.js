import * as tools from 'uint8array-tools';
/**
 * Decodes a script number from a buffer.
 *
 * @param buffer - The buffer containing the script number.
 * @param maxLength - The maximum length of the script number. Defaults to 4.
 * @param minimal - Whether the script number should be minimal. Defaults to true.
 * @returns The decoded script number.
 * @throws {TypeError} If the script number overflows the maximum length.
 * @throws {Error} If the script number is not minimally encoded when minimal is true.
 */
export function decode(buffer, maxLength, minimal) {
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
    const a = tools.readUInt32(buffer, 0, 'LE');
    const b = tools.readUInt8(buffer, 4);
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
/**
 * Encodes a number into a Uint8Array using a specific format.
 *
 * @param _number - The number to encode.
 * @returns The encoded number as a Uint8Array.
 */
export function encode(_number) {
  let value = Math.abs(_number);
  const size = scriptNumSize(value);
  const buffer = new Uint8Array(size);
  const negative = _number < 0;
  for (let i = 0; i < size; ++i) {
    tools.writeUInt8(buffer, i, value & 0xff);
    value >>= 8;
  }
  if (buffer[size - 1] & 0x80) {
    tools.writeUInt8(buffer, size - 1, negative ? 0x80 : 0x00);
  } else if (negative) {
    buffer[size - 1] |= 0x80;
  }
  return buffer;
}
