const bip66 = require('bip66')
const Buffer = require('safe-buffer').Buffer
const typeforce = require('typeforce')
const types = require('./types')

const ZERO = Buffer.alloc(1, 0)
function toDER (x) {
  let i = 0
  while (x[i] === 0) ++i
  if (i === x.length) return ZERO
  x = x.slice(i)
  if (x[0] & 0x80) return Buffer.concat([ZERO, x], 1 + x.length)
  return x
}

function fromDER (x) {
  if (x[0] === 0x00) x = x.slice(1)
  const buffer = Buffer.alloc(32, 0)
  const bstart = Math.max(0, 32 - x.length)
  x.copy(buffer, bstart)
  return buffer
}

// BIP62: 1 byte hashType flag (only 0x01, 0x02, 0x03, 0x81, 0x82 and 0x83 are allowed)
function decode (buffer) {
  const hashType = buffer.readUInt8(buffer.length - 1)
  const hashTypeMod = hashType & ~0x80
  if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType)

  const decode = bip66.decode(buffer.slice(0, -1))
  const r = fromDER(decode.r)
  const s = fromDER(decode.s)

  return {
    signature: Buffer.concat([r, s], 64),
    hashType: hashType
  }
}

function encode (signature, hashType) {
  typeforce({
    signature: types.BufferN(64),
    hashType: types.UInt8
  }, { signature, hashType })

  const hashTypeMod = hashType & ~0x80
  if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType)

  const hashTypeBuffer = Buffer.allocUnsafe(1)
  hashTypeBuffer.writeUInt8(hashType, 0)

  const r = toDER(signature.slice(0, 32))
  const s = toDER(signature.slice(32, 64))

  return Buffer.concat([
    bip66.encode(r, s),
    hashTypeBuffer
  ])
}

module.exports = {
  decode: decode,
  encode: encode
}
