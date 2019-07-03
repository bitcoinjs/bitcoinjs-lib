const { describe, it } = require('mocha')
const assert = require('assert')

const ECPair = require('../src/ecpair')
const Psbt = require('..').Psbt

const fixtures = require('./fixtures/psbt')

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
