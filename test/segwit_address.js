/* global describe, it */

var assert = require('assert')
var segaddr = require('../src/segwit_address')

var fixtures = require('./fixtures/segwit_address.json')

describe('bech32 segwit address', function () {
  fixtures.addresses.valid.forEach(function (fixture) {
    var program = Buffer.from(fixture.hex, 'hex')
    it('can be encoded: ' + fixture.string, function () {
      var encoded = segaddr.encode(fixture.prefix,
        fixture.version,
        program
      )
      assert.equal(encoded, fixture.string.toLowerCase())
    })

    it('can be decoded: ' + fixture.string, function () {
      var decoded = segaddr.decode(fixture.prefix,
        fixture.string
      )
      assert.equal(fixture.version, decoded.version)
      assert(program.equals(decoded.program))
    })
  })
  fixtures.addresses.invalid.forEach(function (fixture) {
    it('cant be decoded: ' + fixture, function () {
      assert.throws(function () {
        segaddr.decode('bc', fixture)
      })
      assert.throws(function () {
        segaddr.decode('tb', fixture)
      })
    })
  })
  fixtures.program.invalid.forEach(function (fixture) {
    var program = Buffer.from(fixture.program, 'hex')
    it('cant be encoded: ' + fixture.version + '-' + fixture.program, function () {
      assert.throws(function () {
        segaddr.encode('bc', fixture.version, program)
      })
    })
  })
})
