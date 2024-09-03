import * as assert from 'assert';
import { describe, it } from 'mocha';
import { script } from 'bitcoinjs-lib';
const bscriptSig = script.signature;
import fixtures from './fixtures/signature.json';
import * as tools from 'uint8array-tools';

describe('Script Signatures', () => {
  function fromRaw(signature: { r: string; s: string }): Uint8Array {
    return tools.concat([
      tools.fromHex(signature.r),
      tools.fromHex(signature.s),
    ]);
  }

  function toRaw(signature: Uint8Array): {
    r: string;
    s: string;
  } {
    return {
      r: tools.toHex(signature.subarray(0, 32)),
      s: tools.toHex(signature.subarray(32, 64)),
    };
  }

  describe('encode', () => {
    fixtures.valid.forEach(f => {
      it('encodes ' + f.hex, () => {
        const buffer = bscriptSig.encode(fromRaw(f.raw), f.hashType);

        assert.strictEqual(tools.toHex(buffer), f.hex);
      });
    });

    fixtures.invalid.forEach(f => {
      if (!f.raw) return;

      it('throws ' + f.exception, () => {
        const signature = fromRaw(f.raw);

        assert.throws(() => {
          bscriptSig.encode(signature, f.hashType);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('decode', () => {
    fixtures.valid.forEach(f => {
      it('decodes ' + f.hex, () => {
        const decode = bscriptSig.decode(Buffer.from(f.hex, 'hex'));

        assert.deepStrictEqual(toRaw(decode.signature), f.raw);
        assert.strictEqual(decode.hashType, f.hashType);
      });
    });

    fixtures.invalid.forEach(f => {
      it('throws on ' + f.hex, () => {
        const buffer = Buffer.from(f.hex, 'hex');

        assert.throws(() => {
          bscriptSig.decode(buffer);
        }, new RegExp(f.exception));
      });
    });
  });
});
