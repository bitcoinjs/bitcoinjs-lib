const { describe, it, beforeEach } = require('mocha')
const assert = require('assert')

const ECPair = require('../src/ecpair')
const Psbt = require('..').Psbt

const fixtures = require('./fixtures/psbt')

describe(`Psbt`, () => {
  // constants
  const keyPair = ECPair.fromPrivateKey(Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'))

  describe('signInput', () => {
    fixtures.signInput.checks.forEach(f => {
      it(f.description, () => {
        const psbtThatShouldsign = Psbt.fromBase64(f.shouldSign.psbt)
        assert.doesNotThrow(() => {
          psbtThatShouldsign.signInput(f.shouldSign.inputToCheck, keyPair)
        })
    
        const psbtThatShouldThrow = Psbt.fromBase64(f.shouldThrow.psbt)
        assert.throws(() => {
          psbtThatShouldThrow.signInput(f.shouldThrow.inputToCheck, keyPair)
        }, {message: f.shouldThrow.errorMessage})
      })
    })
  })
})
