let bip66 = require('bip66')
let Buffer = require('safe-buffer').Buffer
let typeforce = require('typeforce')
let types = require('./types')

let ZERO = Buffer.alloc(1, 0)
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
  let buffer = Buffer.alloc(32, 0)
  let bstart = Math.max(0, 32 - x.length)
  x.copy(buffer, bstart)
  return buffer
}

// BIP62: 1 byte hashType flag (only 0x01, 0x02, 0x03, 0x81, 0x82 and 0x83 are allowed)
function decode (buffer) {
  let hashType = buffer.readUInt8(buffer.length - 1)
  let hashTypeMod = hashType & ~0x80
  if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType)

  let decode = bip66.decode(buffer.slice(0, -1))
  let r = fromDER(decode.r)
  let s = fromDER(decode.s)

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

  let hashTypeMod = hashType & ~0x80
  if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType)

  let hashTypeBuffer = Buffer.allocUnsafe(1)
  hashTypeBuffer.writeUInt8(hashType, 0)

  let r = toDER(signature.slice(0, 32))
  let s = toDER(signature.slice(32, 64))

  return Buffer.concat([
    bip66.encode(r, s),
    hashTypeBuffer
  ])
}

module.exports = {
  decode: decode,
  encode: encode
}
