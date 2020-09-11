import * as assert from 'assert';
import * as crypto from 'crypto';
import { describe, it } from 'mocha';

import {
  bip32,
  ECPair,
  networks as NETWORKS,
  payments,
  Psbt,
  Signer,
  SignerAsync,
} from '..';

import * as preFixtures from './fixtures/psbt.json';

const initBuffers = (object: any): typeof preFixtures =>
  JSON.parse(JSON.stringify(object), (_, value) => {
    const regex = new RegExp(/^Buffer.from\(['"](.*)['"], ['"](.*)['"]\)$/);
    const result = regex.exec(value);
    if (!result) return value;

    const data = result[1];
    const encoding = result[2];

    return Buffer.from(data, encoding as BufferEncoding);
  });

const fixtures = initBuffers(preFixtures);

const upperCaseFirstLetter = (str: string): string =>
  str.replace(/^./, s => s.toUpperCase());

const toAsyncSigner = (signer: Signer): SignerAsync => {
  const ret: SignerAsync = {
    publicKey: signer.publicKey,
    sign: (hash: Buffer, lowerR: boolean | undefined): Promise<Buffer> => {
      return new Promise(
        (resolve, rejects): void => {
          setTimeout(() => {
            try {
              const r = signer.sign(hash, lowerR);
              resolve(r);
            } catch (e) {
              rejects(e);
            }
          }, 10);
        },
      );
    },
  };
  return ret;
};
const failedAsyncSigner = (publicKey: Buffer): SignerAsync => {
  return {
    publicKey,
    sign: (__: Buffer): Promise<Buffer> => {
      return new Promise(
        (_, reject): void => {
          setTimeout(() => {
            reject(new Error('sign failed'));
          }, 10);
        },
      );
    },
  };
};
// const b = (hex: string) => Buffer.from(hex, 'hex');

describe(`Psbt`, () => {
  describe('BIP174 Test Vectors', () => {
    fixtures.bip174.invalid.forEach(f => {
      it(`Invalid: ${f.description}`, () => {
        assert.throws(() => {
          Psbt.fromBase64(f.psbt);
        }, new RegExp(f.errorMessage));
      });
    });

    fixtures.bip174.valid.forEach(f => {
      it(`Valid: ${f.description}`, () => {
        assert.doesNotThrow(() => {
          Psbt.fromBase64(f.psbt);
        });
      });
    });

    fixtures.bip174.failSignChecks.forEach(f => {
      const keyPair = ECPair.makeRandom();
      it(`Fails Signer checks: ${f.description}`, () => {
        const psbt = Psbt.fromBase64(f.psbt);
        assert.throws(() => {
          psbt.signInput(f.inputToCheck, keyPair);
        }, new RegExp(f.errorMessage));
      });
    });

    fixtures.bip174.creator.forEach(f => {
      it('Creates expected PSBT', () => {
        const psbt = new Psbt();
        for (const input of f.inputs) {
          psbt.addInput(input);
        }
        for (const output of f.outputs) {
          const script = Buffer.from(output.script, 'hex');
          psbt.addOutput({ ...output, script });
        }
        assert.strictEqual(psbt.toBase64(), f.result);
      });
    });

    fixtures.bip174.updater.forEach(f => {
      it('Updates PSBT to the expected result', () => {
        const psbt = Psbt.fromBase64(f.psbt);

        for (const inputOrOutput of ['input', 'output']) {
          const fixtureData = (f as any)[`${inputOrOutput}Data`];
          if (fixtureData) {
            for (const [i, data] of fixtureData.entries()) {
              const txt = upperCaseFirstLetter(inputOrOutput);
              (psbt as any)[`update${txt}`](i, data);
            }
          }
        }

        assert.strictEqual(psbt.toBase64(), f.result);
      });
    });

    fixtures.bip174.signer.forEach(f => {
      it('Signs PSBT to the expected result', () => {
        const psbt = Psbt.fromBase64(f.psbt);

        f.keys.forEach(({ inputToSign, WIF }) => {
          const keyPair = ECPair.fromWIF(WIF, NETWORKS.testnet);
          psbt.signInput(inputToSign, keyPair);
        });

        assert.strictEqual(psbt.toBase64(), f.result);
      });
    });

    fixtures.bip174.combiner.forEach(f => {
      it('Combines two PSBTs to the expected result', () => {
        const psbts = f.psbts.map(psbt => Psbt.fromBase64(psbt));

        psbts[0].combine(psbts[1]);

        // Produces a different Base64 string due to implemetation specific key-value ordering.
        // That means this test will fail:
        // assert.strictEqual(psbts[0].toBase64(), f.result)
        // However, if we compare the actual PSBT properties we can see they are logically identical:
        assert.deepStrictEqual(psbts[0], Psbt.fromBase64(f.result));
      });
    });

    fixtures.bip174.finalizer.forEach(f => {
      it('Finalizes inputs and gives the expected PSBT', () => {
        const psbt = Psbt.fromBase64(f.psbt);

        psbt.finalizeAllInputs();

        assert.strictEqual(psbt.toBase64(), f.result);
      });
    });

    fixtures.bip174.extractor.forEach(f => {
      it('Extracts the expected transaction from a PSBT', () => {
        const psbt1 = Psbt.fromBase64(f.psbt);
        const transaction1 = psbt1.extractTransaction(true).toHex();

        const psbt2 = Psbt.fromBase64(f.psbt);
        const transaction2 = psbt2.extractTransaction().toHex();

        assert.strictEqual(transaction1, transaction2);
        assert.strictEqual(transaction1, f.transaction);

        const psbt3 = Psbt.fromBase64(f.psbt);
        delete psbt3.data.inputs[0].finalScriptSig;
        delete psbt3.data.inputs[0].finalScriptWitness;
        assert.throws(() => {
          psbt3.extractTransaction();
        }, new RegExp('Not finalized'));

        const psbt4 = Psbt.fromBase64(f.psbt);
        psbt4.setMaximumFeeRate(1);
        assert.throws(() => {
          psbt4.extractTransaction();
        }, new RegExp('Warning: You are paying around [\\d.]+ in fees'));

        const psbt5 = Psbt.fromBase64(f.psbt);
        psbt5.extractTransaction(true);
        const fr1 = psbt5.getFeeRate();
        const fr2 = psbt5.getFeeRate();
        assert.strictEqual(fr1, fr2);

        const psbt6 = Psbt.fromBase64(f.psbt);
        const f1 = psbt6.getFee();
        const f2 = psbt6.getFee();
        assert.strictEqual(f1, f2);
      });
    });
  });

  describe('signInputAsync', () => {
    fixtures.signInput.checks.forEach(f => {
      it(f.description, async () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          await assert.doesNotReject(async () => {
            await psbtThatShouldsign.signInputAsync(
              f.shouldSign.inputToCheck,
              ECPair.fromWIF(f.shouldSign.WIF),
              f.shouldSign.sighashTypes || undefined,
            );
          });
          await assert.rejects(async () => {
            await psbtThatShouldsign.signInputAsync(
              f.shouldSign.inputToCheck,
              failedAsyncSigner(ECPair.fromWIF(f.shouldSign.WIF).publicKey),
              f.shouldSign.sighashTypes || undefined,
            );
          }, /sign failed/);
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          await assert.rejects(async () => {
            await psbtThatShouldThrow.signInputAsync(
              f.shouldThrow.inputToCheck,
              ECPair.fromWIF(f.shouldThrow.WIF),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp(f.shouldThrow.errorMessage));
          await assert.rejects(async () => {
            await psbtThatShouldThrow.signInputAsync(
              f.shouldThrow.inputToCheck,
              toAsyncSigner(ECPair.fromWIF(f.shouldThrow.WIF)),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp(f.shouldThrow.errorMessage));
          await assert.rejects(async () => {
            await (psbtThatShouldThrow.signInputAsync as any)(
              f.shouldThrow.inputToCheck,
            );
          }, new RegExp('Need Signer to sign input'));
        }
      });
    });
  });

  describe('signInput', () => {
    fixtures.signInput.checks.forEach(f => {
      it(f.description, () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          assert.doesNotThrow(() => {
            psbtThatShouldsign.signInput(
              f.shouldSign.inputToCheck,
              ECPair.fromWIF(f.shouldSign.WIF),
              f.shouldSign.sighashTypes || undefined,
            );
          });
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          assert.throws(() => {
            psbtThatShouldThrow.signInput(
              f.shouldThrow.inputToCheck,
              ECPair.fromWIF(f.shouldThrow.WIF),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp(f.shouldThrow.errorMessage));
          assert.throws(() => {
            (psbtThatShouldThrow.signInput as any)(f.shouldThrow.inputToCheck);
          }, new RegExp('Need Signer to sign input'));
        }
      });
    });
  });

  describe('signAllInputsAsync', () => {
    fixtures.signInput.checks.forEach(f => {
      if (f.description === 'checks the input exists') return;
      it(f.description, async () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          await assert.doesNotReject(async () => {
            await psbtThatShouldsign.signAllInputsAsync(
              ECPair.fromWIF(f.shouldSign.WIF),
              f.shouldSign.sighashTypes || undefined,
            );
          });
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          await assert.rejects(async () => {
            await psbtThatShouldThrow.signAllInputsAsync(
              ECPair.fromWIF(f.shouldThrow.WIF),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp('No inputs were signed'));
          await assert.rejects(async () => {
            await (psbtThatShouldThrow.signAllInputsAsync as any)();
          }, new RegExp('Need Signer to sign input'));
        }
      });
    });
  });

  describe('signAllInputs', () => {
    fixtures.signInput.checks.forEach(f => {
      if (f.description === 'checks the input exists') return;
      it(f.description, () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          assert.doesNotThrow(() => {
            psbtThatShouldsign.signAllInputs(
              ECPair.fromWIF(f.shouldSign.WIF),
              f.shouldSign.sighashTypes || undefined,
            );
          });
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          assert.throws(() => {
            psbtThatShouldThrow.signAllInputs(
              ECPair.fromWIF(f.shouldThrow.WIF),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp('No inputs were signed'));
          assert.throws(() => {
            (psbtThatShouldThrow.signAllInputs as any)();
          }, new RegExp('Need Signer to sign input'));
        }
      });
    });
  });

  describe('signInputHDAsync', () => {
    fixtures.signInputHD.checks.forEach(f => {
      it(f.description, async () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          await assert.doesNotReject(async () => {
            await psbtThatShouldsign.signInputHDAsync(
              f.shouldSign.inputToCheck,
              bip32.fromBase58(f.shouldSign.xprv),
              (f.shouldSign as any).sighashTypes || undefined,
            );
          });
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          await assert.rejects(async () => {
            await psbtThatShouldThrow.signInputHDAsync(
              f.shouldThrow.inputToCheck,
              bip32.fromBase58(f.shouldThrow.xprv),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp(f.shouldThrow.errorMessage));
          await assert.rejects(async () => {
            await (psbtThatShouldThrow.signInputHDAsync as any)(
              f.shouldThrow.inputToCheck,
            );
          }, new RegExp('Need HDSigner to sign input'));
        }
      });
    });
  });

  describe('signInputHD', () => {
    fixtures.signInputHD.checks.forEach(f => {
      it(f.description, () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          assert.doesNotThrow(() => {
            psbtThatShouldsign.signInputHD(
              f.shouldSign.inputToCheck,
              bip32.fromBase58(f.shouldSign.xprv),
              (f.shouldSign as any).sighashTypes || undefined,
            );
          });
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          assert.throws(() => {
            psbtThatShouldThrow.signInputHD(
              f.shouldThrow.inputToCheck,
              bip32.fromBase58(f.shouldThrow.xprv),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp(f.shouldThrow.errorMessage));
          assert.throws(() => {
            (psbtThatShouldThrow.signInputHD as any)(
              f.shouldThrow.inputToCheck,
            );
          }, new RegExp('Need HDSigner to sign input'));
        }
      });
    });
  });

  describe('signAllInputsHDAsync', () => {
    fixtures.signInputHD.checks.forEach(f => {
      it(f.description, async () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          await assert.doesNotReject(async () => {
            await psbtThatShouldsign.signAllInputsHDAsync(
              bip32.fromBase58(f.shouldSign.xprv),
              (f.shouldSign as any).sighashTypes || undefined,
            );
          });
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          await assert.rejects(async () => {
            await psbtThatShouldThrow.signAllInputsHDAsync(
              bip32.fromBase58(f.shouldThrow.xprv),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp('No inputs were signed'));
          await assert.rejects(async () => {
            await (psbtThatShouldThrow.signAllInputsHDAsync as any)();
          }, new RegExp('Need HDSigner to sign input'));
        }
      });
    });
  });

  describe('signAllInputsHD', () => {
    fixtures.signInputHD.checks.forEach(f => {
      it(f.description, () => {
        if (f.shouldSign) {
          const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt);
          assert.doesNotThrow(() => {
            psbtThatShouldsign.signAllInputsHD(
              bip32.fromBase58(f.shouldSign.xprv),
              (f.shouldSign as any).sighashTypes || undefined,
            );
          });
        }

        if (f.shouldThrow) {
          const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt);
          assert.throws(() => {
            psbtThatShouldThrow.signAllInputsHD(
              bip32.fromBase58(f.shouldThrow.xprv),
              (f.shouldThrow as any).sighashTypes || undefined,
            );
          }, new RegExp('No inputs were signed'));
          assert.throws(() => {
            (psbtThatShouldThrow.signAllInputsHD as any)();
          }, new RegExp('Need HDSigner to sign input'));
        }
      });
    });
  });

  describe('finalizeAllInputs', () => {
    fixtures.finalizeAllInputs.forEach(f => {
      it(`Finalizes inputs of type "${f.type}"`, () => {
        const psbt = Psbt.fromBase64(f.psbt);

        psbt.finalizeAllInputs();

        assert.strictEqual(psbt.toBase64(), f.result);
      });
    });
    it('fails if no script found', () => {
      const psbt = new Psbt();
      psbt.addInput({
        hash:
          '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
      });
      assert.throws(() => {
        psbt.finalizeAllInputs();
      }, new RegExp('No script found for input #0'));
      psbt.updateInput(0, {
        witnessUtxo: {
          script: Buffer.from(
            '0014d85c2b71d0060b09c9886aeb815e50991dda124d',
            'hex',
          ),
          value: 2e5,
        },
      });
      assert.throws(() => {
        psbt.finalizeAllInputs();
      }, new RegExp('Can not finalize input #0'));
    });
  });

  describe('addInput', () => {
    fixtures.addInput.checks.forEach(f => {
      it(f.description, () => {
        const psbt = new Psbt();

        if (f.exception) {
          assert.throws(() => {
            psbt.addInput(f.inputData as any);
          }, new RegExp(f.exception));
          assert.throws(() => {
            psbt.addInputs([f.inputData as any]);
          }, new RegExp(f.exception));
        } else {
          assert.doesNotThrow(() => {
            psbt.addInputs([f.inputData as any]);
            if (f.equals) {
              assert.strictEqual(psbt.toBase64(), f.equals);
            }
          });
          assert.throws(() => {
            psbt.addInput(f.inputData as any);
          }, new RegExp('Duplicate input detected.'));
        }
      });
    });
  });

  describe('addOutput', () => {
    fixtures.addOutput.checks.forEach(f => {
      it(f.description, () => {
        const psbt = new Psbt();

        if (f.exception) {
          assert.throws(() => {
            psbt.addOutput(f.outputData as any);
          }, new RegExp(f.exception));
          assert.throws(() => {
            psbt.addOutputs([f.outputData as any]);
          }, new RegExp(f.exception));
        } else {
          assert.doesNotThrow(() => {
            psbt.addOutput(f.outputData as any);
          });
          assert.doesNotThrow(() => {
            psbt.addOutputs([f.outputData as any]);
          });
        }
      });
    });
  });

  describe('setVersion', () => {
    it('Sets the version value of the unsigned transaction', () => {
      const psbt = new Psbt();

      assert.strictEqual(psbt.extractTransaction().version, 2);
      psbt.setVersion(1);
      assert.strictEqual(psbt.extractTransaction().version, 1);
    });
  });

  describe('setLocktime', () => {
    it('Sets the nLockTime value of the unsigned transaction', () => {
      const psbt = new Psbt();

      assert.strictEqual(psbt.extractTransaction().locktime, 0);
      psbt.setLocktime(1);
      assert.strictEqual(psbt.extractTransaction().locktime, 1);
    });
  });

  describe('setInputSequence', () => {
    it('Sets the sequence number for a given input', () => {
      const psbt = new Psbt();
      psbt.addInput({
        hash:
          '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
      });

      assert.strictEqual(psbt.inputCount, 1);
      assert.strictEqual(psbt.txInputs[0].sequence, 0xffffffff);
      psbt.setInputSequence(0, 0);
      assert.strictEqual(psbt.txInputs[0].sequence, 0);
    });

    it('throws if input index is too high', () => {
      const psbt = new Psbt();
      psbt.addInput({
        hash:
          '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
      });

      assert.throws(() => {
        psbt.setInputSequence(1, 0);
      }, new RegExp('Input index too high'));
    });
  });

  describe('getInputType', () => {
    const key = ECPair.makeRandom();
    const { publicKey } = key;
    const p2wpkhPub = (pubkey: Buffer): Buffer =>
      payments.p2wpkh({
        pubkey,
      }).output!;
    const p2pkhPub = (pubkey: Buffer): Buffer =>
      payments.p2pkh({
        pubkey,
      }).output!;
    const p2shOut = (output: Buffer): Buffer =>
      payments.p2sh({
        redeem: { output },
      }).output!;
    const p2wshOut = (output: Buffer): Buffer =>
      payments.p2wsh({
        redeem: { output },
      }).output!;
    const p2shp2wshOut = (output: Buffer): Buffer => p2shOut(p2wshOut(output));
    const noOuter = (output: Buffer): Buffer => output;

    function getInputTypeTest({
      innerScript,
      outerScript,
      redeemGetter,
      witnessGetter,
      expectedType,
      finalize,
    }: any): void {
      const psbt = new Psbt();
      psbt
        .addInput({
          hash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          index: 0,
          witnessUtxo: {
            script: outerScript(innerScript(publicKey)),
            value: 2e3,
          },
          ...(redeemGetter ? { redeemScript: redeemGetter(publicKey) } : {}),
          ...(witnessGetter ? { witnessScript: witnessGetter(publicKey) } : {}),
        })
        .addOutput({
          script: Buffer.from('0014d85c2b71d0060b09c9886aeb815e50991dda124d'),
          value: 1800,
        });
      if (finalize) psbt.signInput(0, key).finalizeInput(0);
      const type = psbt.getInputType(0);
      assert.strictEqual(type, expectedType, 'incorrect input type');
    }
    [
      {
        innerScript: p2pkhPub,
        outerScript: noOuter,
        redeemGetter: null,
        witnessGetter: null,
        expectedType: 'pubkeyhash',
      },
      {
        innerScript: p2wpkhPub,
        outerScript: noOuter,
        redeemGetter: null,
        witnessGetter: null,
        expectedType: 'witnesspubkeyhash',
      },
      {
        innerScript: p2pkhPub,
        outerScript: p2shOut,
        redeemGetter: p2pkhPub,
        witnessGetter: null,
        expectedType: 'p2sh-pubkeyhash',
      },
      {
        innerScript: p2wpkhPub,
        outerScript: p2shOut,
        redeemGetter: p2wpkhPub,
        witnessGetter: null,
        expectedType: 'p2sh-witnesspubkeyhash',
        finalize: true,
      },
      {
        innerScript: p2pkhPub,
        outerScript: p2wshOut,
        redeemGetter: null,
        witnessGetter: p2pkhPub,
        expectedType: 'p2wsh-pubkeyhash',
        finalize: true,
      },
      {
        innerScript: p2pkhPub,
        outerScript: p2shp2wshOut,
        redeemGetter: (pk: Buffer): Buffer => p2wshOut(p2pkhPub(pk)),
        witnessGetter: p2pkhPub,
        expectedType: 'p2sh-p2wsh-pubkeyhash',
      },
    ].forEach(getInputTypeTest);
  });

  describe('inputHasHDKey', () => {
    it('should return true if HD key is present', () => {
      const root = bip32.fromSeed(crypto.randomBytes(32));
      const root2 = bip32.fromSeed(crypto.randomBytes(32));
      const path = "m/0'/0";
      const psbt = new Psbt();
      psbt.addInput({
        hash:
          '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        bip32Derivation: [
          {
            masterFingerprint: root.fingerprint,
            path,
            pubkey: root.derivePath(path).publicKey,
          },
        ],
      });
      assert.strictEqual(psbt.inputHasHDKey(0, root), true);
      assert.strictEqual(psbt.inputHasHDKey(0, root2), false);
    });
  });

  describe('inputHasPubkey', () => {
    it('should throw', () => {
      const psbt = new Psbt();
      psbt.addInput({
        hash:
          '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
      });

      assert.throws(() => {
        psbt.inputHasPubkey(0, Buffer.from([]));
      }, new RegExp("Can't find pubkey in input without Utxo data"));

      psbt.updateInput(0, {
        witnessUtxo: {
          value: 1337,
          script: payments.p2sh({
            redeem: { output: Buffer.from([0x51]) },
          }).output!,
        },
      });

      assert.throws(() => {
        psbt.inputHasPubkey(0, Buffer.from([]));
      }, new RegExp('scriptPubkey is P2SH but redeemScript missing'));

      delete psbt.data.inputs[0].witnessUtxo;

      psbt.updateInput(0, {
        witnessUtxo: {
          value: 1337,
          script: payments.p2wsh({
            redeem: { output: Buffer.from([0x51]) },
          }).output!,
        },
      });

      assert.throws(() => {
        psbt.inputHasPubkey(0, Buffer.from([]));
      }, new RegExp('scriptPubkey or redeemScript is P2WSH but witnessScript missing'));

      delete psbt.data.inputs[0].witnessUtxo;

      psbt.updateInput(0, {
        witnessUtxo: {
          value: 1337,
          script: payments.p2sh({
            redeem: payments.p2wsh({
              redeem: { output: Buffer.from([0x51]) },
            }),
          }).output!,
        },
        redeemScript: payments.p2wsh({
          redeem: { output: Buffer.from([0x51]) },
        }).output!,
      });

      assert.throws(() => {
        psbt.inputHasPubkey(0, Buffer.from([]));
      }, new RegExp('scriptPubkey or redeemScript is P2WSH but witnessScript missing'));

      psbt.updateInput(0, {
        witnessScript: Buffer.from([0x51]),
      });

      assert.doesNotThrow(() => {
        psbt.inputHasPubkey(0, Buffer.from([0x51]));
      });
    });
  });

  describe('outputHasHDKey', () => {
    it('should return true if HD key is present', () => {
      const root = bip32.fromSeed(crypto.randomBytes(32));
      const root2 = bip32.fromSeed(crypto.randomBytes(32));
      const path = "m/0'/0";
      const psbt = new Psbt();
      psbt
        .addInput({
          hash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          index: 0,
        })
        .addOutput({
          script: Buffer.from(
            '0014000102030405060708090a0b0c0d0e0f00010203',
            'hex',
          ),
          value: 2000,
          bip32Derivation: [
            {
              masterFingerprint: root.fingerprint,
              path,
              pubkey: root.derivePath(path).publicKey,
            },
          ],
        });
      assert.strictEqual(psbt.outputHasHDKey(0, root), true);
      assert.strictEqual(psbt.outputHasHDKey(0, root2), false);
    });
  });

  describe('outputHasPubkey', () => {
    it('should throw', () => {
      const psbt = new Psbt();
      psbt
        .addInput({
          hash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          index: 0,
        })
        .addOutput({
          script: payments.p2sh({
            redeem: { output: Buffer.from([0x51]) },
          }).output!,
          value: 1337,
        });

      assert.throws(() => {
        psbt.outputHasPubkey(0, Buffer.from([]));
      }, new RegExp('scriptPubkey is P2SH but redeemScript missing'));

      (psbt as any).__CACHE.__TX.outs[0].script = payments.p2wsh({
        redeem: { output: Buffer.from([0x51]) },
      }).output!;

      assert.throws(() => {
        psbt.outputHasPubkey(0, Buffer.from([]));
      }, new RegExp('scriptPubkey or redeemScript is P2WSH but witnessScript missing'));

      (psbt as any).__CACHE.__TX.outs[0].script = payments.p2sh({
        redeem: payments.p2wsh({
          redeem: { output: Buffer.from([0x51]) },
        }),
      }).output!;

      psbt.updateOutput(0, {
        redeemScript: payments.p2wsh({
          redeem: { output: Buffer.from([0x51]) },
        }).output!,
      });

      assert.throws(() => {
        psbt.outputHasPubkey(0, Buffer.from([]));
      }, new RegExp('scriptPubkey or redeemScript is P2WSH but witnessScript missing'));

      delete psbt.data.outputs[0].redeemScript;

      psbt.updateOutput(0, {
        witnessScript: Buffer.from([0x51]),
      });

      assert.throws(() => {
        psbt.outputHasPubkey(0, Buffer.from([]));
      }, new RegExp('scriptPubkey is P2SH but redeemScript missing'));

      psbt.updateOutput(0, {
        redeemScript: payments.p2wsh({
          redeem: { output: Buffer.from([0x51]) },
        }).output!,
      });

      assert.doesNotThrow(() => {
        psbt.outputHasPubkey(0, Buffer.from([0x51]));
      });
    });
  });

  describe('clone', () => {
    it('Should clone a psbt exactly with no reference', () => {
      const f = fixtures.clone;
      const psbt = Psbt.fromBase64(f.psbt);
      const notAClone = Object.assign(new Psbt(), psbt); // references still active
      const clone = psbt.clone();

      assert.strictEqual(psbt.validateSignaturesOfAllInputs(), true);

      assert.strictEqual(clone.toBase64(), psbt.toBase64());
      assert.strictEqual(clone.toBase64(), notAClone.toBase64());
      assert.strictEqual(psbt.toBase64(), notAClone.toBase64());
      (psbt as any).__CACHE.__TX.version |= 0xff0000;
      assert.notStrictEqual(clone.toBase64(), psbt.toBase64());
      assert.notStrictEqual(clone.toBase64(), notAClone.toBase64());
      assert.strictEqual(psbt.toBase64(), notAClone.toBase64());
    });
  });

  describe('setMaximumFeeRate', () => {
    it('Sets the maximumFeeRate value', () => {
      const psbt = new Psbt();

      assert.strictEqual((psbt as any).opts.maximumFeeRate, 5000);
      psbt.setMaximumFeeRate(6000);
      assert.strictEqual((psbt as any).opts.maximumFeeRate, 6000);
    });
  });

  describe('validateSignaturesOfInput', () => {
    const f = fixtures.validateSignaturesOfInput;
    it('Correctly validates a signature', () => {
      const psbt = Psbt.fromBase64(f.psbt);

      assert.strictEqual(psbt.validateSignaturesOfInput(f.index), true);
      assert.throws(() => {
        psbt.validateSignaturesOfInput(f.nonExistantIndex);
      }, new RegExp('No signatures to validate'));
    });

    it('Correctly validates a signature against a pubkey', () => {
      const psbt = Psbt.fromBase64(f.psbt);
      assert.strictEqual(
        psbt.validateSignaturesOfInput(f.index, f.pubkey as any),
        true,
      );
      assert.throws(() => {
        psbt.validateSignaturesOfInput(f.index, f.incorrectPubkey as any);
      }, new RegExp('No signatures for this pubkey'));
    });
  });

  describe('getFeeRate', () => {
    it('Throws error if called before inputs are finalized', () => {
      const f = fixtures.getFeeRate;
      const psbt = Psbt.fromBase64(f.psbt);

      assert.throws(() => {
        psbt.getFeeRate();
      }, new RegExp('PSBT must be finalized to calculate fee rate'));

      psbt.finalizeAllInputs();

      assert.strictEqual(psbt.getFeeRate(), f.fee);
      (psbt as any).__CACHE.__FEE_RATE = undefined;
      assert.strictEqual(psbt.getFeeRate(), f.fee);
    });
  });

  describe('create 1-to-1 transaction', () => {
    const alice = ECPair.fromWIF(
      'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr',
    );
    const psbt = new Psbt();
    psbt.addInput({
      hash: '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
      index: 0,
      nonWitnessUtxo: Buffer.from(
        '0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9' +
          '452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48' +
          'ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc566020' +
          '9e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec' +
          '631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bb' +
          'c95d2709c71607c60ee3f097c1217482f518d88ac00000000',
        'hex',
      ),
      sighashType: 1,
    });
    psbt.addOutput({
      address: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
      value: 80000,
    });
    psbt.signInput(0, alice);
    assert.throws(() => {
      psbt.setVersion(3);
    }, new RegExp('Can not modify transaction, signatures exist.'));
    psbt.validateSignaturesOfInput(0);
    psbt.finalizeAllInputs();
    assert.throws(() => {
      psbt.setVersion(3);
    }, new RegExp('Can not modify transaction, signatures exist.'));
    assert.strictEqual(psbt.inputHasPubkey(0, alice.publicKey), true);
    assert.strictEqual(psbt.outputHasPubkey(0, alice.publicKey), false);
    assert.strictEqual(
      psbt.extractTransaction().toHex(),
      '02000000013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7' +
        'b067d000000006b483045022100931b6db94aed25d5486884d83fc37160f37f3368c0' +
        'd7f48c757112abefec983802205fda64cff98c849577026eb2ce916a50ea70626a766' +
        '9f8596dd89b720a26b4d501210365db9da3f8a260078a7e8f8b708a1161468fb2323f' +
        'fda5ec16b261ec1056f455ffffffff0180380100000000001976a914ca0d36044e0dc' +
        '08a22724efa6f6a07b0ec4c79aa88ac00000000',
    );
  });

  describe('Method return types', () => {
    it('fromBuffer returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromBuffer(
        Buffer.from(
          '70736274ff01000a01000000000000000000000000',
          'hex', // cHNidP8BAAoBAAAAAAAAAAAAAAAA
        ),
      );
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok((psbt as any).__CACHE.__TX);
    });
    it('fromBase64 returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromBase64('cHNidP8BAAoBAAAAAAAAAAAAAAAA');
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok((psbt as any).__CACHE.__TX);
    });
    it('fromHex returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromHex('70736274ff01000a01000000000000000000000000');
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok((psbt as any).__CACHE.__TX);
    });
  });

  describe('Cache', () => {
    it('non-witness UTXOs are cached', () => {
      const f = fixtures.cache.nonWitnessUtxo;
      const psbt = Psbt.fromBase64(f.psbt);
      const index = f.inputIndex;

      // Cache is empty
      assert.strictEqual(
        (psbt as any).__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index],
        undefined,
      );

      // Cache is populated
      psbt.updateInput(index, { nonWitnessUtxo: f.nonWitnessUtxo as any });
      const value = psbt.data.inputs[index].nonWitnessUtxo;
      assert.ok(
        (psbt as any).__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index].equals(value),
      );
      assert.ok(
        (psbt as any).__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index].equals(
          f.nonWitnessUtxo,
        ),
      );

      // Cache is rebuilt from internal transaction object when cleared
      psbt.data.inputs[index].nonWitnessUtxo = Buffer.from([1, 2, 3]);
      (psbt as any).__CACHE.__NON_WITNESS_UTXO_BUF_CACHE[index] = undefined;
      assert.ok((psbt as any).data.inputs[index].nonWitnessUtxo.equals(value));
    });
  });

  describe('Transaction properties', () => {
    it('.version is exposed and is settable', () => {
      const psbt = new Psbt();

      assert.strictEqual(psbt.version, 2);
      assert.strictEqual(psbt.version, (psbt as any).__CACHE.__TX.version);

      psbt.version = 1;
      assert.strictEqual(psbt.version, 1);
      assert.strictEqual(psbt.version, (psbt as any).__CACHE.__TX.version);
    });

    it('.locktime is exposed and is settable', () => {
      const psbt = new Psbt();

      assert.strictEqual(psbt.locktime, 0);
      assert.strictEqual(psbt.locktime, (psbt as any).__CACHE.__TX.locktime);

      psbt.locktime = 123;
      assert.strictEqual(psbt.locktime, 123);
      assert.strictEqual(psbt.locktime, (psbt as any).__CACHE.__TX.locktime);
    });

    it('.txInputs is exposed as a readonly clone', () => {
      const psbt = new Psbt();
      const hash = Buffer.alloc(32);
      const index = 0;
      psbt.addInput({ hash, index });

      const input = psbt.txInputs[0];
      const internalInput = (psbt as any).__CACHE.__TX.ins[0];

      assert.ok(input.hash.equals(internalInput.hash));
      assert.strictEqual(input.index, internalInput.index);
      assert.strictEqual(input.sequence, internalInput.sequence);

      input.hash[0] = 123;
      input.index = 123;
      input.sequence = 123;

      assert.ok(!input.hash.equals(internalInput.hash));
      assert.notEqual(input.index, internalInput.index);
      assert.notEqual(input.sequence, internalInput.sequence);
    });

    it('.txOutputs is exposed as a readonly clone', () => {
      const psbt = new Psbt();
      const address = '1LukeQU5jwebXbMLDVydeH4vFSobRV9rkj';
      const value = 100000;
      psbt.addOutput({ address, value });

      const output = psbt.txOutputs[0];
      const internalInput = (psbt as any).__CACHE.__TX.outs[0];

      assert.strictEqual(output.address, address);

      assert.ok(output.script.equals(internalInput.script));
      assert.strictEqual(output.value, internalInput.value);

      output.script[0] = 123;
      output.value = 123;

      assert.ok(!output.script.equals(internalInput.script));
      assert.notEqual(output.value, internalInput.value);
    });
  });
});
