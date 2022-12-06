'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.oneOf =
  exports.Null =
  exports.BufferN =
  exports.Function =
  exports.UInt32 =
  exports.UInt8 =
  exports.tuple =
  exports.maybe =
  exports.Hex =
  exports.Buffer =
  exports.String =
  exports.Boolean =
  exports.Array =
  exports.Number =
  exports.Hash256bit =
  exports.Hash160bit =
  exports.Buffer256bit =
  exports.isTaptree =
  exports.isTapleaf =
  exports.TAPLEAF_VERSION_MASK =
  exports.Network =
  exports.ECPoint =
  exports.Satoshi =
  exports.Signer =
  exports.BIP32Path =
  exports.UInt31 =
  exports.isPoint =
  exports.typeforce =
    void 0;
const buffer_1 = require('buffer');
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
exports.TAPLEAF_VERSION_MASK = 0xfe;
function isTapleaf(o) {
  if (!o || !('output' in o)) return false;
  if (!buffer_1.Buffer.isBuffer(o.output)) return false;
  if (o.version !== undefined)
    return (o.version & exports.TAPLEAF_VERSION_MASK) === o.version;
  return true;
}
exports.isTapleaf = isTapleaf;
function isTaptree(scriptTree) {
  if (!(0, exports.Array)(scriptTree)) return isTapleaf(scriptTree);
  if (scriptTree.length !== 2) return false;
  return scriptTree.every(t => isTaptree(t));
}
exports.isTaptree = isTaptree;
exports.Buffer256bit = exports.typeforce.BufferN(32);
exports.Hash160bit = exports.typeforce.BufferN(20);
exports.Hash256bit = exports.typeforce.BufferN(32);
exports.Number = exports.typeforce.Number;
exports.Array = exports.typeforce.Array;
exports.Boolean = exports.typeforce.Boolean;
exports.String = exports.typeforce.String;
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
