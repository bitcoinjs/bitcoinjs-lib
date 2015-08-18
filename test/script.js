/* global describe, it */
/* eslint-disable no-new */

var assert = require('assert')
var Script = require('../src/script')
var OPS = require('../src/opcodes')

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
    it('should match expected behaviour', function () {
      var hash = new Buffer(32)
      hash.fill(0)

      var script = Script.compile([
        OPS.OP_HASH160,
        hash,
        OPS.OP_EQUAL
      ])

      assert.strictEqual(script.toString('hex'), 'a920000000000000000000000000000000000000000000000000000000000000000087')
    })
  })
})
