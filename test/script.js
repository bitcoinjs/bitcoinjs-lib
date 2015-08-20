/* global describe, it */

var assert = require('assert')
var bcrypto = require('../src/crypto')
var ops = require('../src/opcodes')
var script = require('../src/script')

var fixtures = require('./fixtures/script.json')

describe('script', function () {
  // TODO
  describe.skip('isCanonicalPubKey', function () {})
  describe.skip('isCanonicalSignature', function () {})

  describe('fromASM/toASM', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSig) {
        it('encodes/decodes ' + f.scriptSig, function () {
          var scriptSig = script.fromASM(f.scriptSig)

          assert.strictEqual(script.toASM(scriptSig), f.scriptSig)
        })
      }

      if (f.scriptPubKey) {
        it('encodes/decodes ' + f.scriptPubKey, function () {
          var scriptPubKey = script.fromASM(f.scriptPubKey)

          assert.strictEqual(script.toASM(scriptPubKey), f.scriptPubKey)
        })
      }
    })
  })

  describe('compile', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSig) {
        it('compiles ' + f.scriptSig, function () {
          var scriptSig = script.fromASM(f.scriptSig)

          assert.strictEqual(script.compile(scriptSig).toString('hex'), f.scriptSigHex)
        })
      }

      if (f.scriptPubKey) {
        it('compiles ' + f.scriptPubKey, function () {
          var scriptPubKey = script.fromASM(f.scriptPubKey)

          assert.strictEqual(script.compile(scriptPubKey).toString('hex'), f.scriptPubKeyHex)
        })
      }
    })
  })

  describe('decompile', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSigHex) {
        it('decompiles ' + f.scriptSig, function () {
          var chunks = script.decompile(new Buffer(f.scriptSigHex, 'hex'))

          assert.strictEqual(script.toASM(chunks), f.scriptSig)
        })
      }

      if (f.scriptPubKeyHex) {
        it('decompiles ' + f.scriptPubKey, function () {
          var chunks = script.decompile(new Buffer(f.scriptPubKeyHex, 'hex'))

          assert.strictEqual(script.toASM(chunks), f.scriptPubKey)
        })
      }
    })

    fixtures.invalid.decompile.forEach(function (f) {
      it('decompiles ' + f.hex + ' to [] because of "' + f.description + '"', function () {
        var chunks = script.decompile(new Buffer(f.hex, 'hex'))

        assert.strictEqual(chunks.length, 0)
      })
    })
  })

  describe('classifyInput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.scriptSig) return

      it('classifies ' + f.scriptSig + ' as ' + f.type, function () {
        var scriptSig = script.fromASM(f.scriptSig)
        var type = script.classifyInput(scriptSig)

        assert.strictEqual(type, f.type)
      })
    })

    fixtures.valid.forEach(function (f) {
      if (!f.scriptSig) return
      if (!f.typeIncomplete) return

      it('classifies incomplete ' + f.scriptSig + ' as ' + f.typeIncomplete, function () {
        var scriptSig = script.fromASM(f.scriptSig)
        var type = script.classifyInput(scriptSig, true)

        assert.strictEqual(type, f.typeIncomplete)
      })
    })
  })

  describe('classifyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.scriptPubKey) return

      it('classifies ' + f.scriptPubKey + ' as ' + f.type, function () {
        var scriptPubKey = script.fromASM(f.scriptPubKey)
        var type = script.classifyOutput(scriptPubKey)

        assert.strictEqual(type, f.type)
      })
    })
  })

  ;['PubKey', 'PubKeyHash', 'ScriptHash', 'Multisig', 'NullData'].forEach(function (type) {
    var inputFnName = 'is' + type + 'Input'
    var outputFnName = 'is' + type + 'Output'

    var inputFn = script[inputFnName]
    var outputFn = script[outputFnName]

    describe('is' + type + 'Input', function () {
      fixtures.valid.forEach(function (f) {
        var expected = type.toLowerCase() === f.type

        if (inputFn && f.scriptSig) {
          var scriptSig = script.fromASM(f.scriptSig)

          it('returns ' + expected + ' for ' + f.scriptSig, function () {
            assert.strictEqual(inputFn(scriptSig), expected)
          })

          if (f.typeIncomplete) {
            var expectedIncomplete = type.toLowerCase() === f.typeIncomplete

            it('returns ' + expected + ' for ' + f.scriptSig, function () {
              assert.strictEqual(inputFn(scriptSig, true), expectedIncomplete)
            })
          }
        }
      })

      if (!(inputFnName in fixtures.invalid)) return

      fixtures.invalid[inputFnName].forEach(function (f) {
        if (inputFn && (f.scriptSig || f.scriptSigHex)) {
          it('returns false for ' + f.description + ' (' + (f.scriptSig || f.scriptSigHex) + ')', function () {
            var scriptSig

            if (f.scriptSig) {
              scriptSig = script.fromASM(f.scriptSig)
            } else {
              scriptSig = script.fromHex(f.scriptSigHex)
            }

            assert.strictEqual(inputFn(scriptSig), false)
          })
        }
      })
    })

    describe('is' + type + 'Output', function () {
      fixtures.valid.forEach(function (f) {
        var expected = type.toLowerCase() === f.type

        if (outputFn && f.scriptPubKey) {
          it('returns ' + expected + ' for ' + f.scriptPubKey, function () {
            var scriptPubKey = script.fromASM(f.scriptPubKey)

            assert.strictEqual(outputFn(scriptPubKey), expected)
          })
        }
      })

      if (!(outputFnName in fixtures.invalid)) return

      fixtures.invalid[outputFnName].forEach(function (f) {
        if (outputFn && f.scriptPubKey) {
          it('returns false for ' + f.description + ' (' + f.scriptPubKey + ')', function () {
            var scriptPubKey = script.fromASM(f.scriptPubKey)

            assert.strictEqual(outputFn(scriptPubKey), false)
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

        var scriptSig = script.pubKeyInput(signature)
        assert.strictEqual(script.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKeyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptPubKey, function () {
        var pubKey = new Buffer(f.pubKey, 'hex')
        var scriptPubKey = script.pubKeyOutput(pubKey)

        assert.strictEqual(script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })

  describe('pubKeyHashInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')

      it('returns ' + f.scriptSig, function () {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = script.pubKeyHashInput(signature, pubKey)
        assert.strictEqual(script.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKeyHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)

      it('returns ' + f.scriptPubKey, function () {
        var scriptPubKey = script.pubKeyHashOutput(pubKeyHash)
        assert.strictEqual(script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.pubKeyHashOutput.forEach(function (f) {
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          script.pubKeyHashOutput(hash)
        }, new RegExp(f.exception))
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

        var scriptSig = script.multisigInput(signatures)
        assert.strictEqual(script.toASM(scriptSig), f.scriptSig)
      })
    })

    fixtures.invalid.multisigInput.forEach(function (f) {
      var scriptPubKey = script.fromASM(f.scriptPubKey)

      it('throws on ' + f.exception, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? new Buffer(signature, 'hex') : ops.OP_0
        })

        assert.throws(function () {
          script.multisigInput(signatures, scriptPubKey)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisigOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(function (p) { return new Buffer(p, 'hex') })
      var scriptPubKey = script.multisigOutput(pubKeys.length, pubKeys)

      it('returns ' + f.scriptPubKey, function () {
        assert.strictEqual(script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.multisigOutput.forEach(function (f) {
      var pubKeys = f.pubKeys.map(function (p) {
        return new Buffer(p, 'hex')
      })

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          script.multisigOutput(f.m, pubKeys)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('scriptHashInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return

      var redeemScript = script.fromASM(f.redeemScript)
      var redeemScriptSig = script.fromASM(f.redeemScriptSig)

      it('returns ' + f.scriptSig, function () {
        var scriptSig = script.scriptHashInput(redeemScriptSig, redeemScript)

        if (f.scriptSig) {
          assert.strictEqual(script.toASM(scriptSig), f.scriptSig)

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
        var redeemScript = script.fromASM(f.redeemScript)
        var scriptPubKey = script.scriptHashOutput(bcrypto.hash160(redeemScript))

        assert.strictEqual(script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.scriptHashOutput.forEach(function (f) {
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          script.scriptHashOutput(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('nullDataOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'nulldata') return

      var data = new Buffer(f.data, 'hex')
      var scriptPubKey = script.nullDataOutput(data)

      it('returns ' + f.scriptPubKey, function () {
        assert.strictEqual(script.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })
})
