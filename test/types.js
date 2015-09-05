/* global describe, it */

var assert = require('assert')
var types = require('../src/types')

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
})
