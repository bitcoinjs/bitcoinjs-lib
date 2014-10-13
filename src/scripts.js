var assert = require('assert')
var enforceType = require('./types')
var ops = require('./opcodes')

var ecurve = require('ecurve')
var curve = ecurve.getCurveByName('secp256k1')

var ECSignature = require('./ecsignature')
var Script = require('./script')

function classifyOutput(script) {
  enforceType(Script, script)

  if (isPubKeyHashOutput.call(script)) {
    return 'pubkeyhash'
  } else if (isScriptHashOutput.call(script)) {
    return 'scripthash'
  } else if (isMultisigOutput.call(script)) {
    return 'multisig'
  } else if (isPubKeyOutput.call(script)) {
    return 'pubkey'
  } else if (isNulldataOutput.call(script)) {
    return 'nulldata'
  } else {
    return 'nonstandard'
  }
}

function classifyInput(script) {
  enforceType(Script, script)

  if (isPubKeyHashInput.call(script)) {
    return 'pubkeyhash'
  } else if (isScriptHashInput.call(script)) {
    return 'scripthash'
  } else if (isMultisigInput.call(script)) {
    return 'multisig'
  } else if (isPubKeyInput.call(script)) {
    return 'pubkey'
  } else {
    return 'nonstandard'
  }
}

function isCanonicalPubKey(buffer) {
  if (!Buffer.isBuffer(buffer)) return false

  try {
    ecurve.Point.decodeFrom(curve, buffer)
  } catch (e) {
    if (!(e.message.match(/Invalid sequence (length|tag)/))) throw e

    return false
  }

  return true
}

function isCanonicalSignature(buffer) {
  if (!Buffer.isBuffer(buffer)) return false

  try {
    ECSignature.parseScriptSignature(buffer)
  } catch(e) {
    if (!(e.message.match(/Not a DER sequence|Invalid sequence length|Expected a DER integer|R length is zero|S length is zero|R value excessively padded|S value excessively padded|R value is negative|S value is negative|Invalid hashType/))) throw e

    return false
  }

  return true
}

function isPubKeyHashInput() {
  return this.chunks.length === 2 &&
    isCanonicalSignature(this.chunks[0]) &&
    isCanonicalPubKey(this.chunks[1])
}

function isPubKeyHashOutput() {
  return this.chunks.length === 5 &&
    this.chunks[0] === ops.OP_DUP &&
    this.chunks[1] === ops.OP_HASH160 &&
    Buffer.isBuffer(this.chunks[2]) &&
    this.chunks[2].length === 20 &&
    this.chunks[3] === ops.OP_EQUALVERIFY &&
    this.chunks[4] === ops.OP_CHECKSIG
}

function isPubKeyInput() {
  return this.chunks.length === 1 &&
    isCanonicalSignature(this.chunks[0])
}

function isPubKeyOutput() {
  return this.chunks.length === 2 &&
    isCanonicalPubKey(this.chunks[0]) &&
    this.chunks[1] === ops.OP_CHECKSIG
}

function isScriptHashInput() {
  if (this.chunks.length < 2) return false
  var lastChunk = this.chunks[this.chunks.length - 1]

  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSig = Script.fromChunks(this.chunks.slice(0, -1))
  var scriptPubKey = Script.fromBuffer(lastChunk)

  return classifyInput(scriptSig) === classifyOutput(scriptPubKey)
}

function isScriptHashOutput() {
  return this.chunks.length === 3 &&
    this.chunks[0] === ops.OP_HASH160 &&
    Buffer.isBuffer(this.chunks[1]) &&
    this.chunks[1].length === 20 &&
    this.chunks[2] === ops.OP_EQUAL
}

function isMultisigInput() {
  return this.chunks[0] === ops.OP_0 &&
    this.chunks.slice(1).every(isCanonicalSignature)
}

