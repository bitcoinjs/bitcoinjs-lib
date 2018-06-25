/* global describe, it */

const assert = require('assert')
const bcrypto = require('../src/crypto')

const fixtures = require('./fixtures/crypto')

describe('crypto', function () {
  ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(function (algorithm) {
    describe(algorithm, function () {
      fixtures.forEach(function (f) {
        var fn = bcrypto[algorithm]
        var expected = f[algorithm]

        it('returns ' + expected + ' for ' + f.hex, function () {
          var data = Buffer.from(f.hex, 'hex')
          var actual = fn(data).toString('hex')

          assert.strictEqual(actual, expected)
        })
      })
    })
  })
})
