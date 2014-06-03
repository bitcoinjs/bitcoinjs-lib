var assert = require('assert')
var bufferutils = require('../src/bufferutils')

var fixtures = require('./fixtures/bufferutils.json')

describe('bufferutils', function() {
  describe('pushDataSize', function() {
    fixtures.valid.forEach(function(f) {
      it('determines the pushDataSize of ' + f.dec + ' correctly', function() {
        if (!f.hexPD) return

        var size = bufferutils.pushDataSize(f.dec)

        assert.equal(size, f.hexPD.length / 2)
      })
    })
  })

  describe('readPushDataInt', function() {
    fixtures.valid.forEach(function(f) {
      if (!f.hexPD) return

      it('decodes ' + f.hexPD + ' correctly', function() {
        var buffer = new Buffer(f.hexPD, 'hex')
        var d = bufferutils.readPushDataInt(buffer, 0)
        var fopcode = parseInt(f.hexPD.substr(0, 2), 16)

        assert.equal(d.opcode, fopcode)
        assert.equal(d.number, f.dec)
        assert.equal(d.size, buffer.length)
      })
    })
  })

  describe('readUInt64LE', function() {
    fixtures.valid.forEach(function(f) {
      it('decodes ' + f.hex64 + ' correctly', function() {
        var buffer = new Buffer(f.hex64, 'hex')
        var number = bufferutils.readUInt64LE(buffer, 0)

        assert.equal(number, f.dec)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var buffer = new Buffer(f.hex64, 'hex')

        assert.throws(function() {
          bufferutils.readUInt64LE(buffer, 0)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('readVarInt', function() {
    fixtures.valid.forEach(function(f) {
      it('decodes ' + f.hexVI + ' correctly', function() {
        var buffer = new Buffer(f.hexVI, 'hex')
        var d = bufferutils.readVarInt(buffer, 0)

        assert.equal(d.number, f.dec)
        assert.equal(d.size, buffer.length)
      })
    })

    fixtures.invalid.forEach(function(f) {
      it('throws on ' + f.description, function() {
        var buffer = new Buffer(f.hexVI, 'hex')

        assert.throws(function() {
          bufferutils.readVarInt(buffer, 0)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('varIntSize', function() {
    fixtures.valid.forEach(function(f) {
      it('determines the varIntSize of ' + f.dec + ' correctly', function() {
        var size = bufferutils.varIntSize(f.dec)

        assert.equal(size, f.hexVI.length / 2)
      })
    })
  })

  describe('writePushDataInt', function() {
    fixtures.valid.forEach(function(f, i) {
      if (!f.hexPD) return

      it('encodes ' + f.dec + ' correctly', function() {
        var buffer = new Buffer(5)
        buffer.fill(0)

        var n = bufferutils.writePushDataInt(buffer, f.dec, 0)
        assert.equal(buffer.slice(0, n).toString('hex'), f.hexPD)
      })
    })
  })

  describe('writeUInt64LE', function() {
    fixtures.valid.forEach(function(f) {
      it('encodes ' + f.dec + ' correctly', function() {
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
        }, new RegExp(f.exception))
      })
    })
  })

  describe('writeVarInt', function() {
    fixtures.valid.forEach(function(f) {
      it('encodes ' + f.dec + ' correctly', function() {
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
        }, new RegExp(f.exception))
      })
    })
  })
})
