'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.oneOf = exports.Null = exports.BufferN = exports.Function = exports.UInt32 = exports.UInt8 = exports.tuple = exports.maybe = exports.Hex = exports.Buffer = exports.String = exports.Boolean = exports.Array = exports.Number = exports.Hash256bit = exports.Hash160bit = exports.Buffer256bit = exports.TaprootNode = exports.TaprootLeaf = exports.Network = exports.ECPoint = exports.Satoshi = exports.Signer = exports.BIP32Path = exports.UInt31 = exports.rootHash = exports.leafHash = exports.tweakKey = exports.liftX = exports.isPoint = exports.typeforce = void 0;
const buffer_1 = require('buffer');
const bcrypto = require('./crypto');
const varuint = require('bip174/src/lib/converter/varint');
// Temp, to be replaced
// Only works because bip32 has it as dependecy. Linting will fail.
const ecc = require('tiny-secp256k1');
// todo, use import?
const BN = require('bn.js');
exports.typeforce = require('typeforce');
const ZERO32 = buffer_1.Buffer.alloc(32, 0);
const EC_P = buffer_1.Buffer.from(
  'fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f',
  'hex',
);
function isPoint(p) {
  if (!buffer_1.Buffer.isBuffer(p)) return false;
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
exports.isPoint = isPoint;
// todo review. Do not add dependcy to BN?
const EC_P_BN = new BN(EC_P);
const EC_P_REDUCTION = BN.red(EC_P_BN);
const EC_P_QUADRATIC_RESIDUE = EC_P_BN.addn(1).divn(4);
const BN_2 = new BN(2);
const BN_3 = new BN(3);
const BN_7 = new BN(7);
function liftX(buffer) {
  if (!buffer_1.Buffer.isBuffer(buffer)) return null;
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
  return buffer_1.Buffer.concat([
    buffer_1.Buffer.from([0x04]),
    buffer_1.Buffer.from(x1.toBuffer('be', 32)),
    buffer_1.Buffer.from(y1.toBuffer('be', 32)),
  ]);
}
exports.liftX = liftX;
const TAP_TWEAK_TAG = buffer_1.Buffer.from('TapTweak', 'utf8');
const GROUP_ORDER = buffer_1.Buffer.from(
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  'hex',
);
// todo: compare buffers dirrectly
const GROUP_ORDER_BN = new BN(GROUP_ORDER);
function tweakKey(pubKey, h) {
  if (!buffer_1.Buffer.isBuffer(pubKey)) return null;
  if (pubKey.length !== 32) return null;
  if (h && h.length !== 32) return null;
  const tweakHash = bcrypto.taggedHash(
    TAP_TWEAK_TAG,
    buffer_1.Buffer.concat(h ? [pubKey, h] : [pubKey]),
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
exports.tweakKey = tweakKey;
const TAP_LEAF_TAG = buffer_1.Buffer.from('TapLeaf', 'utf8');
const TAP_BRANCH_TAG = buffer_1.Buffer.from('TapBranch', 'utf8');
function leafHash(script, version) {
  return buffer_1.Buffer.concat([
    buffer_1.Buffer.from([version]),
    serializeScript(script),
  ]);
}
exports.leafHash = leafHash;
function rootHash(controlBlock, tapLeafMsg) {
  const k = [];
  const e = [];
  const m = (controlBlock.length - 33) / 32;
  k[0] = bcrypto.taggedHash(TAP_LEAF_TAG, tapLeafMsg);
  for (let j = 0; j < m; j++) {
    e[j] = controlBlock.slice(33 + 32 * j, 65 + 32 * j);
    if (k[j].compare(e[j]) < 0) {
      k[j + 1] = bcrypto.taggedHash(
        TAP_BRANCH_TAG,
        buffer_1.Buffer.concat([k[j], e[j]]),
      );
    } else {
      k[j + 1] = bcrypto.taggedHash(
        TAP_BRANCH_TAG,
        buffer_1.Buffer.concat([e[j], k[j]]),
      );
    }
  }
  return k[m];
}
exports.rootHash = rootHash;
// todo: move out
function serializeScript(s) {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = buffer_1.Buffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return buffer_1.Buffer.concat([buffer, s]);
}
// todo: do not use ecc
function pointAddScalar(P, h) {
  return ecc.pointAddScalar(P, h);
}
const UINT31_MAX = Math.pow(2, 31) - 1;
function UInt31(value) {
  return exports.typeforce.UInt32(value) && value <= UINT31_MAX;
}
exports.UInt31 = UInt31;
function BIP32Path(value) {
  return (
    exports.typeforce.String(value) && !!value.match(/^(m\/)?(\d+'?\/)*\d+'?$/)
  );
}
exports.BIP32Path = BIP32Path;
BIP32Path.toJSON = () => {
  return 'BIP32 derivation path';
};
function Signer(obj) {
  return (
    (exports.typeforce.Buffer(obj.publicKey) ||
      typeof obj.getPublicKey === 'function') &&
    typeof obj.sign === 'function'
  );
}
exports.Signer = Signer;
const SATOSHI_MAX = 21 * 1e14;
function Satoshi(value) {
  return exports.typeforce.UInt53(value) && value <= SATOSHI_MAX;
}
exports.Satoshi = Satoshi;
// external dependent types
exports.ECPoint = exports.typeforce.quacksLike('Point');
// exposed, external API
exports.Network = exports.typeforce.compile({
  messagePrefix: exports.typeforce.oneOf(
    exports.typeforce.Buffer,
    exports.typeforce.String,
  ),
  bip32: {
    public: exports.typeforce.UInt32,
    private: exports.typeforce.UInt32,
  },
  pubKeyHash: exports.typeforce.UInt8,
  scriptHash: exports.typeforce.UInt8,
  wif: exports.typeforce.UInt8,
});
exports.TaprootLeaf = exports.typeforce.compile({
  output: exports.typeforce.BufferN(34),
  version: exports.typeforce.maybe(exports.typeforce.UInt8), // todo: recheck
});
// / todo: revisit
exports.TaprootNode = exports.typeforce.arrayOf(
  exports.typeforce.oneOf(
    exports.TaprootLeaf,
    exports.typeforce.arrayOf(exports.TaprootLeaf),
  ),
);
exports.Buffer256bit = exports.typeforce.BufferN(32);
exports.Hash160bit = exports.typeforce.BufferN(20);
exports.Hash256bit = exports.typeforce.BufferN(32);
exports.Number = exports.typeforce.Number; // tslint:disable-line variable-name
exports.Array = exports.typeforce.Array;
exports.Boolean = exports.typeforce.Boolean; // tslint:disable-line variable-name
exports.String = exports.typeforce.String; // tslint:disable-line variable-name
exports.Buffer = exports.typeforce.Buffer;
exports.Hex = exports.typeforce.Hex;
exports.maybe = exports.typeforce.maybe;
exports.tuple = exports.typeforce.tuple;
exports.UInt8 = exports.typeforce.UInt8;
exports.UInt32 = exports.typeforce.UInt32;
exports.Function = exports.typeforce.Function;
exports.BufferN = exports.typeforce.BufferN;
exports.Null = exports.typeforce.Null;
exports.oneOf = exports.typeforce.oneOf;
