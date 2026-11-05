import * as assert from 'assert';
import { describe, it } from 'mocha';
import { payments, script } from 'bitcoinjs-lib';

describe('embed minimal data pushes', () => {
  for (const data of [
    new Uint8Array(),
    ...Array.from({ length: 16 }, (_, i) => Uint8Array.of(i + 1)),
    Uint8Array.of(0x81),
  ]) {
    it(`round trips data ${Array.from(data)}`, () => {
      const output = payments.embed({ data: [data] }).output!;
      assert.deepStrictEqual(payments.embed({ output }).data, [data]);
      assert.deepStrictEqual(payments.embed({ output, data: [data] }).data, [
        data,
      ]);
      assert.deepStrictEqual(
        payments.embed({ output }, { validate: false }).data,
        [data],
      );
    });
  }
  it('rejects a non-push opcode after OP_RETURN', () => {
    assert.throws(
      () => payments.embed({ output: script.fromASM('OP_RETURN OP_DUP') }),
      /Output is invalid/,
    );
  });
});
