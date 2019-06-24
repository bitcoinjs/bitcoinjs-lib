'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const _ecc = require('tiny-secp256k1');
const r = Promise.resolve;
const ecc = {
  isPoint(derEncodedPoint) {
    return r(_ecc.isPoint(derEncodedPoint));
  },
  isPrivate(privateKey) {
    return r(_ecc.isPrivate(privateKey));
  },
  pointAddScalar(derEncodedPoint, scalar32Bytes, toCompressed) {
    return r(_ecc.pointAddScalar(derEncodedPoint, scalar32Bytes, toCompressed));
  },
  pointCompress(derEncodedPoint, toCompressed) {
    return r(_ecc.pointCompress(derEncodedPoint, toCompressed));
  },
  pointFromScalar(scalar32Bytes, toCompressed) {
    return r(_ecc.pointFromScalar(scalar32Bytes, toCompressed));
  },
  privateAdd(privateKey, scalar32Bytes) {
    return r(_ecc.privateAdd(privateKey, scalar32Bytes));
  },
  sign(hash, privateKey) {
    return r(_ecc.sign(hash, privateKey));
  },
  signWithEntropy(hash, privateKey, extraEntropy) {
    return r(_ecc.signWithEntropy(hash, privateKey, extraEntropy));
  },
  verify(hash, publicKey, signature) {
    return r(_ecc.verify(hash, publicKey, signature));
  },
};
exports.ecc = ecc;
