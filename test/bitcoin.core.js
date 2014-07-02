var assert = require('assert')
var base58 = require('bs58')
var base58check = require('bs58check')
var networks = require('../src/networks')

var Address = require('../src/address')
var BigInteger = require('bigi')
var ECKey = require('../src/eckey')
var ECSignature = require('../src/ecsignature')
var Transaction = require('../src/transaction')
var Script = require('../src/script')

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
        var actual = buffer.toString('hex')

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
  describe('Address', function() {
    base58_keys_valid.forEach(function(f) {
      var string = f[0]
      var hex = f[1]
      var params = f[2]
      var network = networks.bitcoin

      if (params.isPrivkey) return
      if (params.isTestnet) network = networks.testnet

      it('can import ' + string, function() {
        var address = Address.fromBase58Check(string)

        assert.equal(address.hash.toString('hex'), hex)
        if (params.addrType === 'pubkey') {
          assert.equal(address.version, network.pubKeyHash)

        } else if (params.addrType === 'script') {
          assert.equal(address.version, network.scriptHash)
        }
      })
    })
  })

  // base58_keys_invalid
  describe('Address', function() {
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
          var address = Address.fromBase58Check(string)

          assert.notEqual(allowedNetworks.indexOf(address.version), -1, 'Invalid network')
        }, /Invalid (checksum|hash length|network)/)
      })
    })
  })

  // base58_keys_valid
  describe('ECKey', function() {
    base58_keys_valid.forEach(function(f) {
      var string = f[0]
      var hex = f[1]
      var params = f[2]
      var network = networks.bitcoin

      if (!params.isPrivkey) return
      if (params.isTestnet) network = networks.testnet

      it('imports ' + string + ' correctly', function() {
        var privKey = ECKey.fromWIF(string)

        assert.equal(privKey.d.toHex(), hex)
        assert.equal(privKey.pub.compressed, params.isCompressed)
      })
    })
  })

  // base58_keys_invalid
  describe('ECKey', function() {
    var allowedNetworks = [
      networks.bitcoin.wif,
      networks.testnet.wif
    ]

    base58_keys_invalid.forEach(function(f) {
      var string = f[0]

      it('throws on ' + string, function() {
        assert.throws(function() {
          var privKey = ECKey.fromWIF(string)
          var version = base58check.decode(string).version

          assert.notEqual(allowedNetworks.indexOf(version), -1, 'Invalid network')
        }, /Invalid (checksum|compression flag|network|WIF payload)/)
      })
    })
  })

  // tx_valid
  describe('Transaction', function() {
    tx_valid.forEach(function(f) {
      // Objects that are only a single string are ignored
      if (f.length === 1) return

      var inputs = f[0]
      var fhex = f[1]
  //      var verifyFlags = f[2] // TODO: do we need to test this?

      it('can decode ' + fhex, function() {
        var transaction = Transaction.fromHex(fhex)

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
  describe('Transaction', function() {
    sighash.forEach(function(f) {
      // Objects that are only a single string are ignored
      if (f.length === 1) return

      var txHex = f[0]
      var scriptHex = f[1]
      var inIndex = f[2]
      var hashType = f[3]
      var expectedHash = f[4]

      it('should hash ' + txHex + ' correctly', function() {
        var transaction = Transaction.fromHex(txHex)
        assert.equal(transaction.toHex(), txHex)

        var script = Script.fromHex(scriptHex)
        assert.equal(script.toHex(), scriptHex)

        var actualHash
        try {
          actualHash = transaction.hashForSignature(script, inIndex, hashType)
        } catch (e) {
          // don't fail if we don't support it yet, TODO
          if (!e.message.match(/not yet supported/)) throw e
        }

        if (actualHash != undefined) {
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
