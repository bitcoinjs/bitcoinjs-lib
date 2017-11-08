/* global describe, it */

var assert = require('assert')
var bcrypto = require('../src/crypto')
var bscript = require('../src/script')
var btemplates = require('../src/templates')
var ops = require('bitcoin-ops')

var fixtures = require('./fixtures/templates.json')

function fromHex (x) { return Buffer.from(x, 'hex') }
function toHex (x) { return x.toString('hex') }

describe('script-templates', function () {
  describe('classifyInput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.input) return

      it('classifies ' + f.input + ' as ' + f.type, function () {
        var input = bscript.fromASM(f.input)
        var type = btemplates.classifyInput(input)

        assert.strictEqual(type, f.type)
      })
    })

    fixtures.valid.forEach(function (f) {
      if (!f.input) return
      if (!f.typeIncomplete) return

      it('classifies incomplete ' + f.input + ' as ' + f.typeIncomplete, function () {
        var input = bscript.fromASM(f.input)
        var type = btemplates.classifyInput(input, true)

        assert.strictEqual(type, f.typeIncomplete)
      })
    })
  })

  describe('classifyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.output) return

      it('classifies ' + f.output + ' as ' + f.type, function () {
        var output = bscript.fromASM(f.output)
        var type = btemplates.classifyOutput(output)

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
    var inputType = btemplates[name].input
    var outputType = btemplates[name].output

    describe(name + '.input.check', function () {
      fixtures.valid.forEach(function (f) {
        if (name.toLowerCase() === btemplates.types.P2WPKH) return
        if (name.toLowerCase() === btemplates.types.P2WSH) return
        var expected = name.toLowerCase() === f.type.toLowerCase()

        if (inputType && f.input) {
          var input = bscript.fromASM(f.input)

          it('returns ' + expected + ' for ' + f.input, function () {
            assert.strictEqual(inputType.check(input), expected)
          })

          if (f.typeIncomplete) {
            var expectedIncomplete = name.toLowerCase() === f.typeIncomplete

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
          var input

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
        var expected = name.toLowerCase() === f.type

        if (outputType && f.output) {
          it('returns ' + expected + ' for ' + f.output, function () {
            var output = bscript.fromASM(f.output)

            if (name.toLowerCase() === 'nulldata' && f.type === btemplates.types.WITNESS_COMMITMENT) return
            if (name.toLowerCase() === 'witnesscommitment' && f.type === btemplates.types.NULLDATA) return
            assert.strictEqual(outputType.check(output), expected)
          })
        }
      })

      if (!(fixtures.invalid[name])) return

      fixtures.invalid[name].outputs.forEach(function (f) {
        if (!f.output && !f.outputHex) return

        it('returns false for ' + f.description + ' (' + (f.output || f.outputHex) + ')', function () {
          var output

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

  describe('pubKey.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      var signature = Buffer.from(f.signature, 'hex')
      var input = btemplates.pubKey.input.encode(signature)

      it('encodes to ' + f.input, function () {
        assert.strictEqual(bscript.toASM(input), f.input)
      })

      it('decodes to ' + f.signature, function () {
        assert.deepEqual(btemplates.pubKey.input.decode(input), signature)
      })
    })
  })

  describe('pubKey.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      var pubKey = Buffer.from(f.pubKey, 'hex')
      var output = btemplates.pubKey.output.encode(pubKey)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + f.pubKey, function () {
        assert.deepEqual(btemplates.pubKey.output.decode(output), pubKey)
      })
    })
  })

  describe('pubKeyHash.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = Buffer.from(f.pubKey, 'hex')
      var signature = Buffer.from(f.signature, 'hex')
      var input = btemplates.pubKeyHash.input.encode(signature, pubKey)

      it('encodes to ' + f.input, function () {
        assert.strictEqual(bscript.toASM(input), f.input)
      })

      it('decodes to original arguments', function () {
        assert.deepEqual(btemplates.pubKeyHash.input.decode(input), {
          signature: signature,
          pubKey: pubKey
        })
      })
    })
  })

  describe('pubKeyHash.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = Buffer.from(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)
      var output = btemplates.pubKeyHash.output.encode(pubKeyHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + pubKeyHash.toString('hex'), function () {
        assert.deepEqual(btemplates.pubKeyHash.output.decode(output), pubKeyHash)
      })
    })

    fixtures.invalid.pubKeyHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = Buffer.from(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          btemplates.pubKeyHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisig.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig' && f.typeIncomplete !== 'multisig') return
      var allowIncomplete = f.typeIncomplete !== undefined

      var signatures = f.signatures.map(function (signature) {
        return signature ? Buffer.from(signature, 'hex') : ops.OP_0
      })

      var input = btemplates.multisig.input.encode(signatures)

      it('encodes to ' + f.input, function () {
        assert.strictEqual(bscript.toASM(input), f.input)
      })

      it('decodes to ' + signatures.map(function (x) { return x === ops.OP_0 ? 'OP_0' : x.toString('hex') }), function () {
        assert.deepEqual(btemplates.multisig.input.decode(input, allowIncomplete), signatures)
      })
    })

    fixtures.invalid.multisig.inputs.forEach(function (f) {
      if (!f.output) return
      var output = bscript.fromASM(f.output)

      it('throws on ' + f.exception, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? Buffer.from(signature, 'hex') : ops.OP_0
        })

        assert.throws(function () {
          btemplates.multisig.input.encode(signatures, output)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisig.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(function (p) { return Buffer.from(p, 'hex') })
      var m = pubKeys.length

      var output = btemplates.multisig.output.encode(m, pubKeys)

      it('encodes ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to original arguments', function () {
        assert.deepEqual(btemplates.multisig.output.decode(output), {
          m: m,
          pubKeys: pubKeys
        })
      })
    })

    fixtures.invalid.multisig.outputs.forEach(function (f) {
      if (!f.pubKeys) return
      var pubKeys = f.pubKeys.map(function (p) {
        return Buffer.from(p, 'hex')
      })

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          btemplates.multisig.output.encode(f.m, pubKeys)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('scriptHash.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return

      var redeemScriptSig = bscript.fromASM(f.redeemScriptSig)
      var redeemScript = bscript.fromASM(f.redeemScript)
      var input = btemplates.scriptHash.input.encode(redeemScriptSig, redeemScript)

      it('encodes to ' + f.output, function () {
        if (f.input) {
          assert.strictEqual(bscript.toASM(input), f.input)
        } else {
          assert.strictEqual(input.toString('hex'), f.inputHex)
        }
      })

      it('decodes to original arguments', function () {
        assert.deepEqual(btemplates.scriptHash.input.decode(input), {
          redeemScriptSig: redeemScriptSig,
          redeemScript: redeemScript
        })
      })
    })
  })

  describe('scriptHash.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return
      if (!f.output) return

      var redeemScript = bscript.fromASM(f.redeemScript)
      var scriptHash = bcrypto.hash160(redeemScript)
      var output = btemplates.scriptHash.output.encode(scriptHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + scriptHash.toString('hex'), function () {
        assert.deepEqual(btemplates.scriptHash.output.decode(output), scriptHash)
      })
    })

    fixtures.invalid.scriptHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = Buffer.from(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          btemplates.scriptHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessPubKeyHash.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash' && f.type !== 'witnesspubkeyhash') return
      if (!f.inputStack) return

      var pubKey = Buffer.from(f.pubKey, 'hex')
      var signature = Buffer.from(f.signature, 'hex')

      it('encodes to ' + f.input, function () {
        var inputStack = btemplates.witnessPubKeyHash.input.encodeStack(signature, pubKey)

        assert.deepEqual(inputStack.map(toHex), f.inputStack)
      })

      it('decodes to original arguments', function () {
        var fInputStack = f.inputStack.map(fromHex)

        assert.deepEqual(btemplates.witnessPubKeyHash.input.decodeStack(fInputStack), {
          signature: signature,
          pubKey: pubKey
        })
      })
    })
  })

  describe('witnessPubKeyHash.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnesspubkeyhash') return
      if (!f.output) return

      var pubKey = Buffer.from(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)
      var output = btemplates.witnessPubKeyHash.output.encode(pubKeyHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + pubKeyHash.toString('hex'), function () {
        assert.deepEqual(btemplates.witnessPubKeyHash.output.decode(output), pubKeyHash)
      })
    })

    fixtures.invalid.witnessPubKeyHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = Buffer.from(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          btemplates.witnessPubKeyHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessScriptHash.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnessscripthash') return
      if (!f.inputStack || !f.witnessData) return

      var witnessData = f.witnessData.map(fromHex)
      var witnessScript = bscript.fromASM(f.witnessScript || f.redeemScript)

      it('encodes to ' + f.input, function () {
        var inputStack = btemplates.witnessScriptHash.input.encodeStack(witnessData, witnessScript)

        assert.deepEqual(inputStack.map(toHex), f.inputStack)
      })

      it('decodes to original arguments', function () {
        var result = btemplates.witnessScriptHash.input.decodeStack(f.inputStack.map(fromHex))

        assert.deepEqual(result.witnessData.map(toHex), f.witnessData)
        assert.strictEqual(bscript.toASM(result.witnessScript), f.witnessScript)
      })
    })
  })

  describe('witnessScriptHash.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnessscripthash') return
      if (!f.output) return

      var witnessScriptPubKey = bscript.fromASM(f.witnessScript)
      var scriptHash = bcrypto.hash256(witnessScriptPubKey)
      var output = btemplates.witnessScriptHash.output.encode(scriptHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + scriptHash.toString('hex'), function () {
        assert.deepEqual(btemplates.witnessScriptHash.output.decode(output), scriptHash)
      })
    })

    fixtures.invalid.witnessScriptHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = Buffer.from(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          btemplates.witnessScriptHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessCommitment.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnesscommitment') return
      if (!f.scriptPubKey) return

      var commitment = Buffer.from(f.witnessCommitment, 'hex')
      var scriptPubKey = btemplates.witnessCommitment.output.encode(commitment)

      it('encodes to ' + f.scriptPubKey, function () {
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })

      it('decodes to ' + commitment.toString('hex'), function () {
        assert.deepEqual(btemplates.witnessCommitment.output.decode(scriptPubKey), commitment)
      })
    })

    fixtures.invalid.witnessCommitment.outputs.forEach(function (f) {
      if (f.commitment) {
        var hash = Buffer.from(f.commitment, 'hex')
        it('throws on bad encode data', function () {
          assert.throws(function () {
            btemplates.witnessCommitment.output.encode(hash)
          }, new RegExp(f.exception))
        })
      }

      if (f.scriptPubKeyHex) {
        it('.decode throws on ' + f.description, function () {
          assert.throws(function () {
            btemplates.witnessCommitment.output.decode(Buffer.from(f.scriptPubKeyHex, 'hex'))
          }, new RegExp(f.exception))
        })
      }
    })
  })

  describe('nullData.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'nulldata') return

      var data = Buffer.from(f.data, 'hex')
      var output = btemplates.nullData.output.encode(data)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + f.data, function () {
        assert.deepEqual(btemplates.nullData.output.decode(output), data)
      })
    })
  })
})
