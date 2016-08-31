/* global describe, it */

var assert = require('assert')
var bcrypto = require('../src/crypto')
var bscript = require('../src/script')
var minimalData = require('minimaldata')
var ops = require('../src/opcodes')

var fixtures = require('./fixtures/script.json')

describe('script', function () {
  // TODO
  describe.skip('isCanonicalPubKey', function () {})
  describe.skip('isCanonicalSignature', function () {})

  describe('fromASM/toASM', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSig) {
        it('encodes/decodes ' + f.scriptSig, function () {
          var scriptSig = bscript.fromASM(f.scriptSig)

          assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
        })
      }

      if (f.scriptPubKey) {
        it('encodes/decodes ' + f.scriptPubKey, function () {
          var scriptPubKey = bscript.fromASM(f.scriptPubKey)

          assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
        })
      }
    })
  })

  describe('compile', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSig) {
        it('(' + f.type + ') compiles ' + f.scriptSig, function () {
          var scriptSig = bscript.fromASM(f.scriptSig)

          assert.strictEqual(bscript.compile(scriptSig).toString('hex'), f.scriptSigHex)
        })
      }

      if (f.scriptPubKey) {
        it('(' + f.type + ') compiles ' + f.scriptPubKey, function () {
          var scriptPubKey = bscript.fromASM(f.scriptPubKey)

          assert.strictEqual(bscript.compile(scriptPubKey).toString('hex'), f.scriptPubKeyHex)
        })
      }
    })
  })

  describe('decompile', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSigHex) {
        it('decompiles ' + f.scriptSig, function () {
          var chunks = bscript.decompile(new Buffer(f.scriptSigHex, 'hex'))

          assert.strictEqual(bscript.toASM(chunks), f.scriptSig)
        })
      }

      if (f.scriptPubKeyHex) {
        it('decompiles ' + f.scriptPubKey, function () {
          var chunks = bscript.decompile(new Buffer(f.scriptPubKeyHex, 'hex'))

          assert.strictEqual(bscript.toASM(chunks), f.scriptPubKey)
        })
      }
    })

    fixtures.invalid.decompile.forEach(function (f) {
      it('decompiles ' + f.hex + ' to [] because of "' + f.description + '"', function () {
        var chunks = bscript.decompile(new Buffer(f.hex, 'hex'))

        assert.strictEqual(chunks.length, 0)
      })
    })
  })

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
    'PubKey',
    'PubKeyHash',
    'ScriptHash',
    'WitnessPubKeyHash',
    'WitnessScriptHash',
    'Multisig',
    'NullData'
  ].forEach(function (type) {
    var inputFnName = 'is' + type + 'Input'
    var outputFnName = 'is' + type + 'Output'

    var inputFn = bscript[inputFnName]
    var outputFn = bscript[outputFnName]

    describe('is' + type + 'Input', function () {
      fixtures.valid.forEach(function (f) {
        var expected = type.toLowerCase() === f.type

        if (inputFn && f.scriptSig) {
          var scriptSig = bscript.fromASM(f.scriptSig)

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
        it('returns false for ' + f.description + ' (' + (f.scriptSig || f.scriptSigHex) + ')', function () {
          var scriptSig

          if (f.scriptSig) {
            scriptSig = bscript.fromASM(f.scriptSig)
          } else {
            scriptSig = new Buffer(f.scriptSigHex, 'hex')
          }

          assert.strictEqual(inputFn(scriptSig), false)
        })
      })
    })

    describe('is' + type + 'Output', function () {
      fixtures.valid.forEach(function (f) {
        var expected = type.toLowerCase() === f.type

        if (outputFn && f.scriptPubKey) {
          it('returns ' + expected + ' for ' + f.scriptPubKey, function () {
            var scriptPubKey = bscript.fromASM(f.scriptPubKey)

            assert.strictEqual(outputFn(scriptPubKey), expected)
          })
        }
      })

      if (!(outputFnName in fixtures.invalid)) return

      fixtures.invalid[outputFnName].forEach(function (f) {
        it('returns false for ' + f.description + ' (' + (f.scriptPubKey || f.scriptPubKeyHex) + ')', function () {
          var scriptPubKey

          if (f.scriptPubKey) {
            scriptPubKey = bscript.fromASM(f.scriptPubKey)
          } else {
            scriptPubKey = new Buffer(f.scriptPubKeyHex, 'hex')
          }

          assert.strictEqual(outputFn(scriptPubKey), false)
        })
      })
    })
  })

  describe('pubKeyInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptSig, function () {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = bscript.pubKeyInput(signature)
        assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKeyOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptPubKey, function () {
        var pubKey = new Buffer(f.pubKey, 'hex')
        var scriptPubKey = bscript.pubKeyOutput(pubKey)

        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })

  describe('pubKeyHashInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')

      it('returns ' + f.scriptSig, function () {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = bscript.pubKeyHashInput(signature, pubKey)
        assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
      })
    })
  })

  describe('pubKeyHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)

      it('returns ' + f.scriptPubKey, function () {
        var scriptPubKey = bscript.pubKeyHashOutput(pubKeyHash)
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.pubKeyHashOutput.forEach(function (f) {
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.pubKeyHashOutput(hash)
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

        var scriptSig = bscript.multisigInput(signatures)
        assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
      })
    })

    fixtures.invalid.multisigInput.forEach(function (f) {
      var scriptPubKey = bscript.fromASM(f.scriptPubKey)

      it('throws on ' + f.exception, function () {
        var signatures = f.signatures.map(function (signature) {
          return signature ? new Buffer(signature, 'hex') : ops.OP_0
        })

        assert.throws(function () {
          bscript.multisigInput(signatures, scriptPubKey)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisigOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(function (p) { return new Buffer(p, 'hex') })
      var scriptPubKey = bscript.multisigOutput(pubKeys.length, pubKeys)

      it('returns ' + f.scriptPubKey, function () {
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.multisigOutput.forEach(function (f) {
      var pubKeys = f.pubKeys.map(function (p) {
        return new Buffer(p, 'hex')
      })

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.multisigOutput(f.m, pubKeys)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('scriptHashInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'scripthash') return

      var redeemScript = bscript.fromASM(f.redeemScript)
      var redeemScriptSig = bscript.fromASM(f.redeemScriptSig)

      it('returns ' + f.scriptSig, function () {
        var scriptSig = bscript.scriptHashInput(redeemScriptSig, redeemScript)

        if (f.scriptSig) {
          assert.strictEqual(bscript.toASM(scriptSig), f.scriptSig)
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
        var redeemScript = bscript.fromASM(f.redeemScript)
        var scriptPubKey = bscript.scriptHashOutput(bcrypto.hash160(redeemScript))

        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.scriptHashOutput.forEach(function (f) {
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.scriptHashOutput(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessPubKeyHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnesspubkeyhash') return
      if (!f.scriptPubKey) return

      var pubKey = new Buffer(f.pubKey, 'hex')
      var pubKeyHash = bcrypto.hash160(pubKey)

      it('returns ' + f.scriptPubKey, function () {
        var scriptPubKey = bscript.witnessPubKeyHashOutput(pubKeyHash)
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.witnessPubKeyHashOutput.forEach(function (f) {
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.witnessPubKeyHashOutput(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('witnessScriptHashInput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnessscripthash') return

      var witnessScript = bscript.fromASM(f.witnessScriptPubKey)
      var witnessScriptSig = bscript.fromASM(f.witnessScriptSig)

      it('returns ' + f.witness, function () {
        var witness = bscript.witnessScriptHashInput(witnessScriptSig, witnessScript)

        assert.strictEqual(bscript.toASM(witness), f.witness)
      })
    })
  })

  describe('witnessScriptHashOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'witnessscripthash') return
      if (!f.scriptPubKey) return

      it('returns ' + f.scriptPubKey, function () {
        var witnessScriptPubKey = bscript.fromASM(f.witnessScriptPubKey)
        var scriptPubKey = bscript.witnessScriptHashOutput(bcrypto.hash256(witnessScriptPubKey))

        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })

    fixtures.invalid.witnessScriptHashOutput.forEach(function (f) {
      var hash = new Buffer(f.hash, 'hex')

      it('throws on ' + f.exception, function () {
        assert.throws(function () {
          bscript.witnessScriptHashOutput(hash)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('nullDataOutput', function () {
    fixtures.valid.forEach(function (f) {
      if (f.type !== 'nulldata') return

      var data = new Buffer(f.data, 'hex')
      var scriptPubKey = bscript.nullDataOutput(data)

      it('returns ' + f.scriptPubKey, function () {
        assert.strictEqual(bscript.toASM(scriptPubKey), f.scriptPubKey)
      })
    })
  })

  describe('SCRIPT_VERIFY_MINIMALDATA policy', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSigHex) {
        it('compliant for ' + f.type + ' scriptSig ' + f.scriptSig, function () {
          var script = new Buffer(f.scriptSigHex, 'hex')

          assert(minimalData(script))
        })
      }

      if (f.scriptPubKeyHex) {
        it('compliant for ' + f.type + ' scriptPubKey ' + f.scriptPubKey, function () {
          var script = new Buffer(f.scriptPubKeyHex, 'hex')

          assert(minimalData(script))
        })
      }
    })

    function testEncodingForSize (i) {
      it('compliant for data PUSH of length ' + i, function () {
        var buffer = new Buffer(i)
        var script = bscript.compile([buffer])

        assert(minimalData(script), 'Failed for ' + i + ' length script')
      })
    }

    for (var i = 0; i < 520; ++i) {
      testEncodingForSize(i)
    }
  })
})
