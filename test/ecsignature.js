var assert = require('assert')

var BigInteger = require('bigi')
var ECSignature = require('../src/ecsignature')

var fixtures = require('./fixtures/ecsignature.json')

describe('ECSignature', function() {
  describe('toCompact', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.compact.hex + ' correctly', function() {
        var signature = new ECSignature(
          new BigInteger(f.signature.r),
          new BigInteger(f.signature.s)
        )

        var buffer = signature.toCompact(f.compact.i, f.compact.compressed)
        assert.equal(buffer.toString('hex'), f.compact.hex)
      })
    })
  })

  describe('parseCompact', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.compact.hex + ' correctly', function() {
        var buffer = new Buffer(f.compact.hex, 'hex')
        var parsed = ECSignature.parseCompact(buffer)

        assert.equal(parsed.compressed, f.compact.compressed)
        assert.equal(parsed.i, f.compact.i)
        assert.equal(parsed.signature.r.toString(), f.signature.r)
        assert.equal(parsed.signature.s.toString(), f.signature.s)
      })
    })

    fixtures.invalid.compact.forEach(function(f) {
      it('throws on ' + f.hex, function() {
        var buffer = new Buffer(f.hex, 'hex')

        assert.throws(function() {
          ECSignature.parseCompact(buffer)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toDER', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.DER + ' correctly', function() {
        var signature = new ECSignature(
          new BigInteger(f.signature.r),
          new BigInteger(f.signature.s)
        )

        var DER = signature.toDER()
        assert.equal(DER.toString('hex'), f.DER)
      })
    })
  })

  describe('fromDER', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.DER + ' correctly', function() {
        var buffer = new Buffer(f.DER, 'hex')
        var signature = ECSignature.fromDER(buffer)

        assert.equal(signature.r.toString(), f.signature.r)
        assert.equal(signature.s.toString(), f.signature.s)
      })
    })

    fixtures.invalid.DER.forEach(function(f) {
      it('throws on ' + f.hex, function() {
        var buffer = new Buffer(f.hex, 'hex')

        assert.throws(function() {
          ECSignature.fromDER(buffer)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toScriptSignature', function() {
    fixtures.valid.forEach(function(f) {
      it('exports ' + f.scriptSignature.hex + ' correctly', function() {
        var signature = new ECSignature(
          new BigInteger(f.signature.r),
          new BigInteger(f.signature.s)
        )

        var scriptSignature = signature.toScriptSignature(f.scriptSignature.hashType)
        assert.equal(scriptSignature.toString('hex'), f.scriptSignature.hex)
      })
    })
  })

  describe('parseScriptSignature', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.scriptSignature.hex + ' correctly', function() {
        var buffer = new Buffer(f.scriptSignature.hex, 'hex')
        var parsed = ECSignature.parseScriptSignature(buffer)

        assert.equal(parsed.signature.r.toString(), f.signature.r)
        assert.equal(parsed.signature.s.toString(), f.signature.s)
        assert.equal(parsed.hashType, f.scriptSignature.hashType)
      })
    })

    fixtures.invalid.DER.forEach(function(f) {
      it('throws on ' + f.hex, function() {
        var buffer = new Buffer(f.hex + '01', 'hex')

        assert.throws(function() {
          ECSignature.parseScriptSignature(buffer)
        }, new RegExp(f.exception))
      })
    })
  })
})
