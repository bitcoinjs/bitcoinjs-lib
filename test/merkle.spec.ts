import * as assert from 'assert';
import { describe, it } from 'mocha';
import { fastMerkleRoot } from 'bitcoinjs-lib/src/merkle';
import { sha256 } from '@noble/hashes/sha256';
import * as tools from 'uint8array-tools';

function doubleHash(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

describe('merkle', () => {
  describe('fastMerkleRoot', () => {
    it('throws TypeError when values is not an array', () => {
      assert.throws(
        () => fastMerkleRoot('not-an-array' as any, doubleHash),
        /Expected values Array/,
      );
    });

    it('throws TypeError when digestFn is not a function', () => {
      assert.throws(
        () => fastMerkleRoot([], 'not-a-function' as any),
        /Expected digest Function/,
      );
    });

    it('returns undefined for an empty array', () => {
      const result = fastMerkleRoot([], doubleHash);
      assert.strictEqual(result, undefined);
    });

    it('returns the single element for a single-element array', () => {
      const leaf = sha256(new Uint8Array([0x01]));
      const result = fastMerkleRoot([leaf], doubleHash);
      assert.deepStrictEqual(result, leaf);
    });

    it('computes correct root for two elements', () => {
      const a = sha256(new Uint8Array([0x01]));
      const b = sha256(new Uint8Array([0x02]));
      const expected = doubleHash(tools.concat([a, b]));
      const result = fastMerkleRoot([a, b], doubleHash);
      assert.deepStrictEqual(result, expected);
    });

    it('computes correct root for three elements (odd count)', () => {
      const a = sha256(new Uint8Array([0x01]));
      const b = sha256(new Uint8Array([0x02]));
      const c = sha256(new Uint8Array([0x03]));

      // Level 1: hash(a||b), hash(c||c)
      const ab = doubleHash(tools.concat([a, b]));
      const cc = doubleHash(tools.concat([c, c]));
      // Level 2: hash(ab||cc)
      const expected = doubleHash(tools.concat([ab, cc]));
      const result = fastMerkleRoot([a, b, c], doubleHash);
      assert.deepStrictEqual(result, expected);
    });

    it('computes correct root for four elements', () => {
      const leaves = [0x01, 0x02, 0x03, 0x04].map(v =>
        sha256(new Uint8Array([v])),
      );
      const ab = doubleHash(tools.concat([leaves[0], leaves[1]]));
      const cd = doubleHash(tools.concat([leaves[2], leaves[3]]));
      const expected = doubleHash(tools.concat([ab, cd]));
      const result = fastMerkleRoot(leaves, doubleHash);
      assert.deepStrictEqual(result, expected);
    });

    it('handles five elements correctly', () => {
      const leaves = [0x01, 0x02, 0x03, 0x04, 0x05].map(v =>
        sha256(new Uint8Array([v])),
      );
      // Level 1: (0,1) (2,3) (4,4)
      const h01 = doubleHash(tools.concat([leaves[0], leaves[1]]));
      const h23 = doubleHash(tools.concat([leaves[2], leaves[3]]));
      const h44 = doubleHash(tools.concat([leaves[4], leaves[4]]));
      // Level 2: (h01,h23) (h44,h44)
      const h0123 = doubleHash(tools.concat([h01, h23]));
      const h4444 = doubleHash(tools.concat([h44, h44]));
      // Level 3
      const expected = doubleHash(tools.concat([h0123, h4444]));
      const result = fastMerkleRoot(leaves, doubleHash);
      assert.deepStrictEqual(result, expected);
    });

    it('does not mutate the original array', () => {
      const leaves = [0x01, 0x02, 0x03].map(v =>
        sha256(new Uint8Array([v])),
      );
      const originalLength = leaves.length;
      const originalFirst = new Uint8Array(leaves[0]);
      fastMerkleRoot(leaves, doubleHash);
      assert.strictEqual(leaves.length, originalLength);
      assert.deepStrictEqual(leaves[0], originalFirst);
    });

    it('produces deterministic results', () => {
      const leaves = [0xaa, 0xbb, 0xcc, 0xdd].map(v =>
        sha256(new Uint8Array([v])),
      );
      const result1 = fastMerkleRoot(leaves, doubleHash);
      const result2 = fastMerkleRoot(leaves, doubleHash);
      assert.deepStrictEqual(result1, result2);
    });

    it('produces different roots for different leaf orders', () => {
      const a = sha256(new Uint8Array([0x01]));
      const b = sha256(new Uint8Array([0x02]));
      const result1 = fastMerkleRoot([a, b], doubleHash);
      const result2 = fastMerkleRoot([b, a], doubleHash);
      assert.notDeepStrictEqual(result1, result2);
    });
  });
});
