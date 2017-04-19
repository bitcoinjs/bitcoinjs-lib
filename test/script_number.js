/* global describe, it */

var assert = require('assert')
var scriptNumber = require('../src/script_number')
var fixtures = require('./fixtures/script_number.json')

describe('script-number', function () {
  describe('decode', function () {
    fixtures.forEach(function (f) {
      it(f.hex + ' returns ' + f.number, function () {
        var actual = scriptNumber.decode(Buffer.from(f.hex, 'hex'), f.bytes)

        assert.strictEqual(actual, f.number)
      })
    })
  })

  describe('encode', function () {
    fixtures.forEach(function (f) {
      it(f.number + ' returns ' + f.hex, function () {
        var actual = scriptNumber.encode(f.number)

        assert.strictEqual(actual.toString('hex'), f.hex)
      })
    })
  })
})
