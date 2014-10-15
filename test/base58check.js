var assert = require('assert')
var base58check = require('../src/base58check')
var bs58check = require('bs58check')
var sinon = require('sinon')

describe('base58check', function() {
  var param

  beforeEach(function() {
    param = {}
  })

  it('wraps bs58check.decode', sinon.test(function() {
    this.mock(bs58check).expects('decode')
      .once().calledWith(param).returns('foo')

    assert.equal(base58check.decode(param), 'foo')
  }))

  it('wraps bs58check.encode', sinon.test(function() {
    this.mock(bs58check).expects('encode')
      .once().calledWith(param).returns('foo')

    assert.equal(base58check.encode(param), 'foo')
  }))
})
