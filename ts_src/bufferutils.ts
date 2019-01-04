// https://github.com/feross/buffer/blob/master/index.js#L1127
function verifuint (value: number, max: number): void {
  if (typeof value !== 'number') throw new Error('cannot write a non-number as a number')
  if (value < 0) throw new Error('specified a negative value for writing an unsigned value')
  if (value > max) throw new Error('RangeError: value out of range')
  if (Math.floor(value) !== value) throw new Error('value has a fractional component')
}

export function readUInt64LE (buffer: Buffer, offset: number): number {
  const a = buffer.readUInt32LE(offset)
  let b = buffer.readUInt32LE(offset + 4)
  b *= 0x100000000

  verifuint(b + a, 0x001fffffffffffff)
  return b + a
}

export function writeUInt64LE (buffer: Buffer, value: number, offset: number): number {
  verifuint(value, 0x001fffffffffffff)

  buffer.writeInt32LE(value & -1, offset)
  buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 4)
  return offset + 8
}

export function reverseBuffer (buffer: Buffer): Buffer {
  if (buffer.length < 1) return buffer
  let j = buffer.length - 1
  let tmp = 0
  for (let i = 0; i < buffer.length / 2; i++) {
    tmp = buffer[i]
    buffer[i] = buffer[j]
    buffer[j] = tmp
    j--
  }
  return buffer
}
