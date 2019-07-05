const { describe, it } = require('mocha')
const assert = require('assert')

const ECPair = require('../src/ecpair')
const Psbt = require('..').Psbt
const NETWORKS = require('../src/networks')

const fixtures = require('./fixtures/psbt')

const upperCaseFirstLetter = str => str.replace(/^./, s => s.toUpperCase())

const b = hex => Buffer.from(hex, 'hex');

const initBuffers = (attr, data) => {
  if ([
    'nonWitnessUtxo',
    'redeemScript',
    'witnessScript'
  ].includes(attr)) {
    data = b(data)
  } else if (attr === 'bip32Derivation') {
    data.masterFingerprint = b(data.masterFingerprint)
    data.pubkey = b(data.pubkey)
  }  else if (attr === 'witnessUtxo') {
    data.script = b(data.script)
  }

  return data
};

describe(`Psbt`, () => {
  describe('BIP174 Test Vectors', () => {
    fixtures.bip174.invalid.forEach(f => {
      it(`Invalid: ${f.description}`, () => {
        assert.throws(() => {
          Psbt.fromBase64(f.psbt)
        }, {message: f.errorMessage})
      })
    })

    fixtures.bip174.valid.forEach(f => {
      it(`Valid: ${f.description}`, () => {
        assert.doesNotThrow(() => {
          Psbt.fromBase64(f.psbt)
        })
      })
    })

    fixtures.bip174.failSignChecks.forEach(f => {
      const keyPair = ECPair.makeRandom()
      it(`Fails Signer checks: ${f.description}`, () => {
        const psbt =  Psbt.fromBase64(f.psbt)
        assert.throws(() => {
          psbt.signInput(f.inputToCheck, keyPair)
        }, {message: f.errorMessage})
      })
    })

    fixtures.bip174.creator.forEach(f => {
      it('Creates expected PSBT', () => {
        const psbt = new Psbt()
        for (const input of f.inputs) {
          psbt.addInput(input)
        }
        for (const output of f.outputs) {
          const script = Buffer.from(output.script, 'hex');
          psbt.addOutput({...output, script})
        }
        assert.strictEqual(psbt.toBase64(), f.result)
      })
    })

    fixtures.bip174.updater.forEach(f => {
      it('Updates PSBT to the expected result', () => {
        const psbt = Psbt.fromBase64(f.psbt)

        for (const inputOrOutput of ['input', 'output']) {
          const fixtureData = f[`${inputOrOutput}Data`]
          if (fixtureData) {
            for (const [i, data] of fixtureData.entries()) {
              const attrs = Object.keys(data)
              for (const attr of attrs) {
                const upperAttr = upperCaseFirstLetter(attr)
                let adder = psbt[`add${upperAttr}To${upperCaseFirstLetter(inputOrOutput)}`]
                if (adder !== undefined) {
                  adder = adder.bind(psbt)
                  const arg = data[attr]
                  if (Array.isArray(arg)) {
                    arg.forEach(a => adder(i, initBuffers(attr, a)))
                  } else {
                    adder(i, initBuffers(attr, arg))
                  }
                }
              }
            }
          }
        }

        assert.strictEqual(psbt.toBase64(), f.result)
      })
    })
  })

  fixtures.bip174.signer.forEach(f => {
    it('Signs PSBT to the expected result', () => {
      const psbt =  Psbt.fromBase64(f.psbt)

      f.keys.forEach(({inputToSign, WIF}) => {
        const keyPair = ECPair.fromWIF(WIF, NETWORKS.testnet);
        psbt.signInput(inputToSign, keyPair);
      })

      assert.strictEqual(psbt.toBase64(), f.result)
    })
  })

  fixtures.bip174.combiner.forEach(f => {
    it('Combines two PSBTs to the expected result', () => {
      const psbts =  f.psbts.map(psbt => Psbt.fromBase64(psbt))

      psbts[0].combine(psbts[1])

      // Produces a different Base64 string due to implemetation specific key-value ordering.
      // That means this test will fail:
      // assert.strictEqual(psbts[0].toBase64(), f.result)
      // However, if we compare the actual PSBT properties we can see they are logically identical:
      assert.deepStrictEqual(psbts[0], Psbt.fromBase64(f.result))
    })
  })

  fixtures.bip174.finalizer.forEach(f => {
    it('Finalizes inputs and gives the expected PSBT', () => {
      const psbt =  Psbt.fromBase64(f.psbt)

      psbt.finalizeAllInputs()

      assert.strictEqual(psbt.toBase64(), f.result)
    })
  })

  fixtures.bip174.extractor.forEach(f => {
    it('Extracts the expected transaction from a PSBT', () => {
      const psbt =  Psbt.fromBase64(f.psbt)

      const transaction = psbt.extractTransaction().toHex()

      assert.strictEqual(transaction, f.transaction)
    })
  })

  describe('signInput', () => {
    fixtures.signInput.checks.forEach(f => {
      it(f.description, () => {
        const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt)
        assert.doesNotThrow(() => {
          psbtThatShouldsign.signInput(
            f.shouldSign.inputToCheck,
            ECPair.fromWIF(f.shouldSign.WIF),
          )
        })

        const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt)
        assert.throws(() => {
          psbtThatShouldThrow.signInput(
            f.shouldThrow.inputToCheck,
            ECPair.fromWIF(f.shouldThrow.WIF),
          )
        }, {message: f.shouldThrow.errorMessage})
      })
    })
  })

  describe('fromTransaction', () => {
    fixtures.fromTransaction.forEach(f => {
      it('Creates the expected PSBT from a transaction buffer', () => {
        const psbt = Psbt.fromTransaction(Buffer.from(f.transaction, 'hex'))
        assert.strictEqual(psbt.toBase64(), f.result)
      })
    })
  })

  describe('setVersion', () => {
    it('Sets the version value of the unsigned transaction', () => {
      const psbt = new Psbt()

      assert.strictEqual(psbt.extractTransaction().version, 2)
      psbt.setVersion(1)
      assert.strictEqual(psbt.extractTransaction().version, 1)
    })
  })

  describe('setLocktime', () => {
    it('Sets the nLockTime value of the unsigned transaction', () => {
      const psbt = new Psbt()

      assert.strictEqual(psbt.extractTransaction().locktime, 0)
      psbt.setLocktime(1)
      assert.strictEqual(psbt.extractTransaction().locktime, 1)
    })
  })

  describe('setSequence', () => {
    it('Sets the sequence number for a given input', () => {
      const psbt = new Psbt()
      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0
      });

      assert.strictEqual(psbt.__TX.ins[0].sequence, 0xffffffff)
      psbt.setSequence(0, 0)
      assert.strictEqual(psbt.__TX.ins[0].sequence, 0)
    })

    it('throws if input index is too high', () => {
      const psbt = new Psbt()
      psbt.addInput({
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        index: 0
      });

      assert.throws(() => {
        psbt.setSequence(1, 0)
      }, {message: 'Input index too high'})
    })
  })

  describe('Method return types', () => {
    it('fromTransaction returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromTransaction(Buffer.from([2,0,0,0,0,0,0,0,0,0]));
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__TX);
    })
    it('fromBuffer returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromBuffer(Buffer.from(
        '70736274ff01000a01000000000000000000000000', 'hex' //cHNidP8BAAoBAAAAAAAAAAAAAAAA
      ));
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__TX);
    })
    it('fromBase64 returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromBase64('cHNidP8BAAoBAAAAAAAAAAAAAAAA');
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__TX);
    })
    it('fromHex returns Psbt type (not base class)', () => {
      const psbt = Psbt.fromHex('70736274ff01000a01000000000000000000000000');
      assert.strictEqual(psbt instanceof Psbt, true);
      assert.ok(psbt.__TX);
    })
  })
})
