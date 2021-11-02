import { Buffer as NBuffer } from 'buffer';
import * as bcrypto from './crypto';
import * as varuint from 'bip174/src/lib/converter/varint';

// Temp, to be replaced
// Only works because bip32 has it as dependecy. Linting will fail.
const ecc = require('tiny-secp256k1');
// todo, use import?
const BN = require('bn.js');

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

// todo review. Do not add dependcy to BN?
const EC_P_BN = new BN(EC_P);
const EC_P_REDUCTION = BN.red(EC_P_BN);
const EC_P_QUADRATIC_RESIDUE = EC_P_BN.addn(1).divn(4);
const BN_2 = new BN(2);
const BN_3 = new BN(3);
const BN_7 = new BN(7);

export function liftX(buffer: Buffer): Buffer | null {
  if (!NBuffer.isBuffer(buffer)) return null;
  if (buffer.length !== 32) return null;

  if (buffer.compare(ZERO32) === 0) return null;
  if (buffer.compare(EC_P) >= 0) return null;

  const x = new BN(buffer);

  const x1 = x.toRed(EC_P_REDUCTION);
  const ySq = x1
    .redPow(BN_3)
    .add(BN_7)
    .mod(EC_P_BN);

  const y = ySq.redPow(EC_P_QUADRATIC_RESIDUE);

  if (!ySq.eq(y.redPow(BN_2))) {
    return null;
  }
  const y1 = y.isEven() ? y : EC_P_BN.sub(y);

  return NBuffer.concat([
    NBuffer.from([0x04]),
    NBuffer.from(x1.toBuffer('be', 32)),
    NBuffer.from(y1.toBuffer('be', 32)),
  ]);
}

const TAP_TWEAK_TAG = NBuffer.from('TapTweak', 'utf8');

const GROUP_ORDER = NBuffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141', 'hex');
// todo: compare buffers dirrectly
const GROUP_ORDER_BN = new BN(GROUP_ORDER);

export function tweakKey(
  pubKey: Buffer,
  h: Buffer | undefined,
): TweakedPublicKey | null {
  if (!NBuffer.isBuffer(pubKey)) return null;
  if (pubKey.length !== 32) return null;
  if (h && h.length !== 32) return null;

  const tweakHash = bcrypto.taggedHash(
    TAP_TWEAK_TAG,
    NBuffer.concat(h ? [pubKey, h] : [pubKey]),
  );
  const t = new BN(tweakHash);
  if (t.gte(GROUP_ORDER_BN)) {
    // todo: add test for this case
    throw new Error('Tweak value over the SECP256K1 Order');
  }

  const P = liftX(pubKey);
  if (P === null) return null;

  const Q = pointAddScalar(P, tweakHash);
  return {
    isOdd: Q[64] % 2 === 1,
    x: Q.slice(1, 33),
  };
}

const TAP_LEAF_TAG = NBuffer.from('TapLeaf', 'utf8');
const TAP_BRANCH_TAG = NBuffer.from('TapBranch', 'utf8');


export function leafHash(script: Buffer, version: number): Buffer {
  return NBuffer.concat([NBuffer.from([version]), serializeScript(script)]);
}

export function rootHash(controlBlock: Buffer, tapLeafMsg: Buffer): Buffer {
  const k = [];
  const e = [];

  const m = (controlBlock.length - 33) / 32;
  k[0] = bcrypto.taggedHash(TAP_LEAF_TAG, tapLeafMsg);

  for (let j = 0; j < m; j++) {
    e[j] = controlBlock.slice(33 + 32 * j, 65 + 32 * j);
    if (k[j].compare(e[j]) < 0) {
      k[j + 1] = bcrypto.taggedHash(TAP_BRANCH_TAG, NBuffer.concat([k[j], e[j]]));
    } else {
      k[j + 1] = bcrypto.taggedHash(TAP_BRANCH_TAG, NBuffer.concat([e[j], k[j]]));
    }
  }

  return k[m]
}

// todo: move out
function serializeScript(s: Buffer) {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = NBuffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return NBuffer.concat([buffer, s])
}

// todo: do not use ecc
function pointAddScalar(P: Buffer, h: Buffer): Buffer {
  return ecc.pointAddScalar(P, h);
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

export interface TweakedPublicKey {
  isOdd: boolean;
  x: Buffer;
}

export const TaprootLeaf = typeforce.compile({
  output: typeforce.BufferN(34),
  version: typeforce.maybe(typeforce.UInt8) // todo: recheck
})

// / todo: revisit
export const TaprootNode = typeforce.arrayOf(typeforce.oneOf(TaprootLeaf, typeforce.arrayOf(TaprootLeaf)))


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
