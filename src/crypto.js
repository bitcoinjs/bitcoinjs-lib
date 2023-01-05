'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.taggedHash =
  exports.hash256 =
  exports.hash160 =
  exports.sha256 =
  exports.sha1 =
  exports.ripemd160 =
    void 0;
const createHash = require('create-hash');
const RipeMd160 = require('ripemd160');
const tagged_hash_prefixes_1 = require('./tagged-hash-prefixes');
function ripemd160(buffer) {
  try {
    return createHash('rmd160').update(buffer).digest();
  } catch (err) {
    try {
      return createHash('ripemd160').update(buffer).digest();
    } catch (err2) {
      return new RipeMd160().update(buffer).digest();
    }
  }
}
exports.ripemd160 = ripemd160;
function sha1(buffer) {
  return createHash('sha1').update(buffer).digest();
}
exports.sha1 = sha1;
function sha256(buffer) {
  return createHash('sha256').update(buffer).digest();
}
exports.sha256 = sha256;
function hash160(buffer) {
  return ripemd160(sha256(buffer));
}
exports.hash160 = hash160;
function hash256(buffer) {
  return sha256(sha256(buffer));
}
exports.hash256 = hash256;
/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
const TAGGED_HASH_PREFIXES = Object.fromEntries(
  Object.keys(tagged_hash_prefixes_1.TAGGED_HASH_PREFIXES_HEX).map(tag => [
    tag,
    Buffer.from(tagged_hash_prefixes_1.TAGGED_HASH_PREFIXES_HEX[tag], 'hex'),
  ]),
);
function taggedHash(prefix, data) {
  return sha256(Buffer.concat([TAGGED_HASH_PREFIXES[prefix], data]));
}
exports.taggedHash = taggedHash;
