var assert = require('assert')
var ops = require('./opcodes')
var typeforce = require('typeforce')
var types = require('./types')

var ecurve = require('ecurve')
var curve = ecurve.getCurveByName('secp256k1')

var ECSignature = require('./ecsignature')
var Script = require('./script')

function isCanonicalPubKey (buffer) {
  if (!Buffer.isBuffer(buffer)) return false

  try {
    ecurve.Point.decodeFrom(curve, buffer)
  } catch (e) {
    if (!(e.message.match(/Invalid sequence (length|tag)/))) {
      throw e
    }

    return false
  }

  return true
}

function isCanonicalSignature (buffer) {
  if (!Buffer.isBuffer(buffer)) return false

  try {
    ECSignature.parseScriptSignature(buffer)
  } catch (e) {
    if (!(e.message.match(/Not a DER sequence|Invalid sequence length|Expected a DER integer|R length is zero|S length is zero|R value excessively padded|S value excessively padded|R value is negative|S value is negative|Invalid hashType/))) {
      throw e
    }

    return false
  }

  return true
}

function isPubKeyHashInput (script) {
  return script.chunks.length === 2 &&
    isCanonicalSignature(script.chunks[0]) &&
    isCanonicalPubKey(script.chunks[1])
}

function isPubKeyHashOutput (script) {
  return script.chunks.length === 5 &&
    script.chunks[0] === ops.OP_DUP &&
    script.chunks[1] === ops.OP_HASH160 &&
    Buffer.isBuffer(script.chunks[2]) &&
    script.chunks[2].length === 20 &&
    script.chunks[3] === ops.OP_EQUALVERIFY &&
    script.chunks[4] === ops.OP_CHECKSIG
}

function isPubKeyInput (script) {
  return script.chunks.length === 1 &&
    isCanonicalSignature(script.chunks[0])
}

function isPubKeyOutput (script) {
  return script.chunks.length === 2 &&
    isCanonicalPubKey(script.chunks[0]) &&
    script.chunks[1] === ops.OP_CHECKSIG
}

