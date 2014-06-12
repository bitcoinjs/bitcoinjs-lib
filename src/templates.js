var assert = require('assert')
var opcodes = require('./opcodes')
var Script = require('./script')

function classifyScriptPubKey(script) {
  if (isPubkeyhash.call(script)) {
    return 'pubkeyhash'
  } else if (isPubkey.call(script)) {
    return 'pubkey'
  } else if (isScripthash.call(script)) {
    return 'scripthash'
  } else if (isMultisig.call(script)) {
    return 'multisig'
  } else if (isNulldata.call(script)) {
    return 'nulldata'
  } else {
    return 'nonstandard'
  }
}

function classifyScriptSig(script) {
  if (script.chunks.length == 1 && Buffer.isBuffer(script.chunks[0])) {
    return 'pubkey'
  } else if (script.chunks.length == 2 && Buffer.isBuffer(script.chunks[0]) && Buffer.isBuffer(script.chunks[1])) {
    return 'pubkeyhash'
  } else if (script.chunks[0] == opcodes.OP_0 && script.chunks.slice(1).reduce(function(t, chunk, i) {
      return t && Buffer.isBuffer(chunk) && (chunk[0] == 48 || i == script.chunks.length - 1)
    }, true)) {
    return 'multisig'
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
  return ((opcode == opcodes.OP_0) || ((opcode >= opcodes.OP_1) && (opcode <= opcodes.OP_16)))
}

// Standard Script Templates
// {pubKey} OP_CHECKSIG
function createPubKeyScriptPubKey(pubKey) {
  return Script.fromChunks([
    pubKey.toBuffer(),
    opcodes.OP_CHECKSIG
  ])
}

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG
function createPubKeyHashScriptPubKey(hash) {
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
function createP2SHScriptPubKey(hash) {
  assert(Buffer.isBuffer(hash), 'Expected Buffer, got ' + hash)

  return Script.fromChunks([
    opcodes.OP_HASH160,
    hash,
    opcodes.OP_EQUAL
  ])
}

// m [pubKeys ...] n OP_CHECKMULTISIG
function createMultisigScriptPubKey(m, pubKeys) {
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
function createPubKeyScriptSig(signature) {
  assert(Buffer.isBuffer(signature), 'Expected Buffer, got ' + signature)

  return Script.fromChunks(signature)
}

// {signature} {pubKey}
function createPubKeyHashScriptSig(signature, pubKey) {
  assert(Buffer.isBuffer(signature), 'Expected Buffer, got ' + signature)

  return Script.fromChunks([signature, pubKey.toBuffer()])
}

// <scriptSig> {serialized scriptPubKey script}
function createP2SHScriptSig(scriptSig, scriptPubKey) {
  return Script.fromChunks([].concat(
    scriptSig.chunks,
    scriptPubKey.toBuffer()
  ))
}

// OP_0 [signatures ...]
function createMultisigScriptSig(signatures, scriptPubKey) {
  if (scriptPubKey) {
    assert(isMultisig.call(scriptPubKey))

    var m = scriptPubKey.chunks[0]
    var k = m - (opcodes.OP_1 - 1)
    assert(k <= signatures.length, 'Not enough signatures provided')
  }

  return Script.fromChunks([].concat(opcodes.OP_0, signatures))
}

module.exports = {
  classifyScriptPubKey: classifyScriptPubKey,
  classifyScriptSig: classifyScriptSig,
  createMultisigScriptPubKey: createMultisigScriptPubKey,
  createMultisigScriptSig: createMultisigScriptSig,
  createP2SHScriptPubKey: createP2SHScriptPubKey,
  createP2SHScriptSig: createP2SHScriptSig,
  createPubKeyHashScriptPubKey: createPubKeyHashScriptPubKey,
  createPubKeyHashScriptSig: createPubKeyHashScriptSig,
  createPubKeyScriptPubKey: createPubKeyScriptPubKey,
  createPubKeyScriptSig: createPubKeyScriptSig
}
