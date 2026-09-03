import * as assert from 'assert';
import { describe, it } from 'mocha';
import { crypto as bcrypto } from 'bitcoinjs-lib';
import { fastMerkleRoot } from 'bitcoinjs-lib/src/merkle';

describe('fastMerkleRoot', () => {
  [
    { level: 'leaf level', valueCount: 3, duplicateCount: 1 },
    { level: 'one level above the leaves', valueCount: 6, duplicateCount: 2 },
    { level: 'two levels above the leaves', valueCount: 12, duplicateCount: 4 },
  ].forEach(({ level, valueCount, duplicateCount }) => {
    it(`detects mutations at ${level}`, () => {
      const values = Array.from({ length: valueCount }, (_, value) =>
        new Uint8Array(32).fill(value),
      );
      const mutatedValues = values.concat(
        values.slice(-duplicateCount).map(value => value.slice()),
      );
      const mutation = { value: false };

      const root = fastMerkleRoot(values, bcrypto.hash256);
      assert.deepStrictEqual(
        fastMerkleRoot(mutatedValues, bcrypto.hash256, mutation),
        root,
      );
      assert.strictEqual(mutation.value, true);

      assert.deepStrictEqual(
        fastMerkleRoot(values, bcrypto.hash256, mutation),
        root,
      );
      assert.strictEqual(mutation.value, false);
    });
  });

  it('distinguishes equal siblings from equal hashes across pairs', () => {
    const mutation = { value: false };

    fastMerkleRoot(
      [0, 0, 1, 2].map(value => new Uint8Array(32).fill(value)),
      bcrypto.hash256,
      mutation,
    );
    assert.strictEqual(mutation.value, true);

    fastMerkleRoot(
      [0, 1, 1, 2].map(value => new Uint8Array(32).fill(value)),
      bcrypto.hash256,
      mutation,
    );
    assert.strictEqual(mutation.value, false);
  });

  it('does not flag a single value', () => {
    const value = new Uint8Array(32).fill(1);
    const mutation = { value: true };

    assert.deepStrictEqual(
      fastMerkleRoot([value], bcrypto.hash256, mutation),
      value,
    );
    assert.strictEqual(mutation.value, false);
  });

  it('detects successive mutations that preserve the root', () => {
    let values = Array.from({ length: 9 }, (_, value) =>
      new Uint8Array(32).fill(value),
    );
    const root = fastMerkleRoot(values, bcrypto.hash256);
    const mutation = { value: false };

    for (const duplicateCount of [1, 2, 4]) {
      values = values.concat(
        values.slice(-duplicateCount).map(value => value.slice()),
      );
      assert.deepStrictEqual(
        fastMerkleRoot(values, bcrypto.hash256, mutation),
        root,
      );
      assert.strictEqual(mutation.value, true);
    }
  });
});
