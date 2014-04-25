var assert = require('assert')
var Address = require('./address')
var crypto = require('./crypto')
var convert = require('./convert')
var Network = require('./network')
var Opcode = require('./opcode')

function Script(data) {
  this.buffer = data || []
  if(!Array.isArray(this.buffer)) {
    throw new Error('expect Script to be initialized with Array, but got ' + data)
  }
  this.parse()
}

Script.fromHex = function(data) {
  return new Script(convert.hexToBytes(data))
}

Script.fromPubKey = function(str) {
  var script = new Script()
  var s = str.split(' ')
  for (var i in s) {
    if (Opcode.map.hasOwnProperty(s[i])) {
      script.writeOp(Opcode.map[s[i]])
    } else {
      script.writeBytes(convert.hexToBytes(s[i]))
    }
  }
  return script
}

Script.fromScriptSig = function(str) {
  var script = new Script()
  var s = str.split(' ')
  for (var i in s) {
    if (Opcode.map.hasOwnProperty(s[i])) {
      script.writeOp(Opcode.map[s[i]])
    } else {
      script.writeBytes(convert.hexToBytes(s[i]))
    }
  }
  return script
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
    if (opcode > 0 && opcode < Opcode.map.OP_PUSHDATA1) {
      // Read some bytes of data, opcode value is the length of data
      readChunk(opcode)
    } else if (opcode == Opcode.map.OP_PUSHDATA1) {
      len = this.buffer[i++]
      readChunk(len)
    } else if (opcode == Opcode.map.OP_PUSHDATA2) {
      len = (this.buffer[i++] << 8) | this.buffer[i++]
      readChunk(len)
    } else if (opcode == Opcode.map.OP_PUSHDATA4) {
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
    this.chunks[0] == Opcode.map.OP_DUP &&
    this.chunks[1] == Opcode.map.OP_HASH160 &&
    Array.isArray(this.chunks[2]) &&
    this.chunks[2].length === 20 &&
    this.chunks[3] == Opcode.map.OP_EQUALVERIFY &&
    this.chunks[4] == Opcode.map.OP_CHECKSIG
}

function isPubkey() {
  return this.chunks.length === 2 &&
    Array.isArray(this.chunks[0]) &&
    this.chunks[1] === Opcode.map.OP_CHECKSIG
}

function isScripthash() {
  return this.chunks[this.chunks.length - 1] == Opcode.map.OP_EQUAL &&
    this.chunks[0] == Opcode.map.OP_HASH160 &&
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
    this.chunks[this.chunks.length - 2] !== Opcode.map.OP_0 &&
    // n is the size of chunk length minus 3 (m, n, OP_CHECKMULTISIG)
    this.chunks.length - 3 === this.chunks[this.chunks.length - 2] - Opcode.map.OP_RESERVED &&
    // last chunk is OP_CHECKMULTISIG
    this.chunks[this.chunks.length - 1] == Opcode.map.OP_CHECKMULTISIG
}

function isNulldata() {
  return this.chunks[0] === Opcode.map.OP_RETURN
}

function isSmallIntOp(opcode) {
  return ((opcode == Opcode.map.OP_0) ||
    ((opcode >= Opcode.map.OP_1) && (opcode <= Opcode.map.OP_16)))
}

/**
 * Returns the address corresponding to this output in hash160 form.
 * Assumes strange scripts are P2SH
 */
Script.prototype.toScriptHash = function() {
  if(isPubkeyhash.call(this)) {
    return this.chunks[2]
  }

  if(isScripthash.call(this)) {
    return crypto.hash160(this.buffer)
  }

  return crypto.hash160(this.buffer)
}

Script.prototype.getToAddress = function(network) {
  network = network || Network.bitcoin

  if(isPubkeyhash.call(this)) {
    return new Address(new Buffer(this.chunks[2]), network.pubKeyHash)
  }

  assert(isScripthash.call(this))

  return new Address(new Buffer(this.chunks[1]), network.scriptHash)
}

Script.prototype.getFromAddress = function(version) {
  version = version || Network.bitcoin.pubKeyHash

  return new Address(this.simpleInHash(), version)
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
  } else if (this.chunks[0] == Opcode.map.OP_0 &&
    this.chunks.slice(1).reduce(function(t, chunk, i) {
      return t && Array.isArray(chunk) && (chunk[0] == 48 || i == this.chunks.length - 1)
    }, true)) {
    return 'multisig'
  } else {
    return 'nonstandard'
  }
}

/**
 * Returns the affected public key for this input.
 *
 * This currently only works with payToPubKeyHash transactions. It will also
 * work in the future for standard payToScriptHash transactions that use a
 * single public key.
 *
 * However for multi-key and other complex transactions, this will only return
 * one of the keys or raise an error. Therefore, it is recommended for indexing
 * purposes to use Script#simpleInHash or Script#simpleOutHash instead.
 *
 * @deprecated
 */
