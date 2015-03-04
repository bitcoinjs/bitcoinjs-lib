/* global describe, it */

var assert = require('assert')
var crypto = require('../src/crypto')

var fixtures = require('./fixtures/crypto')

describe('Crypto', function () {
  ['hash160', 'hash256', 'ripemd160', 'sha1', 'sha256'].forEach(function (algorithm) {
    describe(algorithm, function () {
      fixtures.valid.forEach(function (f) {
        var fn = crypto[algorithm]
        var expected = f[algorithm]

        it('returns ' + expected + ' for ' + f.hex, function () {
          var data = new Buffer(f.hex, 'hex')
          var actual = fn(data).toString('hex')

          assert.equal(actual, expected)
        })
      })
    })
  })
})
