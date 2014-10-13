var assert = require('assert')

var base58 = require('bs58')
var base58check = require('bs58check')

var Bitcoin = require('../')
var networks = Bitcoin.networks
var ECPair = Bitcoin.ECPair
var ECSignature = Bitcoin.ECSignature
var RawTransaction = Bitcoin.RawTransaction
var Script = Bitcoin.Script

var base58_encode_decode = require("./fixtures/core/base58_encode_decode.json")
var base58_keys_invalid = require("./fixtures/core/base58_keys_invalid.json")
var base58_keys_valid = require("./fixtures/core/base58_keys_valid.json")
var sig_canonical = require("./fixtures/core/sig_canonical.json")
var sig_noncanonical = require("./fixtures/core/sig_noncanonical.json")
var sighash = require("./fixtures/core/sighash.json")
var tx_valid = require("./fixtures/core/tx_valid.json")

describe('Bitcoin-core', function() {
  // base58_encode_decode
  describe('base58', function() {
    base58_encode_decode.forEach(function(f) {
      var fhex = f[0]
      var fb58 = f[1]

      it('can decode ' + fb58, function() {
        var buffer = base58.decode(fb58)
        var actual = new Buffer(buffer).toString('hex')

        assert.equal(actual, fhex)
      })

      it('can encode ' + fhex, function() {
        var buffer = new Buffer(fhex, 'hex')
        var actual = base58.encode(buffer)

        assert.equal(actual, fb58)
      })
    })
  })

  // base58_keys_valid
  describe('bs58check', function() {
    base58_keys_valid.forEach(function(f) {
      var string = f[0]
      var hex = f[1]
      var params = f[2]

      if (params.isPrivkey) return

      it('can decode ' + string, function() {
        var payload = base58check.decode(string)
        var hash = payload.slice(1)

        assert.equal(hash.toString('hex'), hex)
      })
    })
  })

  // base58_keys_invalid
  describe('bs58check', function() {
    var allowedNetworks = [
      networks.bitcoin.pubkeyhash,
      networks.bitcoin.scripthash,
      networks.testnet.pubkeyhash,
      networks.testnet.scripthash
    ]

    base58_keys_invalid.forEach(function(f) {
      var string = f[0]

      it('throws on ' + string, function() {
        assert.throws(function() {
          var payload = base58check.decode(string)
          var version = payload[0]
          var hash = payload.slice(1)

          assert.equal(hash.length, 20, 'Invalid hash length')
          assert.notEqual(allowedNetworks.indexOf(version), -1, 'Invalid network')
        }, /Invalid (checksum|hash length|network)/)
      })
    })
  })

  // base58_keys_valid
  describe('ECPair', function() {
    base58_keys_valid.forEach(function(f) {
      var string = f[0]
      var hex = f[1]
      var params = f[2]
      var network = networks.bitcoin

      if (!params.isPrivkey) return
      if (params.isTestnet) network = networks.testnet

      it('imports ' + string + ' correctly', function() {
        var keyPair = ECPair.fromWIF(string)

        assert.equal(keyPair.d.toHex(), hex)
        assert.equal(keyPair.compressed, params.isCompressed)
      })
    })
  })

  // base58_keys_invalid
  describe('ECPair', function() {
    var allowedNetworks = [
      networks.bitcoin,
      networks.testnet
    ]

    base58_keys_invalid.forEach(function(f) {
      var string = f[0]

      it('throws on ' + string, function() {
        assert.throws(function() {
          var keyPair = ECPair.fromWIF(string)

          assert(allowedNetworks.indexOf(keyPair.network) > -1, 'Invalid network')
        }, /(Invalid|Unknown) (checksum|compression flag|network|WIF payload)/)
      })
    })
  })

  // tx_valid
  describe('RawTransaction', function() {
    tx_valid.forEach(function(f) {
      // Objects that are only a single string are ignored
      if (f.length === 1) return

      var inputs = f[0]
      var fhex = f[1]
  //      var verifyFlags = f[2] // TODO: do we need to test this?

      it('can decode ' + fhex, function() {
        var transaction = RawTransaction.fromHex(fhex)

        transaction.ins.forEach(function(txin, i) {
          var input = inputs[i]
          var prevOutHash = input[0]
          var prevOutIndex = input[1]
  //          var prevOutScriptPubKey = input[2] // TODO: we don't have a ASM parser

          var actualHash = txin.hash

          // Test data is big-endian
          Array.prototype.reverse.call(actualHash)

          assert.equal(actualHash.toString('hex'), prevOutHash)

          // we read UInt32, not Int32
          assert.equal(txin.index & 0xffffffff, prevOutIndex)
        })
      })
    })
  })

  // sighash
  describe('RawTransaction', function() {
    sighash.forEach(function(f) {
      // Objects that are only a single string are ignored
      if (f.length === 1) return

      var txHex = f[0]
      var scriptHex = f[1]
      var inIndex = f[2]
      var hashType = f[3]
      var expectedHash = f[4]

      it('should hash ' + txHex + ' correctly', function() {
        var transaction = RawTransaction.fromHex(txHex)
        assert.equal(transaction.toHex(), txHex)

        var script = Script.fromHex(scriptHex)
        assert.equal(script.toHex(), scriptHex)

        var actualHash
        try {
          actualHash = transaction.hashForSignature(inIndex, script, hashType)
        } catch (e) {
          // don't fail if we don't support it yet, TODO
          if (!e.message.match(/not yet supported/)) throw e
        }

        if (actualHash !== undefined) {
          // Test data is big-endian
          Array.prototype.reverse.call(actualHash)

          assert.equal(actualHash.toString('hex'), expectedHash)
        }
      })
    })
  })

  describe('ECSignature', function() {
    sig_canonical.forEach(function(hex) {
      var buffer = new Buffer(hex, 'hex')

      it('can parse ' + hex, function() {
        var parsed = ECSignature.parseScriptSignature(buffer)
        var actual = parsed.signature.toScriptSignature(parsed.hashType)
        assert.equal(actual.toString('hex'), hex)
      })
    })

    sig_noncanonical.forEach(function(hex, i) {
      if (i === 0) return
      if (i % 2 !== 0) return

      var description = sig_noncanonical[i - 1].slice(0, -1)
      if (description === 'too long') return // we support non secp256k1 signatures

      var buffer = new Buffer(hex, 'hex')

      it('throws on ' + description, function() {
        assert.throws(function() {
          ECSignature.parseScriptSignature(buffer)
        })
      })
    })
  })
})
