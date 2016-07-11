/* global describe, it */

var assert = require('assert')
var types = require('../src/types')
var typeforce = require('typeforce')

describe('types', function () {
  describe('BigInt/ECPoint', function () {
    it('return true for duck types', function () {
      assert(types.BigInt(new function BigInteger () {}))
      assert(types.ECPoint(new function Point () {}))
    })

    it('return false for bad types', function () {
      assert(!types.BigInt(new function NotABigInteger () {}))
      assert(!types.ECPoint(new function NotAPoint () {}))
    })
  })

  describe('Buffer Hash160/Hash256', function () {
    var buffer20byte = new Buffer(20)
    var buffer32byte = new Buffer(32)

    it('return true for valid size', function () {
      assert(types.Hash160bit(buffer20byte))
      assert(types.Hash256bit(buffer32byte))
    })

    it('return true for oneOf', function () {
      assert(typeforce(types.oneOf(types.Hash160bit, types.Hash256bit), buffer32byte))
      assert(typeforce(types.oneOf(types.Hash256bit, types.Hash160bit), buffer32byte))
    })

    it('throws for invalid size', function () {
      assert.throws(function () {
        types.Hash160bit(buffer32byte)
      }, /Expected 160-bit Buffer, got 256-bit Buffer/)

      assert.throws(function () {
        types.Hash256bit(buffer20byte)
      }, /Expected 256-bit Buffer, got 160-bit Buffer/)
    })
  })
})
