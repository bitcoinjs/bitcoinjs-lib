import * as assert from 'assert';
import { describe, it } from 'mocha';
import { signature as bscriptSig } from '../src/script';
import * as fixtures from './fixtures/signature.json';

describe('Script Signatures', () => {
  function fromRaw(signature: { r: string; s: string }): Buffer {
    return Buffer.concat(
      [Buffer.from(signature.r, 'hex'), Buffer.from(signature.s, 'hex')],
      64,
    );
  }

  function toRaw(
    signature: Buffer,
  ): {
    r: string;
    s: string;
  } {
    return {
      r: signature.slice(0, 32).toString('hex'),
      s: signature.slice(32, 64).toString('hex'),
    };
  }

  describe('encode', () => {
    fixtures.valid.forEach(f => {
      it('encodes ' + f.hex, () => {
        const buffer = bscriptSig.encode(fromRaw(f.raw), f.hashType);

        assert.strictEqual(buffer.toString('hex'), f.hex);
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
