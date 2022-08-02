import * as createHash from 'create-hash';
const groestlhash = require('groestl-hash-js');
import * as RipeMd160 from 'ripemd160';

export function ripemd160(buffer: Buffer): Buffer {
  try {
    return createHash('rmd160')
      .update(buffer)
      .digest();
  } catch (err) {
    try {
      return createHash('ripemd160')
        .update(buffer)
        .digest();
    } catch (err2) {
      return new RipeMd160().update(buffer).digest();
    }
  }
}

export function sha1(buffer: Buffer): Buffer {
  return createHash('sha1')
    .update(buffer)
    .digest();
}

export function sha256(buffer: Buffer): Buffer {
  return createHash('sha256')
    .update(buffer)
    .digest();
}

export function hash160(buffer: Buffer): Buffer {
  return ripemd160(sha256(buffer));
}

export function hash256(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}

export function groestl(buffer: Buffer): Buffer {
  return new Buffer(groestlhash.groestl_2(buffer, 1, 1));
}

const TAGS = [
  'BIP0340/challenge',
  'BIP0340/aux',
  'BIP0340/nonce',
  'TapLeaf',
  'TapBranch',
  'TapSighash',
  'TapTweak',
  'KeyAgg list',
  'KeyAgg coefficient',
] as const;
export type TaggedHashPrefix = typeof TAGS[number];
/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
const TAGGED_HASH_PREFIXES = Object.fromEntries(
  TAGS.map(tag => {
    const tagHash = sha256(Buffer.from(tag));
    return [tag, Buffer.concat([tagHash, tagHash])];
  }),
) as { [k in TaggedHashPrefix]: Buffer };

export function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer {
  return sha256(Buffer.concat([TAGGED_HASH_PREFIXES[prefix], data]));
}
