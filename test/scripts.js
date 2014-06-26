var assert = require('assert')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var ECPubKey = require('../src/ecpubkey')
var Script = require('../src/script')

var fixtures = require('./fixtures/scripts.json')

describe('Scripts', function() {
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

    fixtures.invalid.classify.forEach(function(f) {
      it('returns nonstandard for ' + f.description, function() {
        var script = Script.fromASM(f.scriptPubKey)
        var type = scripts.classifyOutput(script)

        assert.equal(type, 'nonstandard')
      })
    })
  })

  describe('pubKey', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'pubkey') return

      describe('input script', function() {
        it('is generated correctly for ' + f.pubKey, function() {
          var signature = new Buffer(f.signature, 'hex')

          var scriptSig = scripts.pubKeyInput(signature)
          assert.equal(scriptSig.toASM(), f.scriptSig)
        })
      })

      describe('output script', function() {
        it('is generated correctly for ' + f.pubKey, function() {
          var pubKey = ECPubKey.fromHex(f.pubKey)

          var scriptPubKey = scripts.pubKeyOutput(pubKey)
          assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
        })
      })
    })
  })

  describe('pubKeyHash', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'pubkeyhash') return

      var pubKey = ECPubKey.fromHex(f.pubKey)
      var address = pubKey.getAddress()

      describe('input script', function() {
        it('is generated correctly for ' + address, function() {
          var signature = new Buffer(f.signature, 'hex')

          var scriptSig = scripts.pubKeyHashInput(signature, pubKey)
          assert.equal(scriptSig.toASM(), f.scriptSig)
        })
      })

      describe('output script', function() {
        it('is generated correctly for ' + address, function() {
          var scriptPubKey = scripts.pubKeyHashOutput(address.hash)
          assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
        })
      })
    })
  })

  describe('multisig', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'multisig') return

      var pubKeys = f.pubKeys.map(ECPubKey.fromHex)
      var scriptPubKey = scripts.multisigOutput(pubKeys.length, pubKeys)

      describe('input script', function() {
        it('is generated correctly for ' + f.scriptPubKey, function() {
          var signatures = f.signatures.map(function(signature) {
            return new Buffer(signature, 'hex')
          })

          var scriptSig = scripts.multisigInput(signatures)
          assert.equal(scriptSig.toASM(), f.scriptSig)
        })
      })

      describe('output script', function() {
        it('is generated correctly for ' + f.scriptPubKey, function() {
          assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
        })
      })
    })

    fixtures.invalid.multisig.forEach(function(f) {
      var pubKeys = f.pubKeys.map(ECPubKey.fromHex)
      var scriptPubKey = scripts.multisigOutput(pubKeys.length, pubKeys)

      if (f.scriptPubKey) {
        describe('output script', function() {
          it('throws on ' + f.exception, function() {
            assert.throws(function() {
              scripts.multisigOutput(f.m, pubKeys)
            }, new RegExp(f.exception))
          })
        })
      } else {
        describe('input script', function() {
          it('throws on ' + f.exception, function() {
            var signatures = f.signatures.map(function(signature) {
              return new Buffer(signature, 'hex')
            })

            assert.throws(function() {
              scripts.multisigInput(signatures, scriptPubKey)
            }, new RegExp(f.exception))
          })
        })
      }
    })
  })

  describe('scripthash', function() {
    fixtures.valid.forEach(function(f) {
      if (f.type !== 'scripthash') return

      var redeemScript = Script.fromASM(f.redeemScript)
      var redeemScriptSig = Script.fromASM(f.redeemScriptSig)

      var address = Address.fromOutputScript(Script.fromASM(f.scriptPubKey))

      describe('input script', function() {
        it('is generated correctly for ' + address, function() {
          var scriptSig = scripts.scriptHashInput(redeemScriptSig, redeemScript)

          assert.equal(scriptSig.toASM(), f.scriptSig)
        })
      })

      describe('output script', function() {
        it('is generated correctly for ' + address, function() {
          var scriptPubKey = scripts.scriptHashOutput(redeemScript.getHash())

          assert.equal(scriptPubKey.toASM(), f.scriptPubKey)
        })
      })
    })
  })
})
