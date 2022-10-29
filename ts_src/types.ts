import { Buffer as NBuffer } from 'buffer';
export const typeforce = require('typeforce');

const BN_ZERO = BigInt(0);
// Bitcoin uses the secp256k1 curve, whose parameters can be found on
// page 13, section 2.4.1, of https://www.secg.org/sec2-v2.pdf
const EC_P = BigInt(
  `0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f`,
);

// The short Weierstrass form curve equation simplifes to y^2 = x^3 + 7.
function secp256k1Right(x: bigint): bigint {
  const EC_B = BigInt(7);
  const x2 = (x * x) % EC_P;
  const x3 = (x2 * x) % EC_P;
  return (x3 + EC_B) % EC_P;
}

// For prime P, the Jacobi Symbol of 'a' is 1 if and only if 'a' is a quadratic
// residue mod P, ie. there exists a value 'x' for whom x^2 = a.
function jacobiSymbol(a: bigint): -1 | 0 | 1 {
  // Idea from noble-secp256k1, to be nice to bad JS parsers
  const _1n = BigInt(1);
  const _2n = BigInt(2);
  const _3n = BigInt(3);
  const _5n = BigInt(5);
  const _7n = BigInt(7);

  if (a === BN_ZERO) return 0;

  let p = EC_P;
  let sign = 1;
  // This algorithm is fairly heavily optimized, so don't simplify it w/o benchmarking
  for (;;) {
    let and3;
    // Handle runs of zeros efficiently w/o flipping sign each time
    for (and3 = a & _3n; and3 === BN_ZERO; a >>= _2n, and3 = a & _3n);
    // If there's one more zero, shift it off and flip the sign
    if (and3 === _2n) {
      a >>= _1n;
      const pand7 = p & _7n;
      if (pand7 === _3n || pand7 === _5n) sign = -sign;
    }
    if (a === _1n) break;
    if ((_3n & a) === _3n && (_3n & p) === _3n) sign = -sign;
    [a, p] = [p % a, a];
  }
  return sign > 0 ? 1 : -1;
}

export function isPoint(p: Buffer | number | undefined | null): boolean {
  if (!NBuffer.isBuffer(p)) return false;
  if (p.length < 33) return false;

  const t = p[0];
  if (p.length === 33) {
    return (t === 0x02 || t === 0x03) && isXOnlyPoint(p.slice(1));
  }

  if (t !== 0x04 || p.length !== 65) return false;

  const x = BigInt(`0x${p.slice(1, 33).toString('hex')}`);
  if (x === BN_ZERO) return false;
  if (x >= EC_P) return false;

  const y = BigInt(`0x${p.slice(33).toString('hex')}`);
  if (y === BN_ZERO) return false;
  if (y >= EC_P) return false;

  const left = (y * y) % EC_P;
  const right = secp256k1Right(x);
  return left === right;
}

export function isXOnlyPoint(p: Buffer | number | undefined | null): boolean {
  if (!NBuffer.isBuffer(p)) return false;
  if (p.length !== 32) return false;
  const x = BigInt(`0x${p.toString('hex')}`);
  if (x === BN_ZERO) return false;
  if (x >= EC_P) return false;
  const y2 = secp256k1Right(x);
  return jacobiSymbol(y2) === 1; // If sqrt(y^2) exists, x is on the curve.
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

const SATOSHI_MAX: number = 21 * 1e14;
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
