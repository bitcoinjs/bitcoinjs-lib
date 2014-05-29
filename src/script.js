var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var opcodes = require('./opcodes')

function Script(data) {
  data = data || []
  assert(Array.isArray(data), 'Expected Array, got ' + data)

  this.buffer = data
  this.parse()
}

// Import operations
Script.fromBuffer = function(buffer) {
  assert(Buffer.isBuffer(buffer)) // FIXME: transitionary

  return new Script(Array.prototype.slice.call(buffer))
}

Script.fromHex = function(hex) {
  return Script.fromBuffer(new Buffer(hex, 'hex'))
}

// Export operations
Script.prototype.toBuffer = function() {
  return new Buffer(this.buffer)
}

Script.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

/**
 * Update the parsed script representation.
 *
 * Each Script object stores the script in two formats. First as a raw byte
 * array and second as an array of 'chunks', such as opcodes and pieces of
 * data.
 *
 * This method updates the chunks cache. Normally this is called by the
 * constructor and you don't need to worry about it. However, if you change
 * the script buffer manually, you should update the chunks using this method.
 */
Script.prototype.parse = function() {
  var self = this

  this.chunks = []

  // Cursor
  var i = 0

  // Read n bytes and store result as a chunk
  function readChunk(n) {
    self.chunks.push(self.buffer.slice(i, i + n))
    i += n
  }

  while (i < this.buffer.length) {
    var opcode = this.buffer[i++]
    if (opcode >= 0xF0) {
      // Two byte opcode
      opcode = (opcode << 8) | this.buffer[i++]
    }

    var len
    if (opcode > 0 && opcode < opcodes.OP_PUSHDATA1) {
      // Read some bytes of data, opcode value is the length of data
      readChunk(opcode)
    } else if (opcode == opcodes.OP_PUSHDATA1) {
      len = this.buffer[i++]
      readChunk(len)
    } else if (opcode == opcodes.OP_PUSHDATA2) {
      len = (this.buffer[i++] << 8) | this.buffer[i++]
      readChunk(len)
    } else if (opcode == opcodes.OP_PUSHDATA4) {
      len = (this.buffer[i++] << 24) |
        (this.buffer[i++] << 16) |
        (this.buffer[i++] << 8) |
        this.buffer[i++]
      readChunk(len)
    } else {
      this.chunks.push(opcode)
    }
  }
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
    Array.isArray(this.chunks[2]) &&
    this.chunks[2].length === 20 &&
    this.chunks[3] == opcodes.OP_EQUALVERIFY &&
    this.chunks[4] == opcodes.OP_CHECKSIG
}

function isPubkey() {
  return this.chunks.length === 2 &&
    Array.isArray(this.chunks[0]) &&
    this.chunks[1] === opcodes.OP_CHECKSIG
}

function isScripthash() {
  return this.chunks[this.chunks.length - 1] == opcodes.OP_EQUAL &&
    this.chunks[0] == opcodes.OP_HASH160 &&
    Array.isArray(this.chunks[1]) &&
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

Script.prototype.getHash = function() {
  return crypto.hash160(new Buffer(this.buffer))
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
    Array.isArray(this.chunks[0])) {
    // Direct IP to IP transactions only have the signature in their scriptSig.
    // TODO: We could also check that the length of the data is correct.
    return 'pubkey'
  } else if (this.chunks.length == 2 &&
    Array.isArray(this.chunks[0]) &&
    Array.isArray(this.chunks[1])) {
    return 'pubkeyhash'
  } else if (this.chunks[0] == opcodes.OP_0 &&
    this.chunks.slice(1).reduce(function(t, chunk, i) {
      return t && Array.isArray(chunk) && (chunk[0] == 48 || i == this.chunks.length - 1)
    }, true)) {
    return 'multisig'
  } else {
    return 'nonstandard'
  }
}

/**
 * Add an op code to the script.
 */
Script.prototype.writeOp = function(opcode) {
  this.buffer.push(opcode)
  this.chunks.push(opcode)
}

/**
 * Add a data chunk to the script.
 */
Script.prototype.writeBytes = function(data) {
  // FIXME: Script module doesn't support buffers yet
  if (Buffer.isBuffer(data)) data = Array.prototype.slice.call(data);
  assert(Array.isArray(data), 'Expected a byte array, got ' + data)

  if (data.length < opcodes.OP_PUSHDATA1) {
    this.buffer.push(data.length)
  } else if (data.length <= 0xff) {
    this.buffer.push(opcodes.OP_PUSHDATA1)
    this.buffer.push(data.length)
  } else if (data.length <= 0xffff) {
    this.buffer.push(opcodes.OP_PUSHDATA2)
    this.buffer.push(data.length & 0xff)
    this.buffer.push((data.length >>> 8) & 0xff)
  } else {
    this.buffer.push(opcodes.OP_PUSHDATA4)
    this.buffer.push(data.length & 0xff)
    this.buffer.push((data.length >>> 8) & 0xff)
    this.buffer.push((data.length >>> 16) & 0xff)
    this.buffer.push((data.length >>> 24) & 0xff)
  }
  this.buffer = this.buffer.concat(data)
  this.chunks.push(data)
}

