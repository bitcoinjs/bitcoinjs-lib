import * as createHash from 'create-hash';
import * as RipeMd160 from 'ripemd160';
import { TAGGED_HASH_PREFIXES_HEX } from './tagged-hash-prefixes';
import { TAGS } from './tags';
export function ripemd160(buffer: Buffer): Buffer {
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

export function sha1(buffer: Buffer): Buffer {
  return createHash('sha1').update(buffer).digest();
}

export function sha256(buffer: Buffer): Buffer {
  return createHash('sha256').update(buffer).digest();
}

export function hash160(buffer: Buffer): Buffer {
  return ripemd160(sha256(buffer));
}

export function hash256(buffer: Buffer): Buffer {
  return sha256(sha256(buffer));
}

export type TaggedHashPrefix = typeof TAGS[number];

/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */

const TAGGED_HASH_PREFIXES = Object.fromEntries(
  Object.keys(TAGGED_HASH_PREFIXES_HEX).map((tag: string) => [
    tag,
    Buffer.from(TAGGED_HASH_PREFIXES_HEX[tag], 'hex'),
  ]),
) as { [k in TaggedHashPrefix]: Buffer };

export function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer {
  return sha256(Buffer.concat([TAGGED_HASH_PREFIXES[prefix], data]));
}
