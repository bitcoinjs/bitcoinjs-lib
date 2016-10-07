var typeforce = require('typeforce')

var UINT31_MAX = Math.pow(2, 31) - 1
function UInt2 (value) { return (value & 3) === value }
function UInt31 (value) {
  return typeforce.UInt32(value) && value <= UINT31_MAX
}

var SATOSHI_MAX = 2.1 * 1e15
function Satoshi (value) {
  return typeforce.UInt53(value) && value <= SATOSHI_MAX
}

function Bip32Path (value) {
  return typeforce.String(value) &&
    value.match(/^(m\/)?(\d+'?\/)*\d+'?$/)
}

// external dependent types
var BigInt = typeforce.quacksLike('BigInteger')
var ECPoint = typeforce.quacksLike('Point')

// exposed, external API
var ECSignature = typeforce.compile({ r: BigInt, s: BigInt })
var Network = typeforce.compile({
  messagePrefix: typeforce.oneOf(typeforce.Buffer, typeforce.String),
  bip32: {
    public: typeforce.UInt32,
    private: typeforce.UInt32
  },
  pubKeyHash: typeforce.UInt8,
  scriptHash: typeforce.UInt8,
  wif: typeforce.UInt8,
  dustThreshold: Satoshi
})

// extend typeforce types with ours
var types = {
  BigInt: BigInt,
  Buffer256bit: typeforce.BufferN(32),
  ECPoint: ECPoint,
  ECSignature: ECSignature,
  Hash160bit: typeforce.BufferN(20),
  Hash256bit: typeforce.BufferN(32),
  Network: Network,
  Satoshi: Satoshi,
  UInt2: UInt2,
  UInt31: UInt31,
  Bip32Path: Bip32Path
}

for (var typeName in typeforce) {
  types[typeName] = typeforce[typeName]
}

module.exports = types
