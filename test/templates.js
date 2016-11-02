/* global describe, it */

var assert = require('assert')
var bcrypto = require('../src/crypto')
var bscript = require('../src/script')
var ops = require('../src/opcodes')

var fixtures = require('./fixtures/script.json')

describe('script-templates', function () {
  describe('classifyInput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.scriptSig) return

      it('classifies ' + f.scriptSig + ' as ' + f.type, function () {
        var scriptSig = bscript.fromASM(f.scriptSig)
        var type = bscript.classifyInput(scriptSig)

        assert.strictEqual(type, f.type)
      })
    })

    fixtures.valid.forEach(function (f) {
      if (!f.scriptSig) return
      if (!f.typeIncomplete) return

      it('classifies incomplete ' + f.scriptSig + ' as ' + f.typeIncomplete, function () {
        var scriptSig = bscript.fromASM(f.scriptSig)
        var type = bscript.classifyInput(scriptSig, true)

        assert.strictEqual(type, f.typeIncomplete)
      })
    })
  })

  describe('classifyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.scriptPubKey) return

      it('classifies ' + f.scriptPubKey + ' as ' + f.type, function () {
        var scriptPubKey = bscript.fromASM(f.scriptPubKey)
        var type = bscript.classifyOutput(scriptPubKey)

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
    'nullData'
  ].forEach(function (name) {
    var inputType = bscript[name].input
    var outputType = bscript[name].output

    describe(name + '.input.check', function () {
      fixtures.valid.forEach(function (f) {
        var expected = name.toLowerCase() === f.type

        if (inputType && f.scriptSig) {
          var scriptSig = bscript.fromASM(f.scriptSig)

          it('returns ' + expected + ' for ' + f.scriptSig, function () {
            assert.strictEqual(inputType.check(scriptSig), expected)
          })

          if (f.typeIncomplete) {
            var expectedIncomplete = name.toLowerCase() === f.typeIncomplete

            it('returns ' + expected + ' for ' + f.scriptSig, function () {
              assert.strictEqual(inputType.check(scriptSig, true), expectedIncomplete)
            })
          }
        }
      })

      if (!(fixtures.invalid[name])) return

      fixtures.invalid[name].inputs.forEach(function (f) {
        if (!f.scriptSig && !f.scriptSigHex) return

        it('returns false for ' + f.description + ' (' + (f.scriptSig || f.scriptSigHex) + ')', function () {
          var scriptSig

          if (f.scriptSig) {
            scriptSig = bscript.fromASM(f.scriptSig)
          } else {
            scriptSig = new Buffer(f.scriptSigHex, 'hex')
          }

          assert.strictEqual(inputType.check(scriptSig), false)
        })
      })
    })

    describe(name + '.output.check', function () {
      fixtures.valid.forEach(function (f) {
        var expected = name.toLowerCase() === f.type

        if (outputType && f.scriptPubKey) {
          it('returns ' + expected + ' for ' + f.scriptPubKey, function () {
            var scriptPubKey = bscript.fromASM(f.scriptPubKey)

            assert.strictEqual(outputType.check(scriptPubKey), expected)
          })
        }
      })

      if (!(fixtures.invalid[name])) return

      fixtures.invalid[name].outputs.forEach(function (f) {
        if (!f.scriptPubKey && !f.scriptPubKeyHex) return

        it('returns false for ' + f.description + ' (' + (f.scriptPubKey || f.scriptPubKeyHex) + ')', function () {
          var scriptPubKey

          if (f.scriptPubKey) {
            scriptPubKey = bscript.fromASM(f.scriptPubKey)
          } else {
            scriptPubKey = new Buffer(f.scriptPubKeyHex, 'hex')
          }

          assert.strictEqual(outputType.check(scriptPubKey), false)
        })
      })
    })
  })

  describe('pubKey.input.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptSig, function () {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = bscript.pubKey.input.encode(signature)
        assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKey.output.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptPubKey, function () {
        var pubKey = new Buffer(f.pubKey, 'hex')
        var scriptPubKey = bscript.pubKey.output.encode(pubKey)

        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })

  describe('pubKeyHash.input.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')

      it('returns ' + f.scriptSig, function () {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = bscript.pubKeyHash.input.encode(signature, pubKey)
        assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKeyHash.output.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)

      it('returns ' + f.scriptPubKey, function () {
        var scriptPubKey = bscript.pubKeyHash.output.encode(pubKeyHash)
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
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

  describe('multisig.input.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      it('returns ' + f.scriptSig, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? new Buffer(signature, 'hex') : ops.OP_0
        })

        var scriptSig = bscript.multisig.input.encode(signatures)
        assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
      })
    })

    fixtures.invalid.multisig.inputs.forEach(function (f) {
      if (!f.scriptPubKey) return
      var scriptPubKey = bscript.fromASM(f.scriptPubKey)

      it('throws on ' + f.exception, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? new Buffer(signature, 'hex') : ops.OP_0
        })

        assert.throws(function () {
          bscript.multisig.input.encode(signatures, scriptPubKey)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisig.output.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(function (p) { return new Buffer(p, 'hex') })
      var scriptPubKey = bscript.multisig.output.encode(pubKeys.length, pubKeys)

      it('returns ' + f.scriptPubKey, function () {
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
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

  describe('scriptHash.input.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return

      var redeemScript = bscript.fromASM(f.redeemScript)
      var redeemScriptSig = bscript.fromASM(f.redeemScriptSig)

      it('returns ' + f.scriptSig, function () {
        var scriptSig = bscript.scriptHash.input.encode(redeemScriptSig, redeemScript)

        if (f.scriptSig) {
          assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
        } else {
          assert.strictEqual(scriptSig.toString('hex'), f.scriptSigHex)
        }
      })
    })
  })

  describe('scriptHash.output.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return
      if (!f.scriptPubKey) return

      it('returns ' + f.scriptPubKey, function () {
        var redeemScript = bscript.fromASM(f.redeemScript)
        var scriptPubKey = bscript.scriptHash.output.encode(bcrypto.hash160(redeemScript))

        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
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

  describe('witnessPubKeyHash.output.encode', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnesspubkeyhash') return
      if (!f.scriptPubKey) return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)

      it('returns ' + f.scriptPubKey, function () {
        var scriptPubKey = bscript.witnessPubKeyHash.output.encode(pubKeyHash)
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
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
      if (!f.scriptPubKey) return

      var witnessScriptPubKey = bscript.fromASM(f.witnessScriptPubKey)
      var scriptHash = bcrypto.hash256(witnessScriptPubKey)
      var scriptPubKey = bscript.witnessScriptHash.output.encode(scriptHash)

      it('encodes to ' + f.scriptPubKey, function () {
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })

      it('decodes to ' + scriptHash.toString('hex'), function () {
        assert.deepEqual(bscript.witnessScriptHash.output.decode(scriptHash), witnessScriptPubKey)
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

  describe('nullData.output', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'nulldata') return

      var data = new Buffer(f.data, 'hex')
      var scriptPubKey = bscript.nullData.output.encode(data)

      it('encodes to ' + f.scriptPubKey, function () {
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })

      it('decodes to ' + f.data, function () {
        assert.deepEqual(bscript.nullData.output.decode(scriptPubKey), data)
      })
    })
  })
})
