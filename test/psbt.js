const { describe, it } = require('mocha')
const assert = require('assert')

const ECPair = require('../src/ecpair')
const Psbt = require('..').Psbt

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
})