// {pubKey} OP_CHECKSIG
Script.createPubKeyScriptPubKey = function(pubKey) {
  var script = new Script()

  script.writeBytes(pubKey.toBuffer())
  script.writeOp(opcodes.OP_CHECKSIG)

  return script
}

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG
Script.createPubKeyHashScriptPubKey = function(hash) {
  var script = new Script()

  script.writeOp(opcodes.OP_DUP)
  script.writeOp(opcodes.OP_HASH160)
  script.writeBytes(hash)
  script.writeOp(opcodes.OP_EQUALVERIFY)
  script.writeOp(opcodes.OP_CHECKSIG)

  return script
}

// OP_HASH160 {scriptHash} OP_EQUAL
Script.createP2SHScriptPubKey = function(hash) {
  var script = new Script()

  script.writeOp(opcodes.OP_HASH160)
  script.writeBytes(hash)
  script.writeOp(opcodes.OP_EQUAL)

  return script
}

// m [pubKeys ...] n OP_CHECKMULTISIG
Script.createMultisigScriptPubKey = function(m, pubKeys) {
  assert(Array.isArray(pubKeys), 'Expected Array, got ' + pubKeys)
  assert(pubKeys.length >= m, 'Not enough pubKeys provided')
  var script = new Script()
  var n = pubKeys.length

  script.writeOp((opcodes.OP_1 - 1) + m)

  pubKeys.forEach(function(pubKey) {
    script.writeBytes(pubKey.toBuffer())
  })

  script.writeOp((opcodes.OP_1 - 1) + n)
  script.writeOp(opcodes.OP_CHECKMULTISIG)

  return script
}

// {signature}
Script.createPubKeyScriptSig = function(signature) {
  var script = new Script()
  script.writeBytes(signature)
  return script
}

// {signature} {pubKey}
Script.createPubKeyHashScriptSig = function(signature, pubKey) {
  var script = new Script()
  script.writeBytes(signature)
  script.writeBytes(pubKey.toBuffer())
  return script
}

// <scriptSig> {serialized scriptPubKey script}
Script.createP2SHScriptSig = function(scriptSig, scriptPubKey) {
  var inScript = new Script(scriptSig.buffer)
  inScript.writeBytes(scriptPubKey.buffer)
  return inScript
}

// OP_0 [signatures ...]
Script.createMultisigScriptSig = function(signatures, scriptPubKey) {
  if (scriptPubKey) {
    assert(isMultisig.call(scriptPubKey))

    var m = scriptPubKey.chunks[0]
    var k = m - (opcodes.OP_1 - 1)
    assert(k <= signatures.length, 'Not enough signatures provided')
  }

  var inScript = new Script()

  inScript.writeOp(opcodes.OP_0)
  signatures.map(function(sig) {
    inScript.writeBytes(sig)
  })

  return inScript
}

Script.prototype.clone = function() {
  return new Script(this.buffer)
}

Script.fromChunks = function(chunks) {
  assert(Array.isArray(chunks), 'Expected Array, got ' + chunks)

  var bufferSize = chunks.reduce(function(accum, chunk) {
    var chunkSize = 1

    // FIXME: transitionary
    if (Array.isArray(chunk) || Buffer.isBuffer(chunk)) {
      chunkSize = bufferutils.pushDataSize(chunk.length) + chunk.length
    }

    return accum + chunkSize
  }, 0.0)

  var buffer = new Buffer(bufferSize)
  var offset = 0

  chunks.forEach(function(chunk) {
    // FIXME: transitionary
    if (Array.isArray(chunk) || Buffer.isBuffer(chunk)) {
      offset += bufferutils.writePushDataInt(buffer, chunk.length, offset)

      // FIXME: transitionary
//      chunk.copy(buffer, offset)
      for (var i = 0; i < chunk.length; ++i) {
        buffer[offset + i] = chunk[i]
      }

      offset += chunk.length

    } else {
      buffer.writeUInt8(chunk, offset)
      offset += 1
    }
  })

  return Script.fromBuffer(buffer)
}

// FIXME: doesn't work for data chunks, maybe time to use buffertools.compare...
Script.prototype.without = function(needle) {
  return Script.fromChunks(this.chunks.filter(function(op) {
    return op !== needle
  }))
}

module.exports = Script
