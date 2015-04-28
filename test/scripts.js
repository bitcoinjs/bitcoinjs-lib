/* global describe, it */

var assert = require('assert')
var ops = require('../src/opcodes')
var scripts = require('../src/scripts')

var ECPair = require('../src/ecpair')
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

        assert.equal(type, f.type)
      })
    })

    fixtures.valid.forEach(function (f) {
      if (!f.scriptSig) return
      if (!f.typeIncomplete) return

      it('classifies incomplete ' + f.scriptSig + ' as ' + f.typeIncomplete, function () {
        var script = Script.fromASM(f.scriptSig)
        var type = scripts.classifyInput(script, true)

        assert.equal(type, f.typeIncomplete)
      })
    })
  })

  describe('classifyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.scriptPubKey) return

      it('classifies ' + f.scriptPubKey + ' as ' + f.type, function () {
        var script = Script.fromASM(f.scriptPubKey)
        var type = scripts.classifyOutput(script)

        assert.equal(type, f.type)
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
            assert.equal(inputFn(script), expected)
          })

          if (f.typeIncomplete) {
            var expectedIncomplete = type.toLowerCase() === f.typeIncomplete

            it('returns ' + expected + ' for ' + f.scriptSig, function () {
              assert.equal(inputFn(script, true), expectedIncomplete)
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

            assert.equal(inputFn(script), false)
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

            assert.equal(outputFn(script), expected)
          })
        }
      })

      if (!(outputFnName in fixtures.invalid)) return

      fixtures.invalid[outputFnName].forEach(function (f) {
        if (outputFn && f.scriptPubKey) {
          it('returns false for ' + f.description + ' (' + f.scriptPubKey + ')', function () {
            var script = Script.fromASM(f.scriptPubKey)

            assert.equal(outputFn(script), false)
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
        assert.equal(scriptSig.toASM(), f.scriptSig)
      })
    })
  })

  describe('pubKeyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptPubKey, function () {
        var pubKey = new Buffer(f.pubKey, 'hex')
        var scriptPubKey = scripts.pubKeyOutput(pubKey)
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
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
        assert.equal(scriptSig.toASM(), f.scriptSig)
      })
    })
  })

  describe('pubKeyHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var address = ECPair.fromPublicKeyBuffer(pubKey).getAddress()

      it('returns ' + f.scriptPubKey, function () {
        var scriptPubKey = scripts.pubKeyHashOutput(address.hash)
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
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
        assert.equal(scriptSig.toASM(), f.scriptSig)
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
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
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
          assert.equal(scriptSig.toASM(), f.scriptSig)
        } else {
          assert.equal(scriptSig.toHex(), f.scriptSigHex)
        }
      })
    })
  })

  describe('scriptHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return
      if (!f.scriptPubKey) return

      it('returns ' + f.scriptPubKey, function () {
        var redeemScript = Script.fromASM(f.redeemScript)
        var scriptPubKey = scripts.scriptHashOutput(redeemScript.getHash())

        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
      })
    })
  })

  describe('nullDataOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'nulldata') return

      var data = new Buffer(f.data, 'hex')
      var scriptPubKey = scripts.nullDataOutput(data)

      it('returns ' + f.scriptPubKey, function () {
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
      })
    })
  })
})
