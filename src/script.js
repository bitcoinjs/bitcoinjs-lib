var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var opcodes = require('./opcodes')

function Script(buffer, chunks) {
  assert(Buffer.isBuffer(buffer), 'Expected Buffer, got ' + buffer)
  assert(Array.isArray(chunks), 'Expected Array, got ' + chunks)

  this.buffer = buffer
  this.chunks = chunks
}

// Import operations
Script.fromBuffer = function(buffer) {
  var chunks = []

  var i = 0

  while (i < buffer.length) {
    var opcode = buffer.readUInt8(i)

    if ((opcode > opcodes.OP_0) && (opcode <= opcodes.OP_PUSHDATA4)) {
      var d = bufferutils.readPushDataInt(buffer, i)
      i += d.size

      var data = buffer.slice(i, i + d.number)
      i += d.number

      chunks.push(data)

    } else {
      chunks.push(opcode)

      ++i
    }
  }

  return new Script(buffer, chunks)
}

Script.fromChunks = function(chunks) {
  assert(Array.isArray(chunks), 'Expected Array, got ' + chunks)

  var bufferSize = chunks.reduce(function(accum, chunk) {
    var chunkSize

    if (Buffer.isBuffer(chunk)) {
      chunkSize = bufferutils.pushDataSize(chunk.length) + chunk.length

    } else {
      chunkSize = 1

    }

    return accum + chunkSize
  }, 0.0)

  var buffer = new Buffer(bufferSize)
  var offset = 0

  chunks.forEach(function(chunk) {
    if (Buffer.isBuffer(chunk)) {
      offset += bufferutils.writePushDataInt(buffer, chunk.length, offset)

      chunk.copy(buffer, offset)
      offset += chunk.length

    } else {
      assert(typeof chunk == 'number')

      buffer.writeUInt8(chunk, offset)
      offset += 1
    }
  })

  assert.equal(offset, buffer.length, 'Could not decode chunks')
  return new Script(buffer, chunks)
}

Script.fromHex = function(hex) {
  return Script.fromBuffer(new Buffer(hex, 'hex'))
}

// Constants
Script.EMPTY = Script.fromChunks([])

// Operations
Script.prototype.clone = function() {
  return new Script(this.buffer, this.chunks)
}

Script.prototype.getHash = function() {
  return crypto.hash160(this.buffer)
}

// FIXME: doesn't work for data chunks, maybe time to use buffertools.compare...
Script.prototype.without = function(needle) {
  return Script.fromChunks(this.chunks.filter(function(op) {
    return op !== needle
  }))
}

// Export operations
Script.prototype.toBuffer = function() {
  return this.buffer
}

Script.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

/**
 * Compare the script to known templates of scriptPubKey.
 *
 * This method will compare the script to a small number of standard script
 * templates and return a string naming the detected type.
 *
 * Currently supported are:
 * Pubkeyhash (address)
 *   Paying to a Bitcoin address which is the hash of a pubkey.
 *   OP_DUP OP_HASH160 [pubKeyHash] OP_EQUALVERIFY OP_CHECKSIG
 *
 * Pubkey
 *   Paying to a public key directly.
 *   [pubKey] OP_CHECKSIG
 *
 * Scripthash (P2SH)
 *    Paying to an address which is the hash of a script
 *    OP_HASH160 [Scripthash] OP_EQUAL
 *
 * Multisig
 *    Paying to multiple pubkeys and require a number of the signatures
 *    m [pubkey] [pubkey] [pubkey] n OP_CHECKMULTISIG
 *
 * Nulldata
 *    Provably prune-able outputs
 *    OP_RETURN [data]
 *
 * Nonstandard:
 *   Any other script (no template matched).
 *
 * https://github.com/bitcoin/bitcoin/blob/19e5b9d2dfcac4efadba636745485d9660fb1abe/src/script.cpp#L75
 */

Script.prototype.getOutType = function() {
  if (isPubkeyhash.call(this)) {
    return 'pubkeyhash'
  } else if (isPubkey.call(this)) {
    return 'pubkey'
  } else if (isScripthash.call(this)) {
    return 'scripthash'
  } else if (isMultisig.call(this)) {
    return 'multisig'
  } else if (isNulldata.call(this)) {
    return 'nulldata'
  } else {
    return 'nonstandard'
  }
}

function isPubkeyhash() {
  return this.chunks.length == 5 &&
    this.chunks[0] == opcodes.OP_DUP &&
    this.chunks[1] == opcodes.OP_HASH160 &&
    Buffer.isBuffer(this.chunks[2]) &&
    this.chunks[2].length === 20 &&
    this.chunks[3] == opcodes.OP_EQUALVERIFY &&
    this.chunks[4] == opcodes.OP_CHECKSIG
}

function isPubkey() {
  return this.chunks.length === 2 &&
    Buffer.isBuffer(this.chunks[0]) &&
    this.chunks[1] === opcodes.OP_CHECKSIG
}

function isScripthash() {
  return this.chunks[this.chunks.length - 1] == opcodes.OP_EQUAL &&
    this.chunks[0] == opcodes.OP_HASH160 &&
    Buffer.isBuffer(this.chunks[1]) &&
    this.chunks[1].length === 20 &&
    this.chunks.length == 3
}

