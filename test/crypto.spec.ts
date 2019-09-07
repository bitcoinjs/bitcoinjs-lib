import * as assert from 'assert';
import { describe, it } from 'mocha';
import { crypto as bcrypto } from '..';
import * as fixtures from './fixtures/crypto.json';

describe('crypto', () => {
  ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(algorithm => {
    describe(algorithm, () => {
      fixtures.forEach(f => {
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
});
