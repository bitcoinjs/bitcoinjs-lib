const { describe, it } = require('mocha')
const assert = require('assert')
const bscript = require('../src/script')
const minimalData = require('minimaldata')

const fixtures = require('./fixtures/script.json')
const fixtures2 = require('./fixtures/templates.json')

describe('script', function () {
  // TODO
  describe('isCanonicalPubKey', function () {
    it('rejects if not provided a Buffer', function () {
      assert.strictEqual(false, bscript.isCanonicalPubKey(0))
    })
    it('rejects smaller than 33', function () {
      for (var i = 0; i < 33; i++) {
        assert.strictEqual(false, bscript.isCanonicalPubKey(Buffer.from('', i)))
      }
    })
  })
  describe.skip('isCanonicalScriptSignature', function () {
  })

  describe('fromASM/toASM', function () {
    fixtures.valid.forEach(function (f) {
      it('encodes/decodes ' + f.asm, function () {
        const script = bscript.fromASM(f.asm)
        assert.strictEqual(bscript.toASM(script), f.asm)
      })
    })

    fixtures.invalid.fromASM.forEach(function (f) {
      it('throws ' + f.description, function () {
        assert.throws(function () {
          bscript.fromASM(f.script)
        }, new RegExp(f.description))
      })
    })
  })

  describe('fromASM/toASM (templates)', function () {
    fixtures2.valid.forEach(function (f) {
      if (f.inputHex) {
        const ih = bscript.toASM(Buffer.from(f.inputHex, 'hex'))

        it('encodes/decodes ' + ih, function () {
          const script = bscript.fromASM(f.input)
          assert.strictEqual(script.toString('hex'), f.inputHex)
          assert.strictEqual(bscript.toASM(script), f.input)
        })
      }

      if (f.outputHex) {
        it('encodes/decodes ' + f.output, function () {
          const script = bscript.fromASM(f.output)
          assert.strictEqual(script.toString('hex'), f.outputHex)
          assert.strictEqual(bscript.toASM(script), f.output)
        })
      }
    })
  })

  describe('isPushOnly', function () {
    fixtures.valid.forEach(function (f) {
      it('returns ' + !!f.stack + ' for ' + f.asm, function () {
        const script = bscript.fromASM(f.asm)
        const chunks = bscript.decompile(script)

        assert.strictEqual(bscript.isPushOnly(chunks), !!f.stack)
      })
    })
  })

  describe('toStack', function () {
    fixtures.valid.forEach(function (f) {
      it('returns ' + !!f.stack + ' for ' + f.asm, function () {
        if (!f.stack || !f.asm) return

        const script = bscript.fromASM(f.asm)

        const stack = bscript.toStack(script)
        assert.deepEqual(stack.map(function (x) {
          return x.toString('hex')
        }), f.stack)

        assert.equal(bscript.toASM(bscript.compile(stack)), f.asm, 'should rebuild same script from stack')
      })
    })
  })

  describe('compile (via fromASM)', function () {
    fixtures.valid.forEach(function (f) {
      it('(' + f.type + ') compiles ' + f.asm, function () {
        const scriptSig = bscript.fromASM(f.asm)

        assert.strictEqual(scriptSig.toString('hex'), f.script)

        if (f.nonstandard) {
          const scriptSigNS = bscript.fromASM(f.nonstandard.scriptSig)

          assert.strictEqual(scriptSigNS.toString('hex'), f.script)
        }
      })
    })
  })

  describe('decompile', function () {
    fixtures.valid.forEach(function (f) {
      it('decompiles ' + f.asm, function () {
        const chunks = bscript.decompile(Buffer.from(f.script, 'hex'))

        assert.strictEqual(bscript.compile(chunks).toString('hex'), f.script)
        assert.strictEqual(bscript.toASM(chunks), f.asm)

        if (f.nonstandard) {
          const chunksNS = bscript.decompile(Buffer.from(f.nonstandard.scriptSigHex, 'hex'))

          assert.strictEqual(bscript.compile(chunksNS).toString('hex'), f.script)

          // toASM converts verbatim, only `compile` transforms the script to a minimalpush compliant script
          assert.strictEqual(bscript.toASM(chunksNS), f.nonstandard.scriptSig)
        }
      })
    })

    fixtures.invalid.decompile.forEach(function (f) {
      it('fails to decompile ' + f.script + ',  because "' + f.description + '"', function () {
        const chunks = bscript.decompile(Buffer.from(f.script, 'hex'))

        assert.strictEqual(chunks, null)
      })
    })
  })

  describe('SCRIPT_VERIFY_MINIMALDATA policy', function () {
    fixtures.valid.forEach(function (f) {
      it('compliant for ' + f.type + ' scriptSig ' + f.asm, function () {
        const script = Buffer.from(f.script, 'hex')

        assert(minimalData(script))
      })
    })

    function testEncodingForSize (i) {
      it('compliant for data PUSH of length ' + i, function () {
        const buffer = Buffer.alloc(i)
        const script = bscript.compile([buffer])

        assert(minimalData(script), 'Failed for ' + i + ' length script: ' + script.toString('hex'))
      })
    }

    for (var i = 0; i < 520; ++i) {
      testEncodingForSize(i)
    }
  })
})
