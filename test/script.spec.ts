import * as assert from 'assert';
import { describe, it } from 'mocha';
import { script as bscript } from 'bitcoinjs-lib';
import fixtures from './fixtures/script.json';
import minimalData from 'minimaldata';

import * as tools from 'uint8array-tools';
describe('script', () => {
  // TODO
  describe('isCanonicalPubKey', () => {
    it('rejects if not provided a Buffer', () => {
      assert.strictEqual(false, bscript.isCanonicalPubKey(0 as any));
    });
    it('rejects smaller than 33', () => {
      for (let i = 0; i < 33; i++) {
        assert.strictEqual(
          false,
          bscript.isCanonicalPubKey(Buffer.allocUnsafe(i)),
        );
      }
    });
  });
  describe.skip('isCanonicalScriptSignature', () => {
    assert.ok(true);
  });

  describe('fromASM/toASM', () => {
    fixtures.valid.forEach(f => {
      it('encodes/decodes ' + f.asm, () => {
        const script = bscript.fromASM(f.asm);
        assert.strictEqual(bscript.toASM(script), f.asm);
      });
    });

    fixtures.invalid.fromASM.forEach(f => {
      it('throws ' + f.description, () => {
        assert.throws(() => {
          bscript.fromASM(f.script);
        }, new RegExp(f.description));
      });
    });
  });

  describe('fromASM', () => {
    const OPS = bscript.OPS;
    it('decodes OP_FALSE as empty buffer', () => {
      const string = 'OP_RETURN OP_FALSE';
      assert.deepStrictEqual(
        bscript.fromASM(string),
        Uint8Array.from([OPS.OP_RETURN, OPS.OP_FALSE]),
      );
    });

    it("decodes a series of numbers from '82 to 96' correctly", () => {
      const asm = Array.from({ length: 15 }, (_, i) => i + 82).join(' ');
      const expected = Array.from({ length: 15 }, (_, i) => [
        1,
        parseInt(String(i + 82), 16),
      ]).flat();
      const result = bscript.fromASM(asm);
      assert.deepStrictEqual(result, Uint8Array.from(expected));
    });
  });

  describe('toASM', () => {
    const OP_RETURN = bscript.OPS.OP_RETURN;
    it('encodes empty buffer as OP_0', () => {
      const chunks = [OP_RETURN, Buffer.from([])];
      assert.strictEqual(bscript.toASM(chunks), 'OP_RETURN OP_0');
    });

    for (let i = 1; i <= 16; i++) {
      it(`encodes one byte buffer [${i}] as OP_${i}`, () => {
        const chunks = [OP_RETURN, Buffer.from([i])];
        assert.strictEqual(bscript.toASM(chunks), 'OP_RETURN OP_' + i);
      });
    }
  });

  describe('fromASM/toASM (templates)', () => {
    fixtures.valid2.forEach(f => {
      if (f.inputHex) {
        const ih = bscript.toASM(Buffer.from(f.inputHex, 'hex'));

        it('encodes/decodes ' + ih, () => {
          const script = bscript.fromASM(f.input);
          assert.strictEqual(tools.toHex(script), f.inputHex);
          assert.strictEqual(bscript.toASM(script), f.input);
        });
      }

      if (f.outputHex) {
        it('encodes/decodes ' + f.output, () => {
          const script = bscript.fromASM(f.output);
          assert.strictEqual(tools.toHex(script), f.outputHex);
          assert.strictEqual(bscript.toASM(script), f.output);
        });
      }
    });
  });

  describe('isPushOnly', () => {
    fixtures.valid.forEach(f => {
      it('returns ' + !!f.stack + ' for ' + f.asm, () => {
        const script = bscript.fromASM(f.asm);
        const chunks = bscript.decompile(script);

        assert.strictEqual(bscript.isPushOnly(chunks!), !!f.stack);
      });
    });
  });

  describe('toStack', () => {
    fixtures.valid.forEach((f, i) => {
      it('returns ' + !!f.stack + ' for ' + f.asm, () => {
        if (!f.stack || !f.asm) return;

        const script = bscript.fromASM(f.asm);

        const stack = bscript.toStack(script);
        assert.deepStrictEqual(
          stack.map(x => {
            return tools.toHex(x);
          }),
          f.stack,
        );

        assert.strictEqual(
          bscript.toASM(bscript.compile(stack)),
          f.asm,
          'should rebuild same script from stack',
        );
      });
    });
  });

  describe('compile (via fromASM)', () => {
    fixtures.valid.forEach(f => {
      it('compiles ' + f.asm, () => {
        const scriptSig = bscript.fromASM(f.asm);

        assert.strictEqual(tools.toHex(scriptSig), f.script);

        if (f.nonstandard) {
          const scriptSigNS = bscript.fromASM(f.nonstandard.scriptSig);

          assert.strictEqual(tools.toHex(scriptSigNS), f.script);
        }
      });
    });
  });

  describe('decompile', () => {
    fixtures.valid.forEach(f => {
      it('decompiles ' + f.asm, () => {
        const chunks = bscript.decompile(Buffer.from(f.script, 'hex'));

        assert.strictEqual(tools.toHex(bscript.compile(chunks!)), f.script);
        assert.strictEqual(bscript.toASM(chunks!), f.asm);

        if (f.nonstandard) {
          const chunksNS = bscript.decompile(
            Buffer.from(f.nonstandard.scriptSigHex, 'hex'),
          );

          assert.strictEqual(tools.toHex(bscript.compile(chunksNS!)), f.script);

          // toASM converts verbatim, only `compile` transforms the script to a minimalpush compliant script
          assert.strictEqual(bscript.toASM(chunksNS!), f.nonstandard.scriptSig);
        }
      });
    });

    fixtures.invalid.decompile.forEach(f => {
      it(
        'fails to decompile ' + f.script + ',  because "' + f.description + '"',
        () => {
          const chunks = bscript.decompile(Buffer.from(f.script, 'hex'));

          assert.strictEqual(chunks, null);
        },
      );
    });
  });

  describe('SCRIPT_VERIFY_MINIMALDATA policy', () => {
    fixtures.valid.forEach(f => {
      it('compliant for scriptSig ' + f.asm, () => {
        const script = Buffer.from(f.script, 'hex');

        assert.equal(minimalData(script), true);
      });
    });

    function testEncodingForSize(num: number): void {
      it('compliant for data PUSH of length ' + num, () => {
        const buffer = Buffer.alloc(num);
        const script = bscript.compile([buffer]);

        assert.equal(
          minimalData(Buffer.from(script)),
          true,
          'Failed for ' + num + ' length script: ' + tools.toHex(script),
        );
      });
    }

    for (let i = 0; i < 520; ++i) {
      testEncodingForSize(i);
    }
  });
});
