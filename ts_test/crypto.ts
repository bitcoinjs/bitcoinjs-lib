import { crypto as bcrypto } from '..';
import { FixtureCrypto } from './fixtureTypes';
const { describe, it } = require('mocha');
const assert = require('assert');

const fixtures: FixtureCrypto = require('../ts_test/fixtures/crypto');

describe('crypto', () => {
  ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(algorithm => {
    describe(algorithm, () => {
      fixtures.forEach(f => {
        const fn: (x: Buffer) => Buffer = bcrypto[algorithm];
        const expected: string = f[algorithm];

        it('returns ' + expected + ' for ' + f.hex, () => {
          const data = Buffer.from(f.hex, 'hex');
          const actual = fn(data).toString('hex');

          assert.strictEqual(actual, expected);
        });
      });
    });
  });
});

export {};
