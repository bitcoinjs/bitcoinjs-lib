import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as types from 'bitcoinjs-lib/src/types';
import * as v from 'valibot';

describe('types', () => {
  describe('Buffer Hash160/Hash256', () => {
    const buffer20byte = Buffer.alloc(20);
    const buffer32byte = Buffer.alloc(32);

    it('return true for valid size', () => {
      assert.equal(v.is(types.Hash160bitSchema, buffer20byte), true);
      assert.equal(v.is(types.Hash256bitSchema, buffer32byte), true);
    });

    it('return true for oneOf', () => {
      assert.doesNotThrow(() => {
        v.parse(
          v.union([types.Hash160bitSchema, types.Hash256bitSchema]),
          buffer32byte,
        );
      });

      assert.doesNotThrow(() => {
        v.parse(
          v.union([types.Hash256bitSchema, types.Hash160bitSchema]),
          buffer32byte,
        );
      });
    });

    it('throws for invalid size', () => {
      assert.throws(() => {
        v.parse(types.Hash160bitSchema, buffer32byte);
      }, /ValiError: Invalid length: Expected 20 but received 32/);

      assert.throws(() => {
        v.parse(types.Hash256bitSchema, buffer20byte);
      }, /ValiError: Invalid length: Expected 32 but received 20/);
    });
  });

  describe('Satoshi', () => {
    [
      { value: BigInt(-1), result: false },
      { value: BigInt(0), result: true },
      { value: BigInt(1), result: true },
      { value: BigInt(20999999 * 1e8), result: true },
      { value: BigInt(21000000 * 1e8), result: true },
      { value: BigInt(21000001 * 1e8), result: true },
      { value: BigInt((1n << 63n) - 1n), result: true },
      { value: BigInt(1n << 63n), result: false },
    ].forEach(f => {
      it('returns ' + f.result + ' for valid for ' + f.value, () => {
        assert.strictEqual(v.is(types.SatoshiSchema, f.value), f.result);
      });
    });
  });
});
