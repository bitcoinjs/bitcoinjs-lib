var assert = require('assert')
var bufferutils = require('../src/bufferutils')

var fixtures = require('./fixtures/buffer.json')

describe('bufferutils', function() {
  describe('pushDataSize', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f) {
        if (!f.hexPD) return

        var size = bufferutils.pushDataSize(f.dec)

        assert.equal(size, f.hexPD.length / 2)
      })
    })
  })

  describe('readPushDataInt', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f) {
        if (!f.hexPD) return

        var buffer = new Buffer(f.hexPD, 'hex')
        var d = bufferutils.readPushDataInt(buffer, 0)

        assert.equal(d.number, f.dec)
        assert.equal(d.size, buffer.length)
      })
    })
  })

  describe('readUInt64LE', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var buffer = new Buffer(f.hex64, 'hex')
        var number = bufferutils.readUInt64LE(buffer, 0)

        assert.equal(number, f.dec)
      })
    })
  })

  describe('readVarInt', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var buffer = new Buffer(f.hexVI, 'hex')
        var d = bufferutils.readVarInt(buffer, 0)

        assert.equal(d.number, f.dec)
        assert.equal(d.size, buffer.length)
      })
    })
  })

  describe('varIntSize', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var size = bufferutils.varIntSize(f.dec)

        assert.equal(size, f.hexVI.length / 2)
      })
    })
  })

  describe('writePushDataInt', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f, i) {
        if (!f.hexPD) return

        var buffer = new Buffer(5)
        buffer.fill(0)

        var n = bufferutils.writePushDataInt(buffer, f.dec, 0)
        assert.equal(buffer.slice(0, n).toString('hex'), f.hexPD)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var buffer = new Buffer(5)
        buffer.fill(0)

        assert.throws(function() {
          bufferutils.writePushDataInt(buffer, f.dec, 0)
        }, /value must be < 2\^53/)
      })
    })
  })

  describe('writeUInt64LE', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var buffer = new Buffer(8)
        buffer.fill(0)

        bufferutils.writeUInt64LE(buffer, f.dec, 0)
        assert.equal(buffer.toString('hex'), f.hex64)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var buffer = new Buffer(8)
        buffer.fill(0)

        assert.throws(function() {
          bufferutils.writeUInt64LE(buffer, f.dec, 0)
        }, /value must be < 2\^53/)
      })
    })
  })

  describe('writeVarInt', function() {
    it('matches test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var buffer = new Buffer(9)
        buffer.fill(0)

        var n = bufferutils.writeVarInt(buffer, f.dec, 0)
        assert.equal(buffer.slice(0, n).toString('hex'), f.hexVI)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var buffer = new Buffer(9)
        buffer.fill(0)

        assert.throws(function() {
          bufferutils.writeVarInt(buffer, f.dec, 0)
        }, /value must be < 2\^53/)
      })
    })
  })
})
