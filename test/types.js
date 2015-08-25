/* global describe, it */

var assert = require('assert')
var types = require('../src/types')

describe('types', function () {
  describe('ECCurve/ECPoint/BigInt', function () {
    it('return true for duck types', function () {
      assert(types.quacksLike('BigInteger', function BigInteger () {}))
      assert(types.quacksLike('Curve', function Curve () {}))
      assert(types.quacksLike('Point', function Point () {}))
    })
  })
})
