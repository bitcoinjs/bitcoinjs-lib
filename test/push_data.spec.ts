import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as pushData from 'bitcoinjs-lib/src/push_data';
import { OPS } from 'bitcoinjs-lib/src/ops';

describe('push_data', () => {
  describe('encodingLength', () => {
    it('returns 1 for values below OP_PUSHDATA1', () => {
      assert.strictEqual(pushData.encodingLength(0), 1);
      assert.strictEqual(pushData.encodingLength(0x4b), 1);
      assert.strictEqual(pushData.encodingLength(OPS.OP_PUSHDATA1 - 1), 1);
    });

    it('returns 2 for values up to 0xff', () => {
      assert.strictEqual(pushData.encodingLength(OPS.OP_PUSHDATA1), 2);
      assert.strictEqual(pushData.encodingLength(0x80), 2);
      assert.strictEqual(pushData.encodingLength(0xff), 2);
    });

    it('returns 3 for values up to 0xffff', () => {
      assert.strictEqual(pushData.encodingLength(0x100), 3);
      assert.strictEqual(pushData.encodingLength(0xffff), 3);
    });

    it('returns 5 for values above 0xffff', () => {
      assert.strictEqual(pushData.encodingLength(0x10000), 5);
      assert.strictEqual(pushData.encodingLength(0xffffffff), 5);
    });
  });

  describe('encode', () => {
    it('encodes small values (< OP_PUSHDATA1) as single byte', () => {
      const buffer = new Uint8Array(10);
      const size = pushData.encode(buffer, 0x10, 0);
      assert.strictEqual(size, 1);
      assert.strictEqual(buffer[0], 0x10);
    });

    it('encodes values at OP_PUSHDATA1 boundary with 2 bytes', () => {
      const buffer = new Uint8Array(10);
      const size = pushData.encode(buffer, 0x80, 0);
      assert.strictEqual(size, 2);
      assert.strictEqual(buffer[0], OPS.OP_PUSHDATA1);
      assert.strictEqual(buffer[1], 0x80);
    });

    it('encodes 0xff with OP_PUSHDATA1', () => {
      const buffer = new Uint8Array(10);
      const size = pushData.encode(buffer, 0xff, 0);
      assert.strictEqual(size, 2);
      assert.strictEqual(buffer[0], OPS.OP_PUSHDATA1);
      assert.strictEqual(buffer[1], 0xff);
    });

    it('encodes 0x100 with OP_PUSHDATA2 (3 bytes, LE)', () => {
      const buffer = new Uint8Array(10);
      const size = pushData.encode(buffer, 0x100, 0);
      assert.strictEqual(size, 3);
      assert.strictEqual(buffer[0], OPS.OP_PUSHDATA2);
      assert.strictEqual(buffer[1], 0x00); // LE low byte
      assert.strictEqual(buffer[2], 0x01); // LE high byte
    });

    it('encodes 0x10000 with OP_PUSHDATA4 (5 bytes, LE)', () => {
      const buffer = new Uint8Array(10);
      const size = pushData.encode(buffer, 0x10000, 0);
      assert.strictEqual(size, 5);
      assert.strictEqual(buffer[0], OPS.OP_PUSHDATA4);
      assert.strictEqual(buffer[1], 0x00);
      assert.strictEqual(buffer[2], 0x00);
      assert.strictEqual(buffer[3], 0x01);
      assert.strictEqual(buffer[4], 0x00);
    });

    it('respects the offset parameter', () => {
      const buffer = new Uint8Array(10);
      buffer[0] = 0xab; // sentinel
      const size = pushData.encode(buffer, 0x10, 3);
      assert.strictEqual(size, 1);
      assert.strictEqual(buffer[0], 0xab); // untouched
      assert.strictEqual(buffer[3], 0x10);
    });

    it('encodes zero correctly', () => {
      const buffer = new Uint8Array(10);
      const size = pushData.encode(buffer, 0, 0);
      assert.strictEqual(size, 1);
      assert.strictEqual(buffer[0], 0x00);
    });
  });

  describe('decode', () => {
    it('decodes small opcodes (< OP_PUSHDATA1)', () => {
      const buffer = new Uint8Array([0x10]);
      const result = pushData.decode(buffer, 0);
      assert.ok(result);
      assert.strictEqual(result!.opcode, 0x10);
      assert.strictEqual(result!.number, 0x10);
      assert.strictEqual(result!.size, 1);
    });

    it('decodes OP_PUSHDATA1', () => {
      const buffer = new Uint8Array([OPS.OP_PUSHDATA1, 0x80]);
      const result = pushData.decode(buffer, 0);
      assert.ok(result);
      assert.strictEqual(result!.opcode, OPS.OP_PUSHDATA1);
      assert.strictEqual(result!.number, 0x80);
      assert.strictEqual(result!.size, 2);
    });

    it('returns null for OP_PUSHDATA1 with insufficient buffer', () => {
      const buffer = new Uint8Array([OPS.OP_PUSHDATA1]);
      const result = pushData.decode(buffer, 0);
      assert.strictEqual(result, null);
    });

    it('decodes OP_PUSHDATA2', () => {
      const buffer = new Uint8Array([OPS.OP_PUSHDATA2, 0x00, 0x01]);
      const result = pushData.decode(buffer, 0);
      assert.ok(result);
      assert.strictEqual(result!.opcode, OPS.OP_PUSHDATA2);
      assert.strictEqual(result!.number, 0x100);
      assert.strictEqual(result!.size, 3);
    });

    it('returns null for OP_PUSHDATA2 with insufficient buffer', () => {
      const buffer = new Uint8Array([OPS.OP_PUSHDATA2, 0x00]);
      const result = pushData.decode(buffer, 0);
      assert.strictEqual(result, null);
    });

    it('decodes OP_PUSHDATA4', () => {
      const buffer = new Uint8Array([OPS.OP_PUSHDATA4, 0x00, 0x00, 0x01, 0x00]);
      const result = pushData.decode(buffer, 0);
      assert.ok(result);
      assert.strictEqual(result!.opcode, OPS.OP_PUSHDATA4);
      assert.strictEqual(result!.number, 0x10000);
      assert.strictEqual(result!.size, 5);
    });

    it('returns null for OP_PUSHDATA4 with insufficient buffer', () => {
      const buffer = new Uint8Array([OPS.OP_PUSHDATA4, 0x00, 0x00, 0x01]);
      const result = pushData.decode(buffer, 0);
      assert.strictEqual(result, null);
    });

    it('throws for unexpected opcode between PUSHDATA2 and PUSHDATA4', () => {
      // OPS.OP_PUSHDATA4 is 0x4e, so 0x4f is OP_1NEGATE - not a pushdata
      // Actually we need an opcode > OP_PUSHDATA2 and != OP_PUSHDATA4
      // OP_PUSHDATA2 = 0x4d, OP_PUSHDATA4 = 0x4e, so 0x4f
      const buffer = new Uint8Array([0x4f, 0x00, 0x00, 0x00, 0x00]);
      // 0x4f > OP_PUSHDATA2 (0x4d) but != OP_PUSHDATA4 (0x4e)
      // Actually the code checks: opcode < OP_PUSHDATA1 -> small, == OP_PUSHDATA1 -> 8bit, == OP_PUSHDATA2 -> 16bit, else -> check != OP_PUSHDATA4 throw
      assert.throws(
        () => pushData.decode(buffer, 0),
        /Unexpected opcode/,
      );
    });

    it('respects offset parameter', () => {
      const buffer = new Uint8Array([0xff, 0xff, 0x10]);
      const result = pushData.decode(buffer, 2);
      assert.ok(result);
      assert.strictEqual(result!.opcode, 0x10);
      assert.strictEqual(result!.number, 0x10);
      assert.strictEqual(result!.size, 1);
    });

    it('roundtrips with encode for all encoding sizes', () => {
      const testValues = [0x00, 0x10, 0x4b, 0x80, 0xff, 0x100, 0xffff, 0x10000];
      for (const num of testValues) {
        const buffer = new Uint8Array(10);
        const encSize = pushData.encode(buffer, num, 0);
        const result = pushData.decode(buffer, 0);
        assert.ok(result, `decode failed for ${num}`);
        assert.strictEqual(result!.number, num, `number mismatch for ${num}`);
        assert.strictEqual(result!.size, encSize, `size mismatch for ${num}`);
      }
    });
  });
});
