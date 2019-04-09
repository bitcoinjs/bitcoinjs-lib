const { describe, it } = require('mocha')
const assert = require('assert')
const bcrypto = require('../src/crypto')

const fixtures = require('./fixtures/crypto')

describe('crypto', () => {
  ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(algorithm => {
    describe(algorithm, () => {
      fixtures.forEach(f => {
        const fn = bcrypto[algorithm]
        const expected = f[algorithm]

        it('returns ' + expected + ' for ' + f.hex, () => {
          const data = Buffer.from(f.hex, 'hex')
          const actual = fn(data).toString('hex')

          assert.strictEqual(actual, expected)
        })
      })
    })
  })
})
