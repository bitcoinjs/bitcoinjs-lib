/* global describe, it */

var assert = require('assert')
var bscript = require('../src/script')
var minimalData = require('minimaldata')

var fixtures = require('./fixtures/script.json')

describe('script', function () {
  // TODO
  describe('isCanonicalPubKey', function () {
    it('rejects if not provided a Buffer', function () {
      assert.strictEqual(false, bscript.isCanonicalPubKey(0))
    })
    it('rejects smaller than 33', function () {
      for (var i = 0; i < 33; i++) {
        assert.strictEqual(false, bscript.isCanonicalPubKey(new Buffer('', i)))
      }
    })
  })
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

  describe('compile (via fromASM)', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSig) {
        it('(' + f.type + ') compiles ' + f.scriptSig, function () {
          var scriptSig = bscript.fromASM(f.scriptSig)

          assert.strictEqual(scriptSig.toString('hex'), f.scriptSigHex)

          if (f.nonstandard) {
            var scriptSigNS = bscript.fromASM(f.nonstandard.scriptSig)

            assert.strictEqual(scriptSigNS.toString('hex'), f.scriptSigHex)
          }
        })
      }

      if (f.scriptPubKey) {
        it('(' + f.type + ') compiles ' + f.scriptPubKey, function () {
          var scriptPubKey = bscript.fromASM(f.scriptPubKey)

          assert.strictEqual(scriptPubKey.toString('hex'), f.scriptPubKeyHex)
        })
      }
    })
  })

  describe('decompile', function () {
    fixtures.valid.forEach(function (f) {
      if (f.scriptSigHex) {
        it('decompiles ' + f.scriptSig, function () {
          var chunks = bscript.decompile(new Buffer(f.scriptSigHex, 'hex'))

          assert.strictEqual(bscript.compile(chunks).toString('hex'), f.scriptSigHex)
          assert.strictEqual(bscript.toASM(chunks), f.scriptSig)

          if (f.nonstandard) {
            var chunksNS = bscript.decompile(new Buffer(f.nonstandard.scriptSigHex, 'hex'))

            assert.strictEqual(bscript.compile(chunksNS).toString('hex'), f.scriptSigHex)

            // toASM converts verbatim, only `compile` transforms the script to a minimalpush compliant script
            assert.strictEqual(bscript.toASM(chunksNS), f.nonstandard.scriptSig)
          }
        })
      }

      if (f.scriptPubKeyHex) {
        it('decompiles ' + f.scriptPubKey, function () {
          var chunks = bscript.decompile(new Buffer(f.scriptPubKeyHex, 'hex'))

          assert.strictEqual(bscript.compile(chunks).toString('hex'), f.scriptPubKeyHex)
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

        assert(minimalData(script), 'Failed for ' + i + ' length script: ' + script.toString('hex'))
      })
    }

    for (var i = 0; i < 520; ++i) {
      testEncodingForSize(i)
    }
  })
})
