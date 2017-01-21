/* global describe, it */

var assert = require('assert')
var bcrypto = require('../src/crypto')
var bscript = require('../src/script')
var ops = require('bitcoin-ops')

var fixtures = require('./fixtures/templates.json')

describe('script-templates', function () {
  describe('classifyInput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.input) return

      it('classifies ' + f.input + ' as ' + f.type, function () {
        var input = bscript.fromASM(f.input)
        var type = bscript.classifyInput(input)

        assert.strictEqual(type, f.type)
      })
    })

    fixtures.valid.forEach(function (f) {
      if (!f.input) return
      if (!f.typeIncomplete) return

      it('classifies incomplete ' + f.input + ' as ' + f.typeIncomplete, function () {
        var input = bscript.fromASM(f.input)
        var type = bscript.classifyInput(input, true)

        assert.strictEqual(type, f.typeIncomplete)
      })
    })
  })

  describe('classifyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.output) return

      it('classifies ' + f.output + ' as ' + f.type, function () {
        var output = bscript.fromASM(f.output)
        var type = bscript.classifyOutput(output)

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
    var inputType = bscript[name].input
    var outputType = bscript[name].output

    describe(name + '.input.check', function () {
      fixtures.valid.forEach(function (f) {
        if (name.toLowerCase() === bscript.types.P2WPKH) return
        if (name.toLowerCase() === bscript.types.P2WSH) return
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
            input = new Buffer(f.inputHex, 'hex')
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

            if (name.toLowerCase() === 'nulldata' && f.type === bscript.types.WITNESS_COMMITMENT) {
              return
            }
            if (name.toLowerCase() === 'witnesscommitment' && f.type === bscript.types.NULLDATA) {
              return
            }
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
            output = new Buffer(f.outputHex, 'hex')
          }

          assert.strictEqual(outputType.check(output), false)
        })
      })
    })
  })

  describe('pubKey.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      var signature = new Buffer(f.signature, 'hex')
      var input = bscript.pubKey.input.encode(signature)

      it('encodes to ' + f.input, function () {
        assert.strictEqual(bscript.toASM(input), f.input)
      })

      it('decodes to ' + f.signature, function () {
        assert.deepEqual(bscript.pubKey.input.decode(input), signature)
      })
    })
  })

  describe('pubKey.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var output = bscript.pubKey.output.encode(pubKey)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + f.pubKey, function () {
        assert.deepEqual(bscript.pubKey.output.decode(output), pubKey)
      })
    })
  })

  describe('pubKeyHash.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var signature = new Buffer(f.signature, 'hex')
      var input = bscript.pubKeyHash.input.encode(signature, pubKey)

      it('encodes to ' + f.input, function () {
        assert.strictEqual(bscript.toASM(input), f.input)
      })

      it('decodes to original arguments', function () {
        assert.deepEqual(bscript.pubKeyHash.input.decode(input), {
          signature: signature,
          pubKey: pubKey
        })
      })
    })
  })

  describe('pubKeyHash.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)
      var output = bscript.pubKeyHash.output.encode(pubKeyHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + pubKeyHash.toString('hex'), function () {
        assert.deepEqual(bscript.pubKeyHash.output.decode(output), pubKeyHash)
      })
    })

    fixtures.invalid.pubKeyHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.pubKeyHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisig.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig' && f.typeIncomplete !== 'multisig') return
      var allowIncomplete = f.typeIncomplete !== undefined

      var signatures = f.signatures.map(function (signature) {
        return signature ? new Buffer(signature, 'hex') : ops.OP_0
      })

      var input = bscript.multisig.input.encode(signatures)

      it('encodes to ' + f.input, function () {
        assert.strictEqual(bscript.toASM(input), f.input)
      })

      it('decodes to ' + signatures.map(function (x) { return x === ops.OP_0 ? 'OP_0' : x.toString('hex') }), function () {
        assert.deepEqual(bscript.multisig.input.decode(input, allowIncomplete), signatures)
      })
    })

    fixtures.invalid.multisig.inputs.forEach(function (f) {
      if (!f.output) return
      var output = bscript.fromASM(f.output)

      it('throws on ' + f.exception, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? new Buffer(signature, 'hex') : ops.OP_0
        })

        assert.throws(function () {
          bscript.multisig.input.encode(signatures, output)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisig.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(function (p) { return new Buffer(p, 'hex') })
      var m = pubKeys.length

      var output = bscript.multisig.output.encode(m, pubKeys)

      it('encodes ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to original arguments', function () {
        assert.deepEqual(bscript.multisig.output.decode(output), {
          m: m,
          pubKeys: pubKeys
        })
      })
    })

    fixtures.invalid.multisig.outputs.forEach(function (f) {
      if (!f.pubKeys) return
      var pubKeys = f.pubKeys.map(function (p) {
        return new Buffer(p, 'hex')
      })

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.multisig.output.encode(f.m, pubKeys)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('scriptHash.input', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return

      var redeemScript = bscript.fromASM(f.redeemScript)
      var redeemScriptSig = bscript.fromASM(f.redeemScriptSig)
      var input = bscript.scriptHash.input.encode(redeemScriptSig, redeemScript)

      it('encodes to ' + f.output, function () {
        if (f.input) {
          assert.strictEqual(bscript.toASM(input), f.input)
        } else {
          assert.strictEqual(input.toString('hex'), f.inputHex)
        }
      })

      it('decodes to original arguments', function () {
        assert.deepEqual(bscript.scriptHash.input.decode(input), {
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
      var output = bscript.scriptHash.output.encode(scriptHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + scriptHash.toString('hex'), function () {
        assert.deepEqual(bscript.scriptHash.output.decode(output), scriptHash)
      })
    })

    fixtures.invalid.scriptHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.scriptHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessPubKeyHash.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnesspubkeyhash') return
      if (!f.output) return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)
      var output = bscript.witnessPubKeyHash.output.encode(pubKeyHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + pubKeyHash.toString('hex'), function () {
        assert.deepEqual(bscript.witnessPubKeyHash.output.decode(output), pubKeyHash)
      })
    })

    fixtures.invalid.witnessPubKeyHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.witnessPubKeyHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessScriptHash.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnessscripthash') return
      if (!f.output) return

      var witnessScriptPubKey = bscript.fromASM(f.witnessScriptPubKey)
      var scriptHash = bcrypto.hash256(witnessScriptPubKey)
      var output = bscript.witnessScriptHash.output.encode(scriptHash)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + scriptHash.toString('hex'), function () {
        assert.deepEqual(bscript.witnessScriptHash.output.decode(output), scriptHash)
      })
    })

    fixtures.invalid.witnessScriptHash.outputs.forEach(function (f) {
      if (!f.hash) return
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.witnessScriptHash.output.encode(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessCommitment.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnesscommitment') return
      if (!f.scriptPubKey) return

      var commitment = new Buffer(f.witnessCommitment, 'hex')
      var scriptPubKey = bscript.witnessCommitment.output.encode(commitment)

      it('encodes to ' + f.scriptPubKey, function () {
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })

      it('decodes to ' + commitment.toString('hex'), function () {
        assert.deepEqual(bscript.witnessCommitment.output.decode(scriptPubKey), commitment)
      })
    })

    fixtures.invalid.witnessCommitment.outputs.forEach(function (f) {
      if (f.commitment) {
        var hash = new Buffer(f.commitment, 'hex')
        it('throws on bad encode data', function () {
          assert.throws(function () {
            bscript.witnessCommitment.output.encode(hash)
          }, new RegExp(f.exception))
        })
      }

      if (f.scriptPubKeyHex) {
        it('.decode throws on ' + f.description, function () {
          assert.throws(function () {
            bscript.witnessCommitment.output.decode(new Buffer(f.scriptPubKeyHex, 'hex'))
          }, new RegExp(f.exception))
        })
      }
    })
  })

  describe('nullData.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'nulldata') return

      var data = new Buffer(f.data, 'hex')
      var output = bscript.nullData.output.encode(data)

      it('encodes to ' + f.output, function () {
        assert.strictEqual(bscript.toASM(output), f.output)
      })

      it('decodes to ' + f.data, function () {
        assert.deepEqual(bscript.nullData.output.decode(output), data)
      })
    })
  })
})