Script.prototype.simpleInPubKey = function() {
  switch (this.getInType()) {
    case 'pubkeyhash':
      return this.chunks[1]
    case 'pubkey':
      // TODO: Theoretically, we could recover the pubkey from the sig here.
      //       See https://bitcointalk.org/?topic=6430.0
      throw new Error('Script does not contain pubkey')
    default:
      throw new Error('Encountered non-standard scriptSig')
  }
}

/**
 * Returns the affected address hash for this input.
 *
 * For standard transactions, this will return the hash of the pubKey that
 * can spend this output.
 *
 * In the future, for standard payToScriptHash inputs, this will return the
 * scriptHash.
 *
 * Note: This function provided for convenience. If you have the corresponding
 * scriptPubKey available, you are urged to use Script#simpleOutHash instead
 * as it is more reliable for non-standard payToScriptHash transactions.
 *
 * This method is useful for indexing transactions.
 */
Script.prototype.simpleInHash = function() {
  return crypto.hash160(this.simpleInPubKey())
}

/**
 * Old name for Script#simpleInHash.
 *
 * @deprecated
 */
Script.prototype.simpleInPubKeyHash = Script.prototype.simpleInHash

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
  assert(Array.isArray(data), "Expect a byte array. Got" + data)

  if (data.length < Opcode.map.OP_PUSHDATA1) {
    this.buffer.push(data.length)
  } else if (data.length <= 0xff) {
    this.buffer.push(Opcode.map.OP_PUSHDATA1)
    this.buffer.push(data.length)
  } else if (data.length <= 0xffff) {
    this.buffer.push(Opcode.map.OP_PUSHDATA2)
    this.buffer.push(data.length & 0xff)
    this.buffer.push((data.length >>> 8) & 0xff)
  } else {
    this.buffer.push(Opcode.map.OP_PUSHDATA4)
    this.buffer.push(data.length & 0xff)
    this.buffer.push((data.length >>> 8) & 0xff)
    this.buffer.push((data.length >>> 16) & 0xff)
    this.buffer.push((data.length >>> 24) & 0xff)
  }
  this.buffer = this.buffer.concat(data)
  this.chunks.push(data)
}

/**
 * Create an output for an address
 */
Script.createOutputScript = function(address, network) {
  assert(address instanceof Address)
  network = network || Network.bitcoin

  var script = new Script()

  // Standard pay-to-script-hash
  if (address.version === network.scriptHash) {
    script.writeOp(Opcode.map.OP_HASH160)
    script.writeBytes(address.hash)
    script.writeOp(Opcode.map.OP_EQUAL)

    return script
  }

  assert.strictEqual(address.version, network.pubKeyHash, 'Unknown address type')

  // Standard pay-to-pubkey-hash
  script.writeOp(Opcode.map.OP_DUP)
  script.writeOp(Opcode.map.OP_HASH160)
  script.writeBytes(address.hash)
  script.writeOp(Opcode.map.OP_EQUALVERIFY)
  script.writeOp(Opcode.map.OP_CHECKSIG)

  return script
}

/**
 * Extract pubkeys from a multisig script
 */

Script.prototype.extractPubkeys = function() {
  return this.chunks.filter(function(chunk) {
    return(chunk[0] == 4 && chunk.length == 65 || chunk[0] < 4 && chunk.length == 33)
  })
}

// m [pubKeys ...] n OP_CHECKMULTISIG
Script.createMultisigOutputScript = function(m, pubKeys) {
  var script = new Script()
  pubKeys = pubKeys.sort()

  script.writeOp(Opcode.map.OP_1 + m - 1)
  for (var i = 0; i < pubKeys.length; ++i) {
    script.writeBytes(pubKeys[i])
  }
  script.writeOp(Opcode.map.OP_1 + pubKeys.length - 1)
  script.writeOp(Opcode.map.OP_CHECKMULTISIG)

  return script
}

// {signature} {pubKey}
Script.createPubKeyHashScriptSig = function(signature, pubKey) {
  var script = new Script()
  script.writeBytes(signature)
  script.writeBytes(pubKey.toBuffer())
  return script
}

// OP_0 [signatures ...]
Script.createMultisigScriptSig = function(signatures) {
  var inScript = new Script()

  inScript.writeOp(Opcode.map.OP_0)
  signatures.map(function(sig) {
    inScript.writeBytes(sig)
  })

  return inScript
}

// <scriptSig> {serialized scriptPubKey script}
Script.createP2SHScriptSig = function(scriptSig, scriptPubKey) {
  var inScript = new Script(scriptSig.buffer)
  inScript.writeBytes(scriptPubKey.buffer)
  return inScript
}

// [signatures ...] {m [pubKeys ...] n OP_CHECKSIG}
Script.createP2SHMultisigScriptSig = function(signatures, scriptPubKey) {
  assert(isMultisig.call(scriptPubKey))

  var m = scriptPubKey.chunks[0]
  var k = m - (Opcode.map.OP_1 - 1)
  assert(k <= signatures.length, 'Not enough signatures provided')

  var scriptSig = Script.createMultisigScriptSig(signatures)
  return Script.createP2SHScriptSig(scriptSig, scriptPubKey)
}

Script.prototype.clone = function() {
  return new Script(this.buffer)
}

module.exports = Script