function isMultisigOutput() {
  if (this.chunks < 4) return false
  if (this.chunks[this.chunks.length - 1] !== ops.OP_CHECKMULTISIG) return false

  var mOp = this.chunks[0]
  if (mOp === ops.OP_0) return false
  if (mOp < ops.OP_1) return false
  if (mOp > ops.OP_16) return false

  var nOp = this.chunks[this.chunks.length - 2]
  if (nOp === ops.OP_0) return false
  if (nOp < ops.OP_1) return false
  if (nOp > ops.OP_16) return false

  var m = mOp - (ops.OP_1 - 1)
  var n = nOp - (ops.OP_1 - 1)
  if (n < m) return false

  var pubKeys = this.chunks.slice(1, -2)
  if (n < pubKeys.length) return false

  return pubKeys.every(isCanonicalPubKey)
}

function isNulldataOutput() {
  return this.chunks[0] === ops.OP_RETURN
}

// Standard Script Templates
// {pubKey} OP_CHECKSIG
function pubKeyOutput(pubKey) {
  return Script.fromChunks([
    pubKey.toBuffer(),
    ops.OP_CHECKSIG
  ])
}

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG
function pubKeyHashOutput(hash) {
  enforceType('Buffer', hash)

  return Script.fromChunks([
    ops.OP_DUP,
    ops.OP_HASH160,
    hash,
    ops.OP_EQUALVERIFY,
    ops.OP_CHECKSIG
  ])
}

// OP_HASH160 {scriptHash} OP_EQUAL
function scriptHashOutput(hash) {
  enforceType('Buffer', hash)

  return Script.fromChunks([
    ops.OP_HASH160,
    hash,
    ops.OP_EQUAL
  ])
}

// m [pubKeys ...] n OP_CHECKMULTISIG
function multisigOutput(m, pubKeys) {
  enforceType('Array', pubKeys)

  assert(pubKeys.length >= m, 'Not enough pubKeys provided')

  var pubKeyBuffers = pubKeys.map(function(pubKey) {
    return pubKey.toBuffer()
  })
  var n = pubKeys.length

  return Script.fromChunks([].concat(
    (ops.OP_1 - 1) + m,
    pubKeyBuffers,
    (ops.OP_1 - 1) + n,
    ops.OP_CHECKMULTISIG
  ))
}

// {signature}
function pubKeyInput(signature) {
  enforceType('Buffer', signature)

  return Script.fromChunks([signature])
}

// {signature} {pubKey}
function pubKeyHashInput(signature, pubKey) {
  enforceType('Buffer', signature)

  return Script.fromChunks([signature, pubKey.toBuffer()])
}

// <scriptSig> {serialized scriptPubKey script}
function scriptHashInput(scriptSig, scriptPubKey) {
  return Script.fromChunks([].concat(
    scriptSig.chunks,
    scriptPubKey.toBuffer()
  ))
}

// OP_0 [signatures ...]
function multisigInput(signatures, scriptPubKey) {
  if (scriptPubKey) {
    assert(isMultisigOutput.call(scriptPubKey))

    var mOp = scriptPubKey.chunks[0]
    var nOp = scriptPubKey.chunks[scriptPubKey.chunks.length - 2]
    var m = mOp - (ops.OP_1 - 1)
    var n = nOp - (ops.OP_1 - 1)

    assert(signatures.length >= m, 'Not enough signatures provided')
    assert(signatures.length <= n, 'Too many signatures provided')
  }

  return Script.fromChunks([].concat(ops.OP_0, signatures))
}

module.exports = {
  classifyInput: classifyInput,
  classifyOutput: classifyOutput,
  multisigInput: multisigInput,
  multisigOutput: multisigOutput,
  pubKeyHashInput: pubKeyHashInput,
  pubKeyHashOutput: pubKeyHashOutput,
  pubKeyInput: pubKeyInput,
  pubKeyOutput: pubKeyOutput,
  scriptHashInput: scriptHashInput,
  scriptHashOutput: scriptHashOutput
}
