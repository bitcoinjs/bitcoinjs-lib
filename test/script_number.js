const { describe, it } = require('mocha')
const assert = require('assert')
const scriptNumber = require('../src/script_number')
const fixtures = require('./fixtures/script_number.json')

describe('script-number', function () {
  describe('decode', function () {
    fixtures.forEach(function (f) {
      it(f.hex + ' returns ' + f.number, function () {
        const actual = scriptNumber.decode(Buffer.from(f.hex, 'hex'), f.bytes)

        assert.strictEqual(actual, f.number)
      })
    })
  })

  describe('encode', function () {
    fixtures.forEach(function (f) {
      it(f.number + ' returns ' + f.hex, function () {
        const actual = scriptNumber.encode(f.number)

        assert.strictEqual(actual.toString('hex'), f.hex)
      })
    })
  })
})
