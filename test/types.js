const { describe, it } = require('mocha')
const assert = require('assert')
const types = require('../src/types')
const typeforce = require('typeforce')

describe('types', function () {
  describe('Buffer Hash160/Hash256', function () {
    const buffer20byte = Buffer.alloc(20)
    const buffer32byte = Buffer.alloc(32)

    it('return true for valid size', function () {
      assert(types.Hash160bit(buffer20byte))
      assert(types.Hash256bit(buffer32byte))
    })

    it('return true for oneOf', function () {
      assert.doesNotThrow(function () {
        typeforce(types.oneOf(types.Hash160bit, types.Hash256bit), buffer32byte)
      })

      assert.doesNotThrow(function () {
        typeforce(types.oneOf(types.Hash256bit, types.Hash160bit), buffer32byte)
      })
    })

    it('throws for invalid size', function () {
      assert.throws(function () {
        types.Hash160bit(buffer32byte)
      }, /Expected Buffer\(Length: 20\), got Buffer\(Length: 32\)/)

      assert.throws(function () {
        types.Hash256bit(buffer20byte)
      }, /Expected Buffer\(Length: 32\), got Buffer\(Length: 20\)/)
    })
  })

  describe('Satoshi', function () {
    [
      { value: -1, result: false },
      { value: 0, result: true },
      { value: 1, result: true },
      { value: 20999999 * 1e8, result: true },
      { value: 21000000 * 1e8, result: true },
      { value: 21000001 * 1e8, result: false }
    ].forEach(function (f) {
      it('returns ' + f.result + ' for valid for ' + f.value, function () {
        assert.strictEqual(types.Satoshi(f.value), f.result)
      })
    })
  })
})