function isScriptHashInput (script, allowIncomplete) {
  if (script.chunks.length < 2) return false

  var lastChunk = script.chunks[script.chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSig = Script.fromChunks(script.chunks.slice(0, -1))
  var redeemScript = Script.fromBuffer(lastChunk)

  // is redeemScript a valid script?
  if (redeemScript.chunks.length === 0) return false

  return classifyInput(scriptSig, allowIncomplete) === classifyOutput(redeemScript)
}

function isScriptHashOutput (script) {
  return script.chunks.length === 3 &&
    script.chunks[0] === ops.OP_HASH160 &&
    Buffer.isBuffer(script.chunks[1]) &&
    script.chunks[1].length === 20 &&
    script.chunks[2] === ops.OP_EQUAL
}

// allowIncomplete is to account for combining signatures
// See https://github.com/bitcoin/bitcoin/blob/f425050546644a36b0b8e0eb2f6934a3e0f6f80f/src/script/sign.cpp#L195-L197
function isMultisigInput (script, allowIncomplete) {
  if (script.chunks.length < 2) return false
  if (script.chunks[0] !== ops.OP_0) return false

  if (allowIncomplete) {
    return script.chunks.slice(1).every(function (chunk) {
      return chunk === ops.OP_0 || isCanonicalSignature(chunk)
    })
  }

  return script.chunks.slice(1).every(isCanonicalSignature)
}

function isMultisigOutput (script) {
  if (script.chunks.length < 4) return false
  if (script.chunks[script.chunks.length - 1] !== ops.OP_CHECKMULTISIG) return false

  var mOp = script.chunks[0]
  if (mOp === ops.OP_0) return false
  if (mOp < ops.OP_1) return false
  if (mOp > ops.OP_16) return false

  var nOp = script.chunks[script.chunks.length - 2]
  if (nOp === ops.OP_0) return false
  if (nOp < ops.OP_1) return false
  if (nOp > ops.OP_16) return false

  var m = mOp - (ops.OP_1 - 1)
  var n = nOp - (ops.OP_1 - 1)
  if (n < m) return false

  var pubKeys = script.chunks.slice(1, -2)
  if (n < pubKeys.length) return false

  return pubKeys.every(isCanonicalPubKey)
}

function isNullDataOutput (script) {
  return script.chunks[0] === ops.OP_RETURN
}

function classifyOutput (script) {
  typeforce(types.Script, script)

  if (isPubKeyHashOutput(script)) {
    return 'pubkeyhash'
  } else if (isScriptHashOutput(script)) {
    return 'scripthash'
  } else if (isMultisigOutput(script)) {
    return 'multisig'
  } else if (isPubKeyOutput(script)) {
    return 'pubkey'
  } else if (isNullDataOutput(script)) {
    return 'nulldata'
  }

  return 'nonstandard'
}

function classifyInput (script, allowIncomplete) {
  typeforce(types.Script, script)

  if (isPubKeyHashInput(script)) {
    return 'pubkeyhash'
  } else if (isMultisigInput(script, allowIncomplete)) {
    return 'multisig'
  } else if (isScriptHashInput(script, allowIncomplete)) {
    return 'scripthash'
  } else if (isPubKeyInput(script)) {
    return 'pubkey'
  }

  return 'nonstandard'
}

// Standard Script Templates
// {pubKey} OP_CHECKSIG
function pubKeyOutput (pubKey) {
  return Script.fromChunks([
    pubKey,
    ops.OP_CHECKSIG
  ])
}

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG
function pubKeyHashOutput (hash) {
  typeforce(types.Hash160bit, hash)

  return Script.fromChunks([
    ops.OP_DUP,
    ops.OP_HASH160,
    hash,
    ops.OP_EQUALVERIFY,
    ops.OP_CHECKSIG
  ])
}

// OP_HASH160 {scriptHash} OP_EQUAL
function scriptHashOutput (hash) {
  typeforce(types.Hash160bit, hash)

  return Script.fromChunks([
    ops.OP_HASH160,
    hash,
    ops.OP_EQUAL
  ])
}

// m [pubKeys ...] n OP_CHECKMULTISIG
function multisigOutput (m, pubKeys) {
  typeforce(types.tuple(types.Number, [types.Buffer]), arguments)

  var n = pubKeys.length
  assert(n >= m, 'Not enough pubKeys provided')

  return Script.fromChunks([].concat(
    (ops.OP_1 - 1) + m,
    pubKeys,
    (ops.OP_1 - 1) + n,
    ops.OP_CHECKMULTISIG
  ))
}

// {signature}
function pubKeyInput (signature) {
  typeforce(types.Buffer, signature)

  return Script.fromChunks([signature])
}

// {signature} {pubKey}
function pubKeyHashInput (signature, pubKey) {
  typeforce(types.tuple(types.Buffer, types.Buffer), arguments)

  return Script.fromChunks([signature, pubKey])
}

// <scriptSig> {serialized scriptPubKey script}
function scriptHashInput (scriptSig, scriptPubKey) {
  return Script.fromChunks([].concat(
    scriptSig.chunks,
    scriptPubKey.toBuffer()
  ))
}

// OP_0 [signatures ...]
function multisigInput (signatures, scriptPubKey) {
  if (scriptPubKey) {
    assert(isMultisigOutput(scriptPubKey))

    var mOp = scriptPubKey.chunks[0]
    var nOp = scriptPubKey.chunks[scriptPubKey.chunks.length - 2]
    var m = mOp - (ops.OP_1 - 1)
    var n = nOp - (ops.OP_1 - 1)

    assert(signatures.length >= m, 'Not enough signatures provided')
    assert(signatures.length <= n, 'Too many signatures provided')
  }

  return Script.fromChunks([].concat(ops.OP_0, signatures))
}

function nullDataOutput (data) {
  return Script.fromChunks([ops.OP_RETURN, data])
}

module.exports = {
  isCanonicalPubKey: isCanonicalPubKey,
  isCanonicalSignature: isCanonicalSignature,
  isPubKeyHashInput: isPubKeyHashInput,
  isPubKeyHashOutput: isPubKeyHashOutput,
  isPubKeyInput: isPubKeyInput,
  isPubKeyOutput: isPubKeyOutput,
  isScriptHashInput: isScriptHashInput,
  isScriptHashOutput: isScriptHashOutput,
  isMultisigInput: isMultisigInput,
  isMultisigOutput: isMultisigOutput,
  isNullDataOutput: isNullDataOutput,
  classifyOutput: classifyOutput,
  classifyInput: classifyInput,
  pubKeyOutput: pubKeyOutput,
  pubKeyHashOutput: pubKeyHashOutput,
  scriptHashOutput: scriptHashOutput,
  multisigOutput: multisigOutput,
  pubKeyInput: pubKeyInput,
  pubKeyHashInput: pubKeyHashInput,
  scriptHashInput: scriptHashInput,
  multisigInput: multisigInput,
  nullDataOutput: nullDataOutput
}
