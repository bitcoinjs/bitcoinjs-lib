import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as classify from '../src/classify';
import * as bscript from '../src/script';

import * as fixtures from './fixtures/templates.json';

import * as multisig from '../src/templates/multisig';
import * as nullData from '../src/templates/nulldata';
import * as pubKey from '../src/templates/pubkey';
import * as pubKeyHash from '../src/templates/pubkeyhash';
import * as scriptHash from '../src/templates/scripthash';
import * as witnessCommitment from '../src/templates/witnesscommitment';
import * as witnessPubKeyHash from '../src/templates/witnesspubkeyhash';
import * as witnessScriptHash from '../src/templates/witnessscripthash';

const tmap = {
  pubKey,
  pubKeyHash,
  scriptHash,
  witnessPubKeyHash,
  witnessScriptHash,
  multisig,
  nullData,
  witnessCommitment,
};

describe('classify', () => {
  describe('input', () => {
    fixtures.valid.forEach(f => {
      if (!f.input) return;

      it('classifies ' + f.input + ' as ' + f.type, () => {
        const input = bscript.fromASM(f.input);
        const type = classify.input(input);

        assert.strictEqual(type, f.type);
      });
    });

    fixtures.valid.forEach(f => {
      if (!f.input) return;
      if (!f.typeIncomplete) return;

      it('classifies incomplete ' + f.input + ' as ' + f.typeIncomplete, () => {
        const input = bscript.fromASM(f.input);
        const type = classify.input(input, true);

        assert.strictEqual(type, f.typeIncomplete);
      });
    });
  });

  describe('classifyOutput', () => {
    fixtures.valid.forEach(f => {
      if (!f.output) return;

      it('classifies ' + f.output + ' as ' + f.type, () => {
        const output = bscript.fromASM(f.output);
        const type = classify.output(output);

        assert.strictEqual(type, f.type);
      });
    });
  });
  [
    'pubKey',
    'pubKeyHash',
    'scriptHash',
    'witnessPubKeyHash',
    'witnessScriptHash',
    'multisig',
    'nullData',
    'witnessCommitment',
  ].forEach(name => {
    const inputType = (tmap as any)[name].input;
    const outputType = (tmap as any)[name].output;

    describe(name + '.input.check', () => {
      fixtures.valid.forEach(f => {
        if (name.toLowerCase() === classify.types.P2WPKH) return;
        if (name.toLowerCase() === classify.types.P2WSH) return;
        const expected = name.toLowerCase() === f.type.toLowerCase();

        if (inputType && f.input) {
          const input = bscript.fromASM(f.input);

          it('returns ' + expected + ' for ' + f.input, () => {
            assert.strictEqual(inputType.check(input), expected);
          });

          if (f.typeIncomplete) {
            const expectedIncomplete = name.toLowerCase() === f.typeIncomplete;

            it('returns ' + expected + ' for ' + f.input, () => {
              assert.strictEqual(
                inputType.check(input, true),
                expectedIncomplete,
              );
            });
          }
        }
      });

      if (!(fixtures.invalid as any)[name]) return;

      (fixtures.invalid as any)[name].inputs.forEach((f: any) => {
        if (!f.input && !f.inputHex) return;

        it(
          'returns false for ' +
            f.description +
            ' (' +
            (f.input || f.inputHex) +
            ')',
          () => {
            let input;

            if (f.input) {
              input = bscript.fromASM(f.input);
            } else {
              input = Buffer.from(f.inputHex, 'hex');
            }

            assert.strictEqual(inputType.check(input), false);
          },
        );
      });
    });

    describe(name + '.output.check', () => {
      fixtures.valid.forEach(f => {
        const expected = name.toLowerCase() === f.type;

        if (outputType && f.output) {
          it('returns ' + expected + ' for ' + f.output, () => {
            const output = bscript.fromASM(f.output);

            if (
              name.toLowerCase() === 'nulldata' &&
              f.type === classify.types.WITNESS_COMMITMENT
            )
              return;
            if (
              name.toLowerCase() === 'witnesscommitment' &&
              f.type === classify.types.NULLDATA
            )
              return;
            assert.strictEqual(outputType.check(output), expected);
          });
        }
      });

      if (!(fixtures.invalid as any)[name]) return;

      (fixtures.invalid as any)[name].outputs.forEach((f: any) => {
        if (!f.output && !f.outputHex) return;

        it(
          'returns false for ' +
            f.description +
            ' (' +
            (f.output || f.outputHex) +
            ')',
          () => {
            let output;

            if (f.output) {
              output = bscript.fromASM(f.output);
            } else {
              output = Buffer.from(f.outputHex, 'hex');
            }

            assert.strictEqual(outputType.check(output), false);
          },
        );
      });
    });
  });
});
