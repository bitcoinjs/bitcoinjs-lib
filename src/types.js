var typeforce = require('typeforce')

function nBuffer (value, n) {
  typeforce(types.Buffer, value)
  if (value.length !== n) throw new typeforce.TfTypeError('Expected ' + (n * 8) + '-bit Buffer, got ' + (value.length * 8) + '-bit Buffer')

  return true
}

function Hash160bit (value) { return nBuffer(value, 20) }
function Hash256bit (value) { return nBuffer(value, 32) }
function Buffer256bit (value) { return nBuffer(value, 32) }

var UINT53_MAX = Math.pow(2, 53) - 1
var UINT31_MAX = Math.pow(2, 31) - 1
function UInt2 (value) { return (value & 3) === value }
function UInt8 (value) { return (value & 0xff) === value }
function UInt32 (value) { return (value >>> 0) === value }
function UInt31 (value) {
  return UInt32(value) && value <= UINT31_MAX
}
function UInt53 (value) {
  return typeforce.Number(value) &&
    value >= 0 &&
    value <= UINT53_MAX &&
    Math.floor(value) === value
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
    public: UInt32,
    private: UInt32
  },
  pubKeyHash: UInt8,
  scriptHash: UInt8,
  wif: UInt8,
  dustThreshold: UInt53
})

// extend typeforce types with ours
var types = {
  BigInt: BigInt,
  Buffer256bit: Buffer256bit,
  ECPoint: ECPoint,
  ECSignature: ECSignature,
  Hash160bit: Hash160bit,
  Hash256bit: Hash256bit,
  Network: Network,
  UInt2: UInt2,
  UInt8: UInt8,
  UInt31: UInt31,
  UInt32: UInt32,
  UInt53: UInt53,
  Bip32Path: Bip32Path
}

for (var typeName in typeforce) {
  types[typeName] = typeforce[typeName]
}

module.exports = types
