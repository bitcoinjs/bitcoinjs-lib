'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const typeforce = require('typeforce');
const UINT31_MAX = Math.pow(2, 31) - 1;
function UInt31(value) {
  return typeforce.UInt32(value) && value <= UINT31_MAX;
}
exports.UInt31 = UInt31;
function BIP32Path(value) {
  return typeforce.String(value) && !!value.match(/^(m\/)?(\d+'?\/)*\d+'?$/);
}
exports.BIP32Path = BIP32Path;
BIP32Path.toJSON = () => {
  return 'BIP32 derivation path';
};
function Signer(obj) {
  return (
    (typeforce.Buffer(obj.publicKey) ||
      typeof obj.getPublicKey === 'function') &&
    typeof obj.sign === 'function'
  );
}
exports.Signer = Signer;
const SATOSHI_MAX = 21 * 1e14;
function Satoshi(value) {
  return typeforce.UInt53(value) && value <= SATOSHI_MAX;
}
exports.Satoshi = Satoshi;
// external dependent types
exports.ECPoint = typeforce.quacksLike('Point');
// exposed, external API
exports.Network = typeforce.compile({
  messagePrefix: typeforce.oneOf(typeforce.Buffer, typeforce.String),
  bip32: {
    public: typeforce.UInt32,
    private: typeforce.UInt32,
  },
  pubKeyHash: typeforce.UInt8,
  scriptHash: typeforce.UInt8,
  wif: typeforce.UInt8,
});
exports.Buffer256bit = typeforce.BufferN(32);
exports.Hash160bit = typeforce.BufferN(20);
exports.Hash256bit = typeforce.BufferN(32);
exports.Number = typeforce.Number; // tslint:disable-line variable-name
exports.Array = typeforce.Array;
exports.Boolean = typeforce.Boolean; // tslint:disable-line variable-name
exports.String = typeforce.String; // tslint:disable-line variable-name
exports.Buffer = typeforce.Buffer;
exports.Hex = typeforce.Hex;
exports.maybe = typeforce.maybe;
exports.tuple = typeforce.tuple;
exports.UInt8 = typeforce.UInt8;
exports.UInt32 = typeforce.UInt32;
exports.Function = typeforce.Function;
exports.BufferN = typeforce.BufferN;
exports.Null = typeforce.Null;
exports.oneOf = typeforce.oneOf;
