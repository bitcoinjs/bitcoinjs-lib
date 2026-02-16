import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as bip66 from 'bitcoinjs-lib/src/bip66';

describe('bip66', () => {
  describe('check', () => {
    it('returns false for buffers shorter than 8 bytes', () => {
      assert.strictEqual(bip66.check(new Uint8Array(7)), false);
    });

    it('returns false for buffers longer than 72 bytes', () => {
      assert.strictEqual(bip66.check(new Uint8Array(73)), false);
    });

    it('returns false if first byte is not 0x30', () => {
      const buf = new Uint8Array([0x31, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if total-length byte does not match', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if first integer marker is not 0x02', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x03, 0x01, 0x01, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if R length is zero', () => {
      const buf = new Uint8Array([0x30, 0x04, 0x02, 0x00, 0x02, 0x01, 0x01, 0x00]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if second integer marker is not 0x02', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x03, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if S length is zero', () => {
      const buf = new Uint8Array([0x30, 0x04, 0x02, 0x01, 0x01, 0x02, 0x00, 0x00]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if R value is negative (high bit set)', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x80, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if R value is excessively padded', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x02, 0x00, 0x01, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if S value is negative (high bit set)', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x80]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if S value is excessively padded', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x02, 0x00, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns true for a valid minimal DER signature', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), true);
    });

    it('returns true when R has necessary padding for high bit', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x02, 0x00, 0x80, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), true);
    });

    it('returns true when S has necessary padding for high bit', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x02, 0x00, 0x80]);
      assert.strictEqual(bip66.check(buf), true);
    });

    it('returns false if R length overflows buffer', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x05, 0x01, 0x02, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });

    it('returns false if S length does not match remaining bytes', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x03, 0x01, 0x01]);
      assert.strictEqual(bip66.check(buf), false);
    });
  });

  describe('decode', () => {
    it('throws on buffer shorter than 8 bytes', () => {
      assert.throws(() => bip66.decode(new Uint8Array(7)), /DER sequence length is too short/);
    });

    it('throws on buffer longer than 72 bytes', () => {
      assert.throws(() => bip66.decode(new Uint8Array(73)), /DER sequence length is too long/);
    });

    it('throws if first byte is not 0x30', () => {
      const buf = new Uint8Array([0x31, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);
      assert.throws(() => bip66.decode(buf), /Expected DER sequence/);
    });

    it('throws if total-length byte is invalid', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01]);
      assert.throws(() => bip66.decode(buf), /DER sequence length is invalid/);
    });

    it('throws if first integer marker is not 0x02', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x03, 0x01, 0x01, 0x02, 0x01, 0x01]);
      assert.throws(() => bip66.decode(buf), /Expected DER integer/);
    });

    it('throws if R length is zero', () => {
      // 8 bytes min: 0x30 [len] 0x02 0x00 0x02 0x01 0x01 + padding
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x00, 0x02, 0x01, 0x01, 0x00]);
      assert.throws(() => bip66.decode(buf), /R length is zero/);
    });

    it('throws if R value is negative', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x80, 0x02, 0x01, 0x01]);
      assert.throws(() => bip66.decode(buf), /R value is negative/);
    });

    it('throws if R value is excessively padded', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x02, 0x00, 0x01, 0x02, 0x01, 0x01]);
      assert.throws(() => bip66.decode(buf), /R value excessively padded/);
    });

    it('throws if S value is negative', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x80]);
      assert.throws(() => bip66.decode(buf), /S value is negative/);
    });

    it('throws if S value is excessively padded', () => {
      const buf = new Uint8Array([0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x02, 0x00, 0x01]);
      assert.throws(() => bip66.decode(buf), /S value excessively padded/);
    });

    it('throws if S length is zero', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x00, 0x00]);
      assert.throws(() => bip66.decode(buf), /S length is zero/);
    });

    it('correctly decodes a valid DER signature', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]);
      const result = bip66.decode(buf);
      assert.deepStrictEqual(result.r, new Uint8Array([0x01]));
      assert.deepStrictEqual(result.s, new Uint8Array([0x02]));
    });

    it('correctly decodes with multi-byte R and S', () => {
      const buf = new Uint8Array([
        0x30, 0x08, 0x02, 0x02, 0x00, 0xff, 0x02, 0x02, 0x00, 0xfe,
      ]);
      const result = bip66.decode(buf);
      assert.deepStrictEqual(result.r, new Uint8Array([0x00, 0xff]));
      assert.deepStrictEqual(result.s, new Uint8Array([0x00, 0xfe]));
    });

    it('throws if second integer marker is not 0x02', () => {
      const buf = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x03, 0x01, 0x01]);
      assert.throws(() => bip66.decode(buf), /Expected DER integer \(2\)/);
    });
  });

  describe('encode', () => {
    it('throws if R length is zero', () => {
      assert.throws(() => bip66.encode(new Uint8Array(0), new Uint8Array([0x01])), /R length is zero/);
    });

    it('throws if S length is zero', () => {
      assert.throws(() => bip66.encode(new Uint8Array([0x01]), new Uint8Array(0)), /S length is zero/);
    });

    it('throws if R length exceeds 33', () => {
      assert.throws(() => bip66.encode(new Uint8Array(34), new Uint8Array([0x01])), /R length is too long/);
    });

    it('throws if S length exceeds 33', () => {
      assert.throws(() => bip66.encode(new Uint8Array([0x01]), new Uint8Array(34)), /S length is too long/);
    });

    it('throws if R value is negative', () => {
      assert.throws(() => bip66.encode(new Uint8Array([0x80]), new Uint8Array([0x01])), /R value is negative/);
    });

    it('throws if S value is negative', () => {
      assert.throws(() => bip66.encode(new Uint8Array([0x01]), new Uint8Array([0x80])), /S value is negative/);
    });

    it('throws if R is excessively padded', () => {
      assert.throws(() => bip66.encode(new Uint8Array([0x00, 0x01]), new Uint8Array([0x01])), /R value excessively padded/);
    });

    it('throws if S is excessively padded', () => {
      assert.throws(() => bip66.encode(new Uint8Array([0x01]), new Uint8Array([0x00, 0x01])), /S value excessively padded/);
    });

    it('encodes a minimal DER signature', () => {
      const result = bip66.encode(new Uint8Array([0x01]), new Uint8Array([0x02]));
      assert.deepStrictEqual(
        result,
        new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02]),
      );
    });

    it('encodes with properly padded R and S', () => {
      const r = new Uint8Array([0x00, 0xff]);
      const s = new Uint8Array([0x00, 0xfe]);
      const result = bip66.encode(r, s);
      assert.deepStrictEqual(
        result,
        new Uint8Array([0x30, 0x08, 0x02, 0x02, 0x00, 0xff, 0x02, 0x02, 0x00, 0xfe]),
      );
    });

    it('roundtrips with decode', () => {
      const r = new Uint8Array([0x7f, 0x01, 0x02]);
      const s = new Uint8Array([0x00, 0x80, 0x03]);
      const encoded = bip66.encode(r, s);
      const decoded = bip66.decode(encoded);
      assert.deepStrictEqual(decoded.r, r);
      assert.deepStrictEqual(decoded.s, s);
    });

    it('roundtrips single-byte values', () => {
      const r = new Uint8Array([0x7f]);
      const s = new Uint8Array([0x01]);
      const encoded = bip66.encode(r, s);
      assert.strictEqual(bip66.check(encoded), true);
      const decoded = bip66.decode(encoded);
      assert.deepStrictEqual(decoded.r, r);
      assert.deepStrictEqual(decoded.s, s);
    });
  });
});
