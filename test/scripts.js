var assert = require('assert')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var ECPubKey = require('../src/ecpubkey')
var Script = require('../src/script')

var fixtures = require('./fixtures/script.json')
var fixtures2 = require('./fixtures/scripts.json')

describe('Scripts', function() {
  describe('classifyInput', function() {
    fixtures.valid.forEach(function(f) {
      if (f.scriptPubKey) return

      it('supports ' + f.type, function() {
        var script = Script.fromHex(f.hex)
        var type = scripts.classifyInput(script)

        assert.equal(type, f.type)
      })
    })
  })

  describe('classifyOutput', function() {
    fixtures.valid.forEach(function(f) {
      if (!f.scriptPubKey) return

      it('supports ' + f.type, function() {
        var script = Script.fromHex(f.hex)
        var type = scripts.classifyOutput(script)

        assert.equal(type, f.type)
      })
    })
  })

  describe('pubKey', function() {
    fixtures2.valid.pubKey.forEach(function(f) {
      describe('input script', function() {
        it('is generated correctly for ' + f.pubKey, function() {
          var signature = new Buffer(f.signature, 'hex')

          var scriptSig = scripts.pubKeyInput(signature)
          assert.equal(scriptSig.toHex(), f.scriptSig)
        })
      })

      describe('output script', function() {
        it('is generated correctly for ' + f.pubKey, function() {
          var pubKey = ECPubKey.fromHex(f.pubKey)

          var scriptPubKey = scripts.pubKeyOutput(pubKey)
          assert.equal(scriptPubKey.toHex(), f.scriptPubKey)
        })
      })
    })
  })

  describe('pubKeyHash', function() {
    fixtures2.valid.pubKeyHash.forEach(function(f) {
      var pubKey = ECPubKey.fromHex(f.pubKey)
      var address = pubKey.getAddress()

      describe('input script', function() {
        it('is generated correctly for ' + address, function() {
          var signature = new Buffer(f.signature, 'hex')

          var scriptSig = scripts.pubKeyHashInput(signature, pubKey)
          assert.equal(scriptSig.toHex(), f.scriptSig)
        })
      })

      describe('output script', function() {
        it('is generated correctly for ' + address, function() {
          var scriptPubKey = scripts.pubKeyHashOutput(address.hash)
          assert.equal(scriptPubKey.toHex(), f.scriptPubKey)
        })
      })
    })
  })

  describe('multisig', function() {
    fixtures2.valid.multisig.forEach(function(f) {
      var pubKeys = f.pubKeys.map(ECPubKey.fromHex)
      var scriptPubKey = scripts.multisigOutput(pubKeys.length, pubKeys)

      // FIXME: some missing test data for now
      if (f.scriptSig) {
        describe('input script', function() {
          it('is generated correctly for ' + scriptPubKey.toHex(), function() {
            var signatures = f.signatures.map(function(signature) {
              return new Buffer(signature, 'hex')
            })

            var scriptSig = scripts.multisigInput(signatures)
            assert.equal(scriptSig.toHex(), f.scriptSig)
          })
        })
      }

      describe('output script', function() {
        it('is generated correctly for ' + scriptPubKey.toHex(), function() {
          assert.equal(scriptPubKey.toHex(), f.scriptPubKey)
        })
      })
    })

    fixtures2.invalid.multisig.forEach(function(f) {
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
    fixtures2.valid.scripthash.forEach(function(f) {
      var redeemScript = Script.fromHex(f.redeemScript)
      var redeemScriptSig = Script.fromHex(f.redeemScriptSig)

      var address = Address.fromOutputScript(Script.fromHex(f.scriptPubKey))

      describe('input script', function() {
        it('is generated correctly for ' + address, function() {
          var scriptSig = scripts.scriptHashInput(redeemScriptSig, redeemScript)

          assert.equal(scriptSig.toHex(), f.scriptSig)
        })
      })

      describe('output script', function() {
        it('is generated correctly for ' + address, function() {
          var scriptPubKey = scripts.scriptHashOutput(redeemScript.getHash())

          assert.equal(scriptPubKey.toHex(), f.scriptPubKey)
        })
      })
    })
  })
})
