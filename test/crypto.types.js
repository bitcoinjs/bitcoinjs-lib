
const { describe, it } = require('mocha')
const assert = require('assert')
const bcrypto = require('../src/crypto')

const fixtures = require('./fixtures/crypto')

describe('crypto', function () {
  ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(algorithm => {
    describe(algorithm, () => {
      fixtures.forEach(f => {
        const fn = bcrypto[algorithm]

        it('returns a Buffer for ' + f.hex, () => {
          const data = Buffer.from(f.hex, 'hex')
          const hash = fn(data)

          assert(Buffer.isBuffer(hash))
        })
      })
    })
  })
})
