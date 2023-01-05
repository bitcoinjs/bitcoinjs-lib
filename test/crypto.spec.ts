import * as assert from 'assert';
import { describe, it } from 'mocha';
import { crypto as bcrypto, TaggedHashPrefix } from '..';
import * as fixtures from './fixtures/crypto.json';
import { sha256 } from '../src/crypto';
import { TAGS } from '../src/tags';
import { TAGGED_HASH_PREFIXES_HEX } from '../src/tagged-hash-prefixes';

describe('crypto', () => {
  ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(algorithm => {
    describe(algorithm, () => {
      fixtures.hashes.forEach(f => {
        const fn = (bcrypto as any)[algorithm];
        const expected = (f as any)[algorithm];

        it('returns ' + expected + ' for ' + f.hex, () => {
          const data = Buffer.from(f.hex, 'hex');
          const actual = fn(data).toString('hex');

          assert.strictEqual(actual, expected);
        });
      });
    });
  });

  describe('taggedHash', () => {
    fixtures.taggedHash.forEach(f => {
      const bytes = Buffer.from(f.hex, 'hex');
      const expected = Buffer.from(f.result, 'hex');
      it(`returns ${f.result} for taggedHash "${f.tag}" of ${f.hex}`, () => {
        const actual = bcrypto.taggedHash(f.tag as TaggedHashPrefix, bytes);
        assert.strictEqual(actual.toString('hex'), expected.toString('hex'));
      });
    });
  });

  describe('TAGGED_HASH_PREFIXES', () => {
    const taggedHashPrefixes = Object.fromEntries(
      TAGS.map(tag => {
        const tagHash = sha256(Buffer.from(tag));
        return [tag, Buffer.concat([tagHash, tagHash])];
      }),
    );
    it('stored the result of operation', () => {
      Object.keys(taggedHashPrefixes).forEach(tag => {
        assert.strictEqual(
          TAGGED_HASH_PREFIXES_HEX[tag],
          taggedHashPrefixes[tag].toString('hex'),
        );
      });
    });
  });
});
