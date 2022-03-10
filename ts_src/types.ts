import { Buffer as NBuffer } from 'buffer';
export const typeforce = require('typeforce');

const ZERO32 = NBuffer.alloc(32, 0);
const EC_P = NBuffer.from(
  'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
  'hex',
);
export function isPoint(p: Buffer | number | undefined | null): boolean {
  if (!NBuffer.isBuffer(p)) return false;
  if (p.length < 33) return false;

  const t = p[0];
  const x = p.slice(1, 33);
  if (x.compare(ZERO32) === 0) return false;
  if (x.compare(EC_P) >= 0) return false;
  if ((t === 0x02 || t === 0x03) && p.length === 33) {
    return true;
  }

  const y = p.slice(33);
  if (y.compare(ZERO32) === 0) return false;
  if (y.compare(EC_P) >= 0) return false;
  if (t === 0x04 && p.length === 65) return true;
  return false;
}

const UINT31_MAX: number = Math.pow(2, 31) - 1;
export function UInt31(value: number): boolean {
  return typeforce.UInt32(value) && value <= UINT31_MAX;
}

export function BIP32Path(value: string): boolean {
  return typeforce.String(value) && !!value.match(/^(m\/)?(\d+'?\/)*\d+'?$/);
}
BIP32Path.toJSON = (): string => {
  return 'BIP32 derivation path';
};

export function Signer(obj: any): boolean {
  return (
    (typeforce.Buffer(obj.publicKey) ||
      typeof obj.getPublicKey === 'function') &&
    typeof obj.sign === 'function'
  );
}

const SATOSHI_MAX: number = 105 * 1e14;
export function Satoshi(value: number): boolean {
  return typeforce.UInt53(value) && value <= SATOSHI_MAX;
}

// external dependent types
export const ECPoint = typeforce.quacksLike('Point');

// exposed, external API
export const Network = typeforce.compile({
  messagePrefix: typeforce.oneOf(typeforce.Buffer, typeforce.String),
  bip32: {
    public: typeforce.UInt32,
    private: typeforce.UInt32,
  },
  pubKeyHash: typeforce.UInt8,
  scriptHash: typeforce.UInt8,
  wif: typeforce.UInt8,
});

export const Buffer256bit = typeforce.BufferN(32);
export const Hash160bit = typeforce.BufferN(20);
export const Hash256bit = typeforce.BufferN(32);
export const Number = typeforce.Number; // tslint:disable-line variable-name
export const Array = typeforce.Array;
export const Boolean = typeforce.Boolean; // tslint:disable-line variable-name
export const String = typeforce.String; // tslint:disable-line variable-name
export const Buffer = typeforce.Buffer;
export const Hex = typeforce.Hex;
export const maybe = typeforce.maybe;
export const tuple = typeforce.tuple;
export const UInt8 = typeforce.UInt8;
export const UInt32 = typeforce.UInt32;
export const Function = typeforce.Function;
export const BufferN = typeforce.BufferN;
export const Null = typeforce.Null;
export const oneOf = typeforce.oneOf;
