'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const __1 = require('..');
const { describe, it } = require('mocha');
const assert = require('assert');
const minimalData = require('minimaldata');
const fixtures = require('../ts_test/fixtures/script.json');
const fixtures2 = require('../ts_test/fixtures/templates.json');
describe('script', () => {
  // TODO
  describe('isCanonicalPubKey', () => {
    it('rejects if not provided a Buffer', () => {
      // @ts-ignore
      assert.strictEqual(false, __1.script.isCanonicalPubKey(0));
    });
    it('rejects smaller than 33', () => {
      for (let i = 0; i < 33; i++) {
        assert.strictEqual(
          false,
          __1.script.isCanonicalPubKey(Buffer.allocUnsafe(i)),
        );
      }
    });
  });
  describe.skip('isCanonicalScriptSignature', () => {
    console.log('skip me');
  });
  describe('fromASM/toASM', () => {
    fixtures.valid.forEach(f => {
      it('encodes/decodes ' + f.asm, () => {
        const script = __1.script.fromASM(f.asm);
        assert.strictEqual(__1.script.toASM(script), f.asm);
      });
    });
    fixtures.invalid.fromASM.forEach(f => {
      it('throws ' + f.description, () => {
        assert.throws(() => {
          __1.script.fromASM(f.script);
        }, new RegExp(f.description));
      });
    });
  });
  describe('fromASM/toASM (templates)', () => {
    fixtures2.valid.forEach(f => {
      if (f.inputHex) {
        const ih = __1.script.toASM(Buffer.from(f.inputHex, 'hex'));
        it('encodes/decodes ' + ih, () => {
          const script = __1.script.fromASM(f.input);
          assert.strictEqual(script.toString('hex'), f.inputHex);
          assert.strictEqual(__1.script.toASM(script), f.input);
        });
      }
      if (f.outputHex) {
        it('encodes/decodes ' + f.output, () => {
          const script = __1.script.fromASM(f.output);
          assert.strictEqual(script.toString('hex'), f.outputHex);
          assert.strictEqual(__1.script.toASM(script), f.output);
        });
      }
    });
  });
  describe('isPushOnly', () => {
    fixtures.valid.forEach(f => {
      it('returns ' + !!f.stack + ' for ' + f.asm, () => {
        const script = __1.script.fromASM(f.asm);
        const chunks = __1.script.decompile(script);
        assert.strictEqual(__1.script.isPushOnly(chunks), !!f.stack);
      });
    });
  });
  describe('toStack', () => {
    fixtures.valid.forEach(f => {
      it('returns ' + !!f.stack + ' for ' + f.asm, () => {
        if (!f.stack || !f.asm) return;
        const script = __1.script.fromASM(f.asm);
        const stack = __1.script.toStack(script);
        assert.deepStrictEqual(
          stack.map(x => {
            return x.toString('hex');
          }),
          f.stack,
        );
        assert.strictEqual(
          __1.script.toASM(__1.script.compile(stack)),
          f.asm,
          'should rebuild same script from stack',
        );
      });
    });
  });
  describe('compile (via fromASM)', () => {
    fixtures.valid.forEach(f => {
      it('(' + f.type + ') compiles ' + f.asm, () => {
        const scriptSig = __1.script.fromASM(f.asm);
        assert.strictEqual(scriptSig.toString('hex'), f.script);
        if (f.nonstandard) {
          const scriptSigNS = __1.script.fromASM(f.nonstandard.scriptSig);
          assert.strictEqual(scriptSigNS.toString('hex'), f.script);
        }
      });
    });
  });
  describe('decompile', () => {
    fixtures.valid.forEach(f => {
      it('decompiles ' + f.asm, () => {
        const chunks = __1.script.decompile(Buffer.from(f.script, 'hex'));
        assert.strictEqual(
          __1.script.compile(chunks).toString('hex'),
          f.script,
        );
        assert.strictEqual(__1.script.toASM(chunks), f.asm);
        if (f.nonstandard) {
          const chunksNS = __1.script.decompile(
            Buffer.from(f.nonstandard.scriptSigHex, 'hex'),
          );
          assert.strictEqual(
            __1.script.compile(chunksNS).toString('hex'),
            f.script,
          );
          // toASM converts verbatim, only `compile` transforms the script to a minimalpush compliant script
          assert.strictEqual(
            __1.script.toASM(chunksNS),
            f.nonstandard.scriptSig,
          );
        }
      });
    });
    fixtures.invalid.decompile.forEach(f => {
      it(
        'fails to decompile ' + f.script + ',  because "' + f.description + '"',
        () => {
          const chunks = __1.script.decompile(Buffer.from(f.script, 'hex'));
          assert.strictEqual(chunks, null);
        },
      );
    });
  });
  describe('SCRIPT_VERIFY_MINIMALDATA policy', () => {
    fixtures.valid.forEach(f => {
      it('compliant for ' + f.type + ' scriptSig ' + f.asm, () => {
        const script = Buffer.from(f.script, 'hex');
        assert(minimalData(script));
      });
    });
    function testEncodingForSize(i) {
      it('compliant for data PUSH of length ' + i, () => {
        const buffer = Buffer.alloc(i);
        const script = __1.script.compile([buffer]);
        assert(
          minimalData(script),
          'Failed for ' + i + ' length script: ' + script.toString('hex'),
        );
      });
    }
    for (let i = 0; i < 520; ++i) {
      testEncodingForSize(i);
    }
  });
});
