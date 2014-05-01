var assert = require('assert')

function readUInt64LE(buffer, offset) {
  var a = buffer.readUInt32LE(offset)
  var b = buffer.readUInt32LE(offset + 4)
  b *= 0x100000000

  // Javascript Safe Integer limitation
  // assert(Number.isSafeInteger(value), 'value must be < 2^53')
  assert(b + a < 0x0020000000000000, 'value must be < 2^53')

  return b + a
}

function readVarInt(buffer, offset) {
  var t = buffer.readUInt8(offset)
  var number, size

  // 8-bit
  if (t < 253) {
    number = t
    size = 1

  // 16-bit
  } else if (t < 254) {
    number = buffer.readUInt16LE(offset + 1)
    size = 3

  // 32-bit
  } else if (t < 255) {
    number = buffer.readUInt32LE(offset + 1)
    size = 5

  // 64 bit
  } else {
    number = readUInt64LE(buffer, offset + 1)
    size = 9
  }

  return {
    number: number,
    size: size
  }
}

function writeUInt64LE(buffer, value, offset) {
  // Javascript Safe Integer limitation
  // assert(Number.isSafeInteger(value), 'value must be < 2^53')
  assert(value < 0x0020000000000000, 'value must be < 2^53')

  buffer.writeInt32LE(value & -1, offset)
  buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 4)
}

function varIntSize(i) {
  return i < 253      ? 1
    : i < 0x10000     ? 3
    : i < 0x100000000 ? 5
    :                   9
}

function writeVarInt(buffer, number, offset) {
  var size = varIntSize(number)

  // 8 bit
  if (size === 1) {
    buffer.writeUInt8(number, offset)

  // 16 bit
  } else if (size === 3) {
    buffer.writeUInt8(253, offset)
    buffer.writeUInt16LE(number, offset + 1)

  // 32 bit
  } else if (size === 5) {
    buffer.writeUInt8(254, offset)
    buffer.writeUInt32LE(number, offset + 1)

  // 64 bit
  } else {
    buffer.writeUInt8(255, offset)
    writeUInt64LE(buffer, number, offset + 1)
  }

  return size
}

module.exports = {
  readUInt64LE: readUInt64LE,
  readVarInt: readVarInt,
  varIntSize: varIntSize,
  writeUInt64LE: writeUInt64LE,
  writeVarInt: writeVarInt
}
