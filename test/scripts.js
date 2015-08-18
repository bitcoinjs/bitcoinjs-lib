/* global describe, it */

var assert = require('assert')
var bcrypto = require('../src/crypto')
var ops = require('../src/opcodes')
var scripts = require('../src/scripts')

var Script = require('../src/script')

var fixtures = require('./fixtures/scripts.json')

describe('Scripts', function () {
  // TODO
  describe.skip('isCanonicalPubKey', function () {})
  describe.skip('isCanonicalSignature', function () {})

  describe('classifyInput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.scriptSig) return

      it('classifies ' + f.scriptSig + ' as ' + f.type, function () {
        var script = Script.fromASM(f.scriptSig)
        var type = scripts.classifyInput(script)

        assert.strictEqual(type, f.type)
      })
    })

    fixtures.valid.forEach(function (f) {
      if (!f.scriptSig) return
      if (!f.typeIncomplete) return

      it('classifies incomplete ' + f.scriptSig + ' as ' + f.typeIncomplete, function () {
        var script = Script.fromASM(f.scriptSig)
        var type = scripts.classifyInput(script, true)

        assert.strictEqual(type, f.typeIncomplete)
      })
    })
  })

  describe('classifyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.scriptPubKey) return

      it('classifies ' + f.scriptPubKey + ' as ' + f.type, function () {
        var script = Script.fromASM(f.scriptPubKey)
        var type = scripts.classifyOutput(script)

        assert.strictEqual(type, f.type)
      })
    })
  })

  ;['PubKey', 'PubKeyHash', 'ScriptHash', 'Multisig', 'NullData'].forEach(function (type) {
    var inputFnName = 'is' + type + 'Input'
    var outputFnName = 'is' + type + 'Output'

    var inputFn = scripts[inputFnName]
    var outputFn = scripts[outputFnName]

    describe('is' + type + 'Input', function () {
      fixtures.valid.forEach(function (f) {
        var expected = type.toLowerCase() === f.type

        if (inputFn && f.scriptSig) {
          var script

          if (f.scriptSig) {
            script = Script.fromASM(f.scriptSig)
          } else {
            script = Script.fromHex(f.scriptSigHex)
          }

          it('returns ' + expected + ' for ' + f.scriptSig, function () {
            assert.strictEqual(inputFn(script), expected)
          })

          if (f.typeIncomplete) {
            var expectedIncomplete = type.toLowerCase() === f.typeIncomplete

            it('returns ' + expected + ' for ' + f.scriptSig, function () {
              assert.strictEqual(inputFn(script, true), expectedIncomplete)
            })
          }
        }
      })

      if (!(inputFnName in fixtures.invalid)) return

      fixtures.invalid[inputFnName].forEach(function (f) {
        if (inputFn && (f.scriptSig || f.scriptSigHex)) {
          it('returns false for ' + f.description + ' (' + (f.scriptSig || f.scriptSigHex) + ')', function () {
            var script

            if (f.scriptSig) {
              script = Script.fromASM(f.scriptSig)
            } else {
              script = Script.fromHex(f.scriptSigHex)
            }

            assert.strictEqual(inputFn(script), false)
          })
        }
      })
    })

    describe('is' + type + 'Output', function () {
      fixtures.valid.forEach(function (f) {
        var expected = type.toLowerCase() === f.type

        if (outputFn && f.scriptPubKey) {
          it('returns ' + expected + ' for ' + f.scriptPubKey, function () {
            var script = Script.fromASM(f.scriptPubKey)

            assert.strictEqual(outputFn(script), expected)
          })
        }
      })

      if (!(outputFnName in fixtures.invalid)) return

      fixtures.invalid[outputFnName].forEach(function (f) {
        if (outputFn && f.scriptPubKey) {
          it('returns false for ' + f.description + ' (' + f.scriptPubKey + ')', function () {
            var script = Script.fromASM(f.scriptPubKey)

            assert.strictEqual(outputFn(script), false)
          })
        }
      })
    })
  })

  describe('pubKeyInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptSig, function () {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = scripts.pubKeyInput(signature)
        assert.strictEqual(Script.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKeyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptPubKey, function () {
        var pubKey = new Buffer(f.pubKey, 'hex')
        var scriptPubKey = scripts.pubKeyOutput(pubKey)

        assert.strictEqual(Script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })

  describe('pubKeyHashInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')

      it('returns ' + f.scriptSig, function () {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = scripts.pubKeyHashInput(signature, pubKey)
        assert.strictEqual(Script.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKeyHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)

      it('returns ' + f.scriptPubKey, function () {
        var scriptPubKey = scripts.pubKeyHashOutput(pubKeyHash)
        assert.strictEqual(Script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })

  describe('multisigInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      it('returns ' + f.scriptSig, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? new Buffer(signature, 'hex') : ops.OP_0
        })

        var scriptSig = scripts.multisigInput(signatures)
        assert.strictEqual(Script.toASM(scriptSig), f.scriptSig)
      })
    })

    fixtures.invalid.multisigInput.forEach(function (f) {
      var scriptPubKey = Script.fromASM(f.scriptPubKey)

      it('throws on ' + f.exception, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? new Buffer(signature, 'hex') : ops.OP_0
        })

        assert.throws(function () {
          scripts.multisigInput(signatures, scriptPubKey)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisigOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(function (p) { return new Buffer(p, 'hex') })
      var scriptPubKey = scripts.multisigOutput(pubKeys.length, pubKeys)

      it('returns ' + f.scriptPubKey, function () {
        assert.strictEqual(Script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.multisigOutput.forEach(function (f) {
      var pubKeys = f.pubKeys.map(function (p) {
        return new Buffer(p, 'hex')
      })

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          scripts.multisigOutput(f.m, pubKeys)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('scriptHashInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return

      var redeemScript = Script.fromASM(f.redeemScript)
      var redeemScriptSig = Script.fromASM(f.redeemScriptSig)

      it('returns ' + f.scriptSig, function () {
        var scriptSig = scripts.scriptHashInput(redeemScriptSig, redeemScript)

        if (f.scriptSig) {
          assert.strictEqual(Script.toASM(scriptSig), f.scriptSig)

        } else {
          assert.strictEqual(scriptSig.toString('hex'), f.scriptSigHex)
        }
      })
    })
  })

  describe('scriptHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return
      if (!f.scriptPubKey) return

      it('returns ' + f.scriptPubKey, function () {
        var redeemScript = Script.compile(Script.fromASM(f.redeemScript))
        var scriptPubKey = scripts.scriptHashOutput(bcrypto.hash160(redeemScript))

        assert.strictEqual(Script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })

  describe('nullDataOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'nulldata') return

      var data = new Buffer(f.data, 'hex')
      var scriptPubKey = scripts.nullDataOutput(data)

      it('returns ' + f.scriptPubKey, function () {
        assert.strictEqual(Script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })
})
