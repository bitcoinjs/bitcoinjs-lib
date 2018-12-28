const typeforce = require('typeforce')

const UINT31_MAX: number = Math.pow(2, 31) - 1
export function UInt31 (value: number): boolean {
  return typeforce.UInt32(value) && value <= UINT31_MAX
}

export function BIP32Path (value: string): boolean {
  return typeforce.String(value) && !!value.match(/^(m\/)?(\d+'?\/)*\d+'?$/)
}
BIP32Path.toJSON = function () { return 'BIP32 derivation path' }

const SATOSHI_MAX: number = 21 * 1e14
export function Satoshi (value: number): boolean {
  return typeforce.UInt53(value) && value <= SATOSHI_MAX
}

// external dependent types
export const ECPoint = typeforce.quacksLike('Point')

// exposed, external API
export const Network = typeforce.compile({
  messagePrefix: typeforce.oneOf(typeforce.Buffer, typeforce.String),
  bip32: {
    public: typeforce.UInt32,
    private: typeforce.UInt32
  },
  pubKeyHash: typeforce.UInt8,
  scriptHash: typeforce.UInt8,
  wif: typeforce.UInt8
})

export const Buffer256bit = typeforce.BufferN(32)
export const Hash160bit = typeforce.BufferN(20)
export const Hash256bit = typeforce.BufferN(32)
export * from 'typeforce'
export { Number, Array } from 'typeforce'
