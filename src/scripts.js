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

function coerceBuffer (buffer) {
  return types.Buffer(buffer) ? buffer : Script.compile(buffer)
}

function coerceChunks (chunks) {
  return types.Array(chunks) ? chunks : Script.decompile(chunks)
}

function isPubKeyHashInput (chunks) {
  chunks = coerceChunks(chunks)

  return chunks.length === 2 &&
    isCanonicalSignature(chunks[0]) &&
    isCanonicalPubKey(chunks[1])
}

function isPubKeyHashOutput (chunks) {
  chunks = coerceChunks(chunks)

  return chunks.length === 5 &&
    chunks[0] === ops.OP_DUP &&
    chunks[1] === ops.OP_HASH160 &&
    Buffer.isBuffer(chunks[2]) &&
    chunks[2].length === 20 &&
    chunks[3] === ops.OP_EQUALVERIFY &&
    chunks[4] === ops.OP_CHECKSIG
}

function isPubKeyInput (chunks) {
  chunks = coerceChunks(chunks)

  return chunks.length === 1 &&
    isCanonicalSignature(chunks[0])
}

function isPubKeyOutput (chunks) {
  chunks = coerceChunks(chunks)

  return chunks.length === 2 &&
    isCanonicalPubKey(chunks[0]) &&
    chunks[1] === ops.OP_CHECKSIG
}

function isScriptHashInput (chunks, allowIncomplete) {
  chunks = coerceChunks(chunks)
  if (chunks.length < 2) return false

  var lastChunk = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSigChunks = chunks.slice(0, -1)
  var redeemScriptChunks = Script.decompile(lastChunk)

  // is redeemScript a valid script?
  if (redeemScriptChunks.length === 0) return false

  return classifyInput(scriptSigChunks, allowIncomplete) === classifyOutput(redeemScriptChunks)
}

function isScriptHashOutput (chunks) {
  chunks = coerceChunks(chunks)

  return chunks.length === 3 &&
    chunks[0] === ops.OP_HASH160 &&
    Buffer.isBuffer(chunks[1]) &&
    chunks[1].length === 20 &&
    chunks[2] === ops.OP_EQUAL
}

// allowIncomplete is to account for combining signatures
// See https://github.com/bitcoin/bitcoin/blob/f425050546644a36b0b8e0eb2f6934a3e0f6f80f/src/script/sign.cpp#L195-L197
function isMultisigInput (chunks, allowIncomplete) {
  chunks = coerceChunks(chunks)
  if (chunks.length < 2) return false
  if (chunks[0] !== ops.OP_0) return false

  if (allowIncomplete) {
    return chunks.slice(1).every(function (chunk) {
      return chunk === ops.OP_0 || isCanonicalSignature(chunk)
    })
  }

  return chunks.slice(1).every(isCanonicalSignature)
}

function isMultisigOutput (chunks) {
  chunks = coerceChunks(chunks)
  if (chunks.length < 4) return false
  if (chunks[chunks.length - 1] !== ops.OP_CHECKMULTISIG) return false

  var mOp = chunks[0]
  if (mOp === ops.OP_0) return false
  if (mOp < ops.OP_1) return false
  if (mOp > ops.OP_16) return false

  var nOp = chunks[chunks.length - 2]
  if (nOp === ops.OP_0) return false
  if (nOp < ops.OP_1) return false
  if (nOp > ops.OP_16) return false

  var m = mOp - (ops.OP_1 - 1)
  var n = nOp - (ops.OP_1 - 1)
  if (n < m) return false

  var pubKeys = chunks.slice(1, -2)
  if (n < pubKeys.length) return false

  return pubKeys.every(isCanonicalPubKey)
}

function isNullDataOutput (chunks) {
  chunks = coerceChunks(chunks)
  return chunks[0] === ops.OP_RETURN
}

function classifyOutput (chunks) {
  chunks = coerceChunks(chunks)
  if (isPubKeyHashOutput(chunks)) {
    return 'pubkeyhash'
  } else if (isScriptHashOutput(chunks)) {
    return 'scripthash'
  } else if (isMultisigOutput(chunks)) {
    return 'multisig'
  } else if (isPubKeyOutput(chunks)) {
    return 'pubkey'
  } else if (isNullDataOutput(chunks)) {
    return 'nulldata'
  }

  return 'nonstandard'
}

function classifyInput (chunks, allowIncomplete) {
  chunks = coerceChunks(chunks)
  if (isPubKeyHashInput(chunks)) {
    return 'pubkeyhash'
  } else if (isMultisigInput(chunks, allowIncomplete)) {
    return 'multisig'
  } else if (isScriptHashInput(chunks, allowIncomplete)) {
    return 'scripthash'
  } else if (isPubKeyInput(chunks)) {
    return 'pubkey'
  }

  return 'nonstandard'
}

// Standard Script Templates
// {pubKey} OP_CHECKSIG
function pubKeyOutput (pubKey) {
  return Script.compile([pubKey, ops.OP_CHECKSIG])
}

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG
function pubKeyHashOutput (pubKeyHash) {
  typeforce(typeforce.Buffer, pubKeyHash)

  return Script.compile([ops.OP_DUP, ops.OP_HASH160, pubKeyHash, ops.OP_EQUALVERIFY, ops.OP_CHECKSIG])
}

// OP_HASH160 {scriptHash} OP_EQUAL
function scriptHashOutput (scriptHash) {
  typeforce(typeforce.Buffer, scriptHash)

  return Script.compile([ops.OP_HASH160, scriptHash, ops.OP_EQUAL])
}

// m [pubKeys ...] n OP_CHECKMULTISIG
function multisigOutput (m, pubKeys) {
  typeforce(types.tuple(types.Number, [types.Buffer]), arguments)

  var n = pubKeys.length
  if (n < m) throw new Error('Not enough pubKeys provided')

  return Script.compile([].concat(
    (ops.OP_1 - 1) + m,
    pubKeys,
    (ops.OP_1 - 1) + n,
    ops.OP_CHECKMULTISIG
  ))
}

// {signature}
function pubKeyInput (signature) {
  typeforce(types.Buffer, signature)

  return Script.compile([signature])
}

// {signature} {pubKey}
function pubKeyHashInput (signature, pubKey) {
  typeforce(types.tuple(types.Buffer, types.Buffer), arguments)

  return Script.compile([signature, pubKey])
}

// <scriptSig> {serialized scriptPubKey script}
function scriptHashInput (scriptSig, scriptPubKeyBuffer) {
  scriptSig = coerceChunks(scriptSig)
  scriptPubKeyBuffer = coerceBuffer(scriptPubKeyBuffer)

  return Script.compile([].concat(
    scriptSig,
    scriptPubKeyBuffer
  ))
}

// OP_0 [signatures ...]
function multisigInput (signatures, scriptPubKey) {
  if (scriptPubKey) {
    if (!isMultisigOutput(scriptPubKey)) throw new Error('Expected multisig scriptPubKey')
    scriptPubKey = coerceChunks(scriptPubKey)

    var mOp = scriptPubKey[0]
    var nOp = scriptPubKey[scriptPubKey.length - 2]
    var m = mOp - (ops.OP_1 - 1)
    var n = nOp - (ops.OP_1 - 1)

    if (signatures.length < m) throw new Error('Not enough signatures provided')
    if (signatures.length > n) throw new Error('Too many signatures provided')
  }

  return Script.compile([].concat(ops.OP_0, signatures))
}

function nullDataOutput (data) {
  return Script.compile([ops.OP_RETURN, data])
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
