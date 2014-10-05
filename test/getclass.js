var assert = require('assert')
var ecurve = require('ecurve')
var curve = ecurve.getCurveByName('secp256k1')
var getClass = require('../src/getclass')

var BigInteger = require('bigi')
var ECKey = require('../src/eckey')

describe('getClass', function() {
  it("returns the name of the object's constructor function", function() {
    assert.equal(getClass(ECKey.makeRandom()), "ECKey")
    assert.equal(getClass(BigInteger.ZERO), "BigInteger")
  })

  it("does not include the namespace", function() {
    var point = new ecurve.Point(curve, BigInteger.ONE, BigInteger.ONE, BigInteger.ONE)
    assert.equal(getClass(point), "Point")
  })
})
