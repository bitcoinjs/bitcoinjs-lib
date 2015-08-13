/* global describe, it */
/* eslint-disable no-new */

var assert = require('assert')
var Script = require('../src/script')

var fixtures = require('./fixtures/script.json')

describe('Script', function () {
  describe('fromASM/toASM', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.asm) return

      it('decodes/encodes ' + f.description, function () {
        var script = Script.fromASM(f.asm)

        assert.strictEqual(Script.toASM(script), f.asm)
      })
    })
  })

  describe('compile', function () {
    fixtures.valid.forEach(function (f) {
      if (!f.asm) return

      it('decodes/encodes ' + f.description, function () {
        var script = Script.fromASM(f.asm)

        assert.strictEqual(Script.compile(script).toString('hex'), f.hex)
      })
    })
  })

  describe('decompile', function () {
    fixtures.valid.forEach(function (f) {
      it('decodes/encodes ' + f.description, function () {
        var script = Script.decompile(new Buffer(f.hex, 'hex'))

        assert.strictEqual(Script.toASM(script), f.asm)
      })
    })
  })
})
