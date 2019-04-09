const { describe, it } = require('mocha')
const assert = require('assert')
const scriptNumber = require('../src/script_number')
const fixtures = require('./fixtures/script_number.json')

describe('script-number', () => {
  describe('decode', () => {
    fixtures.forEach(f => {
      it(f.hex + ' returns ' + f.number, () => {
        const actual = scriptNumber.decode(Buffer.from(f.hex, 'hex'), f.bytes)

        assert.strictEqual(actual, f.number)
      })
    })
  })

  describe('encode', () => {
    fixtures.forEach(f => {
      it(f.number + ' returns ' + f.hex, () => {
        const actual = scriptNumber.encode(f.number)

        assert.strictEqual(actual.toString('hex'), f.hex)
      })
    })
  })
})
