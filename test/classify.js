const { describe, it } = require('mocha')
const assert = require('assert')
const bscript = require('../src/script')
const classify = require('../src/classify')

const fixtures = require('./fixtures/templates.json')

const multisig = require('../src/templates/multisig')
const nullData = require('../src/templates/nulldata')
const pubKey = require('../src/templates/pubkey')
const pubKeyHash = require('../src/templates/pubkeyhash')
const scriptHash = require('../src/templates/scripthash')
const witnessPubKeyHash = require('../src/templates/witnesspubkeyhash')
const witnessScriptHash = require('../src/templates/witnessscripthash')
const witnessCommitment = require('../src/templates/witnesscommitment')

const tmap = {
  pubKey,
  pubKeyHash,
  scriptHash,
  witnessPubKeyHash,
  witnessScriptHash,
  multisig,
  nullData,
  witnessCommitment
}

describe('classify', function () {
  describe('input', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.input) return

      it('classifies ' + f.input + ' as ' + f.type, function () {
        const input = bscript.fromASM(f.input)
        const type = classify.input(input)

        assert.strictEqual(type, f.type)
      })
    })

    fixtures.valid.forEach(function (f) {
      if (!f.input) return
      if (!f.typeIncomplete) return

      it('classifies incomplete ' + f.input + ' as ' + f.typeIncomplete, function () {
        const input = bscript.fromASM(f.input)
        const type = classify.input(input, true)

        assert.strictEqual(type, f.typeIncomplete)
      })
    })
  })

  describe('classifyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.output) return

      it('classifies ' + f.output + ' as ' + f.type, function () {
        const output = bscript.fromASM(f.output)
        const type = classify.output(output)

        assert.strictEqual(type, f.type)
      })
    })
  })

  ;[
    'pubKey',
    'pubKeyHash',
    'scriptHash',
    'witnessPubKeyHash',
    'witnessScriptHash',
    'multisig',
    'nullData',
    'witnessCommitment'
  ].forEach(function (name) {
    const inputType = tmap[name].input
    const outputType = tmap[name].output

    describe(name + '.input.check', function () {
      fixtures.valid.forEach(function (f) {
        if (name.toLowerCase() === classify.types.P2WPKH) return
        if (name.toLowerCase() === classify.types.P2WSH) return
        const expected = name.toLowerCase() === f.type.toLowerCase()

        if (inputType && f.input) {
          const input = bscript.fromASM(f.input)

          it('returns ' + expected + ' for ' + f.input, function () {
            assert.strictEqual(inputType.check(input), expected)
          })

          if (f.typeIncomplete) {
            const expectedIncomplete = name.toLowerCase() === f.typeIncomplete

            it('returns ' + expected + ' for ' + f.input, function () {
              assert.strictEqual(inputType.check(input, true), expectedIncomplete)
            })
          }
        }
      })

      if (!(fixtures.invalid[name])) return

      fixtures.invalid[name].inputs.forEach(function (f) {
        if (!f.input && !f.inputHex) return

        it('returns false for ' + f.description + ' (' + (f.input || f.inputHex) + ')', function () {
          let input

          if (f.input) {
            input = bscript.fromASM(f.input)
          } else {
            input = Buffer.from(f.inputHex, 'hex')
          }

          assert.strictEqual(inputType.check(input), false)
        })
      })
    })

    describe(name + '.output.check', function () {
      fixtures.valid.forEach(function (f) {
        const expected = name.toLowerCase() === f.type

        if (outputType && f.output) {
          it('returns ' + expected + ' for ' + f.output, function () {
            const output = bscript.fromASM(f.output)

            if (name.toLowerCase() === 'nulldata' && f.type === classify.types.WITNESS_COMMITMENT) return
            if (name.toLowerCase() === 'witnesscommitment' && f.type === classify.types.NULLDATA) return
            assert.strictEqual(outputType.check(output), expected)
          })
        }
      })

      if (!(fixtures.invalid[name])) return

      fixtures.invalid[name].outputs.forEach(function (f) {
        if (!f.output && !f.outputHex) return

        it('returns false for ' + f.description + ' (' + (f.output || f.outputHex) + ')', function () {
          let output

          if (f.output) {
            output = bscript.fromASM(f.output)
          } else {
            output = Buffer.from(f.outputHex, 'hex')
          }

          assert.strictEqual(outputType.check(output), false)
        })
      })
    })
  })
})
