/* global describe, it */

var assert = require('assert')
var base58 = require('bs58')

var Bitcoin = require('../')
var Address = Bitcoin.Address
var Block = Bitcoin.Block
var ECPair = Bitcoin.ECPair
var ECSignature = Bitcoin.ECSignature
var Transaction = Bitcoin.Transaction
var Script = Bitcoin.Script

var bufferutils = Bitcoin.bufferutils
var networks = Bitcoin.networks

var base58_encode_decode = require('./fixtures/core/base58_encode_decode.json')
var base58_keys_invalid = require('./fixtures/core/base58_keys_invalid.json')
var base58_keys_valid = require('./fixtures/core/base58_keys_valid.json')
var blocks_valid = require('./fixtures/core/blocks.json')
var sig_canonical = require('./fixtures/core/sig_canonical.json')
var sig_noncanonical = require('./fixtures/core/sig_noncanonical.json')
var sighash = require('./fixtures/core/sighash.json')
var tx_valid = require('./fixtures/core/tx_valid.json')

describe('Bitcoin-core', function () {
  // base58_encode_decode
  describe('base58', function () {
    base58_encode_decode.forEach(function (f) {
      var fhex = f[0]
      var fb58 = f[1]

      it('can decode ' + fb58, function () {
        var buffer = base58.decode(fb58)
        var actual = new Buffer(buffer).toString('hex')

        assert.strictEqual(actual, fhex)
      })

      it('can encode ' + fhex, function () {
        var buffer = new Buffer(fhex, 'hex')
        var actual = base58.encode(buffer)

        assert.strictEqual(actual, fb58)
      })
    })
  })

  // base58_keys_valid
  describe('Address.formBase58Check', function () {
    var typeMap = {
      'pubkey': 'pubKeyHash',
      'script': 'scriptHash'
    }

    base58_keys_valid.forEach(function (f) {
      var string = f[0]
      var hex = f[1]
      var params = f[2]
      var network = networks.bitcoin

      if (params.isPrivkey) return
      if (params.isTestnet) {
        network = networks.testnet
      }

      it('can import ' + string, function () {
        var address = Address.fromBase58Check(string)

        assert.strictEqual(address.hash.toString('hex'), hex)
        assert.strictEqual(address.version, network[typeMap[params.addrType]])
      })
    })
  })

  // base58_keys_invalid
  describe('Address.fromBase58Check', function () {
    var allowedNetworks = [
      networks.bitcoin.pubkeyhash,
      networks.bitcoin.scripthash,
      networks.testnet.pubkeyhash,
      networks.testnet.scripthash
    ]

    base58_keys_invalid.forEach(function (f) {
      var string = f[0]

      it('throws on ' + string, function () {
        assert.throws(function () {
          var address = Address.fromBase58Check(string)

          assert.notEqual(allowedNetworks.indexOf(address.version), -1, 'Invalid network')
        }, /Invalid (checksum|hash length|network)/)
      })
    })
  })

  // base58_keys_valid
  describe('ECPair', function () {
    base58_keys_valid.forEach(function (f) {
      var string = f[0]
      var hex = f[1]
      var params = f[2]

      if (!params.isPrivkey) return
      var keyPair = ECPair.fromWIF(string)

      it('fromWIF imports ' + string, function () {
        assert.strictEqual(keyPair.d.toHex(), hex)
        assert.strictEqual(keyPair.compressed, params.isCompressed)
      })

      it('toWIF exports ' + hex + ' to ' + string, function () {
        assert.strictEqual(keyPair.toWIF(), string)
      })
    })
  })

  // base58_keys_invalid
  describe('ECPair.fromWIF', function () {
    var allowedNetworks = [
      networks.bitcoin,
      networks.testnet
    ]

    base58_keys_invalid.forEach(function (f) {
      var string = f[0]

      it('throws on ' + string, function () {
        assert.throws(function () {
          var keyPair = ECPair.fromWIF(string)

          assert(allowedNetworks.indexOf(keyPair.network) > -1, 'Invalid network')
        }, /(Invalid|Unknown) (checksum|compression flag|network|WIF payload)/)
      })
    })
  })

  describe('Block.fromHex', function () {
    blocks_valid.forEach(function (f) {
      it('can parse ' + f.id, function () {
        var block = Block.fromHex(f.hex)

        assert.strictEqual(block.getId(), f.id)
        assert.strictEqual(block.transactions.length, f.transactions)
      })
    })
  })

  // tx_valid
  describe('Transaction.fromHex', function () {
    tx_valid.forEach(function (f) {
      // Objects that are only a single string are ignored
      if (f.length === 1) return

      var inputs = f[0]
      var fhex = f[1]
      //      var verifyFlags = f[2] // TODO: do we need to test this?

      it('can decode ' + fhex, function () {
        var transaction = Transaction.fromHex(fhex)

        transaction.ins.forEach(function (txIn, i) {
          var input = inputs[i]

          // reverse because test data is big-endian
          var prevOutHash = bufferutils.reverse(new Buffer(input[0], 'hex'))
          var prevOutIndex = input[1]

          assert.deepEqual(txIn.hash, prevOutHash)

          // we read UInt32, not Int32
          assert.strictEqual(txIn.index & 0xffffffff, prevOutIndex)
        })
      })
    })
  })

  describe('Script.fromASM', function () {
    tx_valid.forEach(function (f) {
      // Objects that are only a single string are ignored
      if (f.length === 1) return

      var inputs = f[0]

      inputs.forEach(function (input) {
        var prevOutScriptPubKey = input[2]
        .replace(/(^| )([0-9])( |$)/g, 'OP_$2 ')
        .replace(/0x[a-f0-9]+ 0x([a-f0-9]+)/, '$1')
        .replace(/DUP/g, 'OP_DUP')
        .replace(/NOT/g, 'OP_NOT')
        .replace(/HASH160/g, 'OP_HASH160')
        .replace(/EQUALVERIFY/g, 'OP_EQUALVERIFY')
        .replace(/EQUAL( |$)/g, 'OP_EQUAL ')
        .replace(/CHECKSIG/g, 'OP_CHECKSIG')
        .replace(/ CHECKMULTISIG/g, ' OP_CHECKMULTISIG')
        .replace(/CODESEPARATOR/g, 'OP_CODESEPARATOR')
        .replace(/CHECKSIGVERIFY/g, 'OP_CHECKSIGVERIFY')

        it('can parse ' + prevOutScriptPubKey, function () {
          // TODO: we can probably do better validation than this
          Script.fromASM(prevOutScriptPubKey)
        })
      })
    })
  })

  // sighash
  describe('Transaction', function () {
    sighash.forEach(function (f) {
      // Objects that are only a single string are ignored
      if (f.length === 1) return

      var txHex = f[0]
      var scriptHex = f[1]
      var inIndex = f[2]
      var hashType = f[3]

      // reverse because test data is big-endian
      var expectedHash = bufferutils.reverse(new Buffer(f[4], 'hex'))

      var hashTypes = []
      if ((hashType & 0x1f) === Transaction.SIGHASH_NONE) hashTypes.push('SIGHASH_NONE')
      else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE) hashTypes.push('SIGHASH_SINGLE')
      else hashTypes.push('SIGHASH_ALL')
      if (hashType & Transaction.SIGHASH_ANYONECANPAY) hashTypes.push('SIGHASH_ANYONECANPAY')

      var hashTypeName = hashTypes.join(' | ')

      it('should hash ' + txHex.slice(0, 40) + '... (' + hashTypeName + ')', function () {
        var transaction = Transaction.fromHex(txHex)
        assert.strictEqual(transaction.toHex(), txHex)

        var script = Script.fromHex(scriptHex)
        assert.strictEqual(script.toHex(), scriptHex)

        var hash = transaction.hashForSignature(inIndex, script, hashType)
        assert.deepEqual(hash, expectedHash)
      })
    })
  })

  describe('ECSignature.parseScriptSignature', function () {
    sig_canonical.forEach(function (hex) {
      var buffer = new Buffer(hex, 'hex')

      it('can parse ' + hex, function () {
        var parsed = ECSignature.parseScriptSignature(buffer)
        var actual = parsed.signature.toScriptSignature(parsed.hashType)
        assert.strictEqual(actual.toString('hex'), hex)
      })
    })

    sig_noncanonical.forEach(function (hex, i) {
      if (i === 0) return
      if (i % 2 !== 0) return

      var description = sig_noncanonical[i - 1].slice(0, -1)
      if (description === 'too long') return // we support non secp256k1 signatures

      var buffer = new Buffer(hex, 'hex')

      it('throws on ' + description, function () {
        assert.throws(function () {
          ECSignature.parseScriptSignature(buffer)
        })
      })
    })
  })
})
