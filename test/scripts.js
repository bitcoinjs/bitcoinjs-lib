var assert = require('assert')
var scripts = require('../src/scripts')

var ECPubKey = require('../src/ecpubkey')
var Script = require('../src/script')

var fixtures = require('./fixtures/scripts.json')

describe('Scripts', function() {
  // TODO
  describe.skip('isCanonicalPubKey', function() {})
  describe.skip('isCanonicalSignature', function() {})

  describe('classifyInput', function() {
    fixtures.valid.forEach(function(f) {
      if (!f.scriptSig) return

      it('classifies ' + f.scriptSig + ' as ' + f.type, function() {
        var script = Script.fromASM(f.scriptSig)
        var type = scripts.classifyInput(script)

        assert.equal(type, f.type)
      })
    })
  })

  describe('classifyOutput', function() {
    fixtures.valid.forEach(function(f) {
      if (!f.scriptPubKey) return

      it('classifies ' + f.scriptPubKey + ' as ' + f.type, function() {
        var script = Script.fromASM(f.scriptPubKey)
        var type = scripts.classifyOutput(script)

        assert.equal(type, f.type)
      })
    })
  })

  ;['PubKey', 'PubKeyHash', 'ScriptHash', 'Multisig', 'NullData'].forEach(function(type) {
    var inputFn = scripts['is' + type + 'Input']
    var outputFn= scripts['is' + type + 'Output']

    describe('is' + type + 'Input', function() {
      fixtures.valid.forEach(function(f) {
        var expected = type.toLowerCase() === f.type

        if (inputFn && f.scriptSig) {
          it('returns ' + expected + ' for ' + f.scriptSig, function() {
            var script = Script.fromASM(f.scriptSig)

            assert.equal(inputFn(script), expected)
          })
        }
      })
    })

    describe('is' + type + 'Output', function() {
      fixtures.valid.forEach(function(f) {
        var expected = type.toLowerCase() === f.type

        if (outputFn && f.scriptPubKey) {
          it('returns ' + expected + ' for ' + f.scriptPubKey, function() {
            var script = Script.fromASM(f.scriptPubKey)

            assert.equal(outputFn(script), expected)
          })
        }
      })
    })
  })

  describe('pubKeyInput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptSig, function() {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = scripts.pubKeyInput(signature)
        assert.equal(scriptSig.toASM(), f.scriptSig)
      })
    })
  })

  describe('pubKeyOutput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'pubkey') return

      it('returns ' + f.scriptPubKey, function() {
        var pubKey = ECPubKey.fromHex(f.pubKey)

        var scriptPubKey = scripts.pubKeyOutput(pubKey)
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
      })
    })
  })

  describe('pubKeyHashInput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = ECPubKey.fromHex(f.pubKey)

      it('returns ' + f.scriptSig, function() {
        var signature = new Buffer(f.signature, 'hex')

        var scriptSig = scripts.pubKeyHashInput(signature, pubKey)
        assert.equal(scriptSig.toASM(), f.scriptSig)
      })
    })
  })

  describe('pubKeyHashOutput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = ECPubKey.fromHex(f.pubKey)
      var address = pubKey.getAddress()

      it('returns ' + f.scriptPubKey, function() {
        var scriptPubKey = scripts.pubKeyHashOutput(address.hash)
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
      })
    })
  })

  describe('multisigInput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'multisig') return

      it('returns ' + f.scriptSig, function() {
        var signatures = f.signatures.map(function(signature) {
          return new Buffer(signature, 'hex')
        })

        var scriptSig = scripts.multisigInput(signatures)
        assert.equal(scriptSig.toASM(), f.scriptSig)
      })
    })

    fixtures.invalid.multisigInput.forEach(function(f) {
      var pubKeys = f.pubKeys.map(ECPubKey.fromHex)
      var scriptPubKey = scripts.multisigOutput(pubKeys.length, pubKeys)

      it('throws on ' + f.exception, function() {
        var signatures = f.signatures.map(function(signature) {
          return new Buffer(signature, 'hex')
        })

        assert.throws(function() {
          scripts.multisigInput(signatures, scriptPubKey)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('multisigOutput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(ECPubKey.fromHex)
      var scriptPubKey = scripts.multisigOutput(pubKeys.length, pubKeys)

      it('returns ' + f.scriptPubKey, function() {
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
      })
    })

    fixtures.invalid.multisigOutput.forEach(function(f) {
      var pubKeys = f.pubKeys.map(ECPubKey.fromHex)

      it('throws on ' + f.exception, function() {
        assert.throws(function() {
          scripts.multisigOutput(f.m, pubKeys)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('scriptHashInput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'scripthash') return

      var redeemScript = Script.fromASM(f.redeemScript)
      var redeemScriptSig = Script.fromASM(f.redeemScriptSig)

      it('returns ' + f.scriptSig, function() {
        var scriptSig = scripts.scriptHashInput(redeemScriptSig, redeemScript)

        assert.equal(scriptSig.toASM(), f.scriptSig)
      })
    })
  })

  describe('scriptHashOutput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'scripthash') return

      var redeemScript = Script.fromASM(f.redeemScript)

      it('returns ' + f.scriptPubKey, function() {
        var scriptPubKey = scripts.scriptHashOutput(redeemScript.getHash())

        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
      })
    })
  })

  describe('nullDataOutput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'nulldata') return

      var data = new Buffer(f.data, 'hex')
      var scriptPubKey = scripts.nullDataOutput(data)

      it('returns ' + f.scriptPubKey, function() {
        assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
      })
    })
  })
})