function isMultisig() {
  return this.chunks.length > 3 &&
    // m is a smallint
    isSmallIntOp(this.chunks[0]) &&
    // n is a smallint
    isSmallIntOp(this.chunks[this.chunks.length - 2]) &&
    // n greater or equal to m
    this.chunks[0] <= this.chunks[this.chunks.length - 2] &&
    // n cannot be 0
    this.chunks[this.chunks.length - 2] !== opcodes.OP_0 &&
    // n is the size of chunk length minus 3 (m, n, OP_CHECKMULTISIG)
    this.chunks.length - 3 === this.chunks[this.chunks.length - 2] - opcodes.OP_RESERVED &&
    // last chunk is OP_CHECKMULTISIG
    this.chunks[this.chunks.length - 1] == opcodes.OP_CHECKMULTISIG
}

function isNulldata() {
  return this.chunks[0] === opcodes.OP_RETURN
}

function isSmallIntOp(opcode) {
  return ((opcode == opcodes.OP_0) ||
    ((opcode >= opcodes.OP_1) && (opcode <= opcodes.OP_16)))
}

/**
 * Compare the script to known templates of scriptSig.
 *
 * This method will compare the script to a small number of standard script
 * templates and return a string naming the detected type.
 *
 * WARNING: Use this method with caution. It merely represents a heuristic
 * based on common transaction formats. A non-standard transaction could
 * very easily match one of these templates by accident.
 *
 * Currently supported are:
 * Address:
 *   Paying to a Bitcoin address which is the hash of a pubkey.
 *   [sig] [pubKey]
 *
 * Pubkey:
 *   Paying to a public key directly.
 *   [sig]
 *
 * Multisig:
 *   Paying to M-of-N public keys.
 *
 * Nonstandard:
 *   Any other script (no template matched).
 */
Script.prototype.getInType = function() {
  if (this.chunks.length == 1 &&
    Buffer.isBuffer(this.chunks[0])) {
    // Direct IP to IP transactions only have the signature in their scriptSig.
    // TODO: We could also check that the length of the data is correct.
    return 'pubkey'
  } else if (this.chunks.length == 2 &&
    Buffer.isBuffer(this.chunks[0]) &&
    Buffer.isBuffer(this.chunks[1])) {
    return 'pubkeyhash'
  } else if (this.chunks[0] == opcodes.OP_0 &&
    this.chunks.slice(1).reduce(function(t, chunk, i) {
      return t && Buffer.isBuffer(chunk) && (chunk[0] == 48 || i == this.chunks.length - 1)
    }, true)) {
    return 'multisig'
  } else {
    return 'nonstandard'
  }
}

// {pubKey} OP_CHECKSIG
Script.createPubKeyScriptPubKey = function(pubKey) {
  return Script.fromChunks([
    pubKey.toBuffer(),
    opcodes.OP_CHECKSIG
  ])
}

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG
Script.createPubKeyHashScriptPubKey = function(hash) {
  assert(Buffer.isBuffer(hash), 'Expected Buffer, got ' + hash)

  return Script.fromChunks([
    opcodes.OP_DUP,
    opcodes.OP_HASH160,
    hash,
    opcodes.OP_EQUALVERIFY,
    opcodes.OP_CHECKSIG
  ])
}

// OP_HASH160 {scriptHash} OP_EQUAL
Script.createP2SHScriptPubKey = function(hash) {
  assert(Buffer.isBuffer(hash), 'Expected Buffer, got ' + hash)

  return Script.fromChunks([
    opcodes.OP_HASH160,
    hash,
    opcodes.OP_EQUAL
  ])
}

// m [pubKeys ...] n OP_CHECKMULTISIG
Script.createMultisigScriptPubKey = function(m, pubKeys) {
  assert(Array.isArray(pubKeys), 'Expected Array, got ' + pubKeys)
  assert(pubKeys.length >= m, 'Not enough pubKeys provided')

  var pubKeyBuffers = pubKeys.map(function(pubKey) {
    return pubKey.toBuffer()
  })
  var n = pubKeys.length

  return Script.fromChunks([].concat(
    (opcodes.OP_1 - 1) + m,
    pubKeyBuffers,
    (opcodes.OP_1 - 1) + n,
    opcodes.OP_CHECKMULTISIG
  ))
}

// {signature}
Script.createPubKeyScriptSig = function(signature) {
  assert(Buffer.isBuffer(signature), 'Expected Buffer, got ' + signature)

  return Script.fromChunks(signature)
}

// {signature} {pubKey}
Script.createPubKeyHashScriptSig = function(signature, pubKey) {
  assert(Buffer.isBuffer(signature), 'Expected Buffer, got ' + signature)

  return Script.fromChunks([signature, pubKey.toBuffer()])
}

// <scriptSig> {serialized scriptPubKey script}
Script.createP2SHScriptSig = function(scriptSig, scriptPubKey) {
  return Script.fromChunks([].concat(
    scriptSig.chunks,
    scriptPubKey.toBuffer()
  ))
}

// OP_0 [signatures ...]
Script.createMultisigScriptSig = function(signatures, scriptPubKey) {
  if (scriptPubKey) {
    assert(isMultisig.call(scriptPubKey))

    var m = scriptPubKey.chunks[0]
    var k = m - (opcodes.OP_1 - 1)
    assert(k <= signatures.length, 'Not enough signatures provided')
  }

  return Script.fromChunks([].concat(opcodes.OP_0, signatures))
}

module.exports = Script
