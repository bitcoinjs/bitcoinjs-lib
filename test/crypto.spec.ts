import * as assert from 'assert';
import { describe, it } from 'mocha';
import { crypto as bcrypto } from 'bitcoinjs-lib';
import type { TaggedHashPrefix } from 'bitcoinjs-lib';
import fixtures from './fixtures/crypto.json';
import * as tools from 'uint8array-tools';
import { TAGS, TAGGED_HASH_PREFIXES } from 'bitcoinjs-lib/src/crypto';
import { sha256 } from '@noble/hashes/sha256';

describe('crypto', () => {
  ['hash160', 'hash256'].forEach(algorithm => {
    describe(algorithm, () => {
      fixtures.hashes.forEach(f => {
        const fn = (bcrypto as any)[algorithm];
        const expected = (f as any)[algorithm];

        it('returns ' + expected + ' for ' + f.hex, () => {
          const data = Buffer.from(f.hex, 'hex');
          const actual = fn(data);

          assert.strictEqual(tools.toHex(actual), expected);
        });
      });
    });
  });

  describe('taggedHash', () => {
    fixtures.taggedHash.forEach(f => {
      const bytes = Buffer.from(f.hex, 'hex');
      const expected = f.result;
      it(`returns ${f.result} for taggedHash "${f.tag}" of ${f.hex}`, () => {
        const actual = bcrypto.taggedHash(f.tag as TaggedHashPrefix, bytes);
        assert.strictEqual(tools.toHex(actual), expected);
      });
    });
  });

  describe('TAGGED_HASH_PREFIXES', () => {
    const taggedHashPrefixes = Object.fromEntries(
      TAGS.map((tag: TaggedHashPrefix) => {
        const tagHash = sha256(Buffer.from(tag));
        return [tag, tools.concat([tagHash, tagHash])];
      }),
    );
    it('stored the result of operation', () => {
      assert.strictEqual(
        JSON.stringify(TAGGED_HASH_PREFIXES),
        JSON.stringify(taggedHashPrefixes),
      );
    });
  });
});
