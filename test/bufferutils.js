const { describe, it } = require('mocha')
const assert = require('assert')
const bufferutils = require('../src/bufferutils')

const fixtures = require('./fixtures/bufferutils.json')

describe('bufferutils', function () {
  describe('readUInt64LE', function () {
    fixtures.valid.forEach(function (f) {
      it('decodes ' + f.hex, function () {
        const buffer = Buffer.from(f.hex, 'hex')
        const number = bufferutils.readUInt64LE(buffer, 0)

        assert.strictEqual(number, f.dec)
      })
    })

    fixtures.invalid.readUInt64LE.forEach(function (f) {
      it('throws on ' + f.description, function () {
        const buffer = Buffer.from(f.hex, 'hex')

        assert.throws(function () {
          bufferutils.readUInt64LE(buffer, 0)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('writeUInt64LE', function () {
    fixtures.valid.forEach(function (f) {
      it('encodes ' + f.dec, function () {
        const buffer = Buffer.alloc(8, 0)

        bufferutils.writeUInt64LE(buffer, f.dec, 0)
        assert.strictEqual(buffer.toString('hex'), f.hex)
      })
    })

    fixtures.invalid.readUInt64LE.forEach(function (f) {
      it('throws on ' + f.description, function () {
        const buffer = Buffer.alloc(8, 0)

        assert.throws(function () {
          bufferutils.writeUInt64LE(buffer, f.dec, 0)
        }, new RegExp(f.exception))
      })
    })
  })
})
