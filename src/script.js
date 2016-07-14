var bip66 = require('bip66')
var bufferutils = require('./bufferutils')
var typeforce = require('typeforce')
var types = require('./types')

var OPS = require('./opcodes.json')
var REVERSE_OPS = (function () {
  var result = {}
  for (var op in OPS) {
    var code = OPS[op]
    result[code] = op
  }
  return result
})()

var OP_INT_BASE = OPS.OP_RESERVED // OP_1 - 1

function toASM (chunks) {
  if (Buffer.isBuffer(chunks)) {
    chunks = decompile(chunks)
  }

  return chunks.map(function (chunk) {
    // data?
    if (Buffer.isBuffer(chunk)) return chunk.toString('hex')

    // opcode!
    return REVERSE_OPS[chunk]
  }).join(' ')
}

function fromASM (asm) {
  typeforce(types.String, asm)

  return compile(asm.split(' ').map(function (chunkStr) {
    // opcode?
    if (OPS[chunkStr] !== undefined) return OPS[chunkStr]

    // data!
    return new Buffer(chunkStr, 'hex')
  }))
}

function compile (chunks) {
  // TODO: remove me
  if (Buffer.isBuffer(chunks)) return chunks

  typeforce(types.Array, chunks)

  var bufferSize = chunks.reduce(function (accum, chunk) {
    // data chunk
    if (Buffer.isBuffer(chunk)) {
      return accum + bufferutils.pushDataSize(chunk.length) + chunk.length
    }

    // opcode
    return accum + 1
  }, 0.0)

  var buffer = new Buffer(bufferSize)
  var offset = 0

  chunks.forEach(function (chunk) {
    // data chunk
    if (Buffer.isBuffer(chunk)) {
      offset += bufferutils.writePushDataInt(buffer, chunk.length, offset)

      chunk.copy(buffer, offset)
      offset += chunk.length

    // opcode
    } else {
      buffer.writeUInt8(chunk, offset)
      offset += 1
    }
  })

  if (offset !== buffer.length) throw new Error('Could not decode chunks')
  return buffer
}

function decompile (buffer) {
  // TODO: remove me
  if (types.Array(buffer)) return buffer

  typeforce(types.Buffer, buffer)

  var chunks = []
  var i = 0

  while (i < buffer.length) {
    var opcode = buffer[i]

    // data chunk
    if ((opcode > OPS.OP_0) && (opcode <= OPS.OP_PUSHDATA4)) {
      var d = bufferutils.readPushDataInt(buffer, i)

      // did reading a pushDataInt fail? empty script
      if (d === null) return []
      i += d.size

      // attempt to read too much data? empty script
      if (i + d.number > buffer.length) return []

      var data = buffer.slice(i, i + d.number)
      i += d.number

      chunks.push(data)

    // opcode
    } else {
      chunks.push(opcode)

      i += 1
    }
  }

  return chunks
}

function isCanonicalPubKey (buffer) {
  if (!Buffer.isBuffer(buffer)) return false
  if (buffer.length < 33) return false

  switch (buffer[0]) {
    case 0x02:
    case 0x03:
      return buffer.length === 33
    case 0x04:
      return buffer.length === 65
  }

  return false
}

function isCanonicalSignature (buffer) {
  if (!Buffer.isBuffer(buffer)) return false
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false

  return bip66.check(buffer.slice(0, -1))
}

function isDefinedHashType (hashType) {
  var hashTypeMod = hashType & ~0x80

// return hashTypeMod > SIGHASH_ALL && hashTypeMod < SIGHASH_SINGLE
  return hashTypeMod > 0x00 && hashTypeMod < 0x04
}

function isPubKeyHashInput (script) {
  var chunks = decompile(script)

  return chunks.length === 2 &&
    isCanonicalSignature(chunks[0]) &&
    isCanonicalPubKey(chunks[1])
}

function isPubKeyHashOutput (script) {
  var buffer = compile(script)

  return buffer.length === 25 &&
    buffer[0] === OPS.OP_DUP &&
    buffer[1] === OPS.OP_HASH160 &&
    buffer[2] === 0x14 &&
    buffer[23] === OPS.OP_EQUALVERIFY &&
    buffer[24] === OPS.OP_CHECKSIG
}

function isPubKeyInput (script) {
  var chunks = decompile(script)

  return chunks.length === 1 &&
    isCanonicalSignature(chunks[0])
}

function isPubKeyOutput (script) {
  var chunks = decompile(script)

  return chunks.length === 2 &&
    isCanonicalPubKey(chunks[0]) &&
    chunks[1] === OPS.OP_CHECKSIG
}

function isScriptHashInput (script, allowIncomplete) {
  var chunks = decompile(script)
  if (chunks.length < 2) return false

  var lastChunk = chunks[chunks.length - 1]
  if (!Buffer.isBuffer(lastChunk)) return false

  var scriptSigChunks = chunks.slice(0, -1)
  var redeemScriptChunks = decompile(lastChunk)

  // is redeemScript a valid script?
  if (redeemScriptChunks.length === 0) return false

  return classifyInput(scriptSigChunks, allowIncomplete) === classifyOutput(redeemScriptChunks)
}

function isScriptHashOutput (script) {
  var buffer = compile(script)

  return buffer.length === 23 &&
    buffer[0] === OPS.OP_HASH160 &&
    buffer[1] === 0x14 &&
    buffer[22] === OPS.OP_EQUAL
}

function isWitnessPubKeyHashOutput (script) {
  var buffer = compile(script)

  return buffer.length === 22 &&
    buffer[0] === OPS.OP_0 &&
    buffer[1] === 0x14
}

function isWitnessScriptHashOutput (script) {
  var buffer = compile(script)

  return buffer.length === 34 &&
    buffer[0] === OPS.OP_0 &&
    buffer[1] === 0x20
}

// allowIncomplete is to account for combining signatures
// See https://github.com/bitcoin/bitcoin/blob/f425050546644a36b0b8e0eb2f6934a3e0f6f80f/src/script/sign.cpp#L195-L197
function isMultisigInput (script, allowIncomplete) {
  var chunks = decompile(script)
  if (chunks.length < 2) return false
  if (chunks[0] !== OPS.OP_0) return false

  if (allowIncomplete) {
    return chunks.slice(1).every(function (chunk) {
      return chunk === OPS.OP_0 || isCanonicalSignature(chunk)
    })
  }

  return chunks.slice(1).every(isCanonicalSignature)
}

function isMultisigOutput (script) {
  var chunks = decompile(script)
  if (chunks.length < 4) return false
  if (chunks[chunks.length - 1] !== OPS.OP_CHECKMULTISIG) return false

  var mOp = chunks[0]
  var nOp = chunks[chunks.length - 2]

  if (!types.Number(mOp)) return false
  if (!types.Number(nOp)) return false

  var m = mOp - OP_INT_BASE
  var n = nOp - OP_INT_BASE

  // 0 < m <= n <= 16
  if (m <= 0) return false
  if (m > n) return false
  if (n > 16) return false
  if (n !== chunks.length - 3) return false

  return chunks.slice(1, -2).every(isCanonicalPubKey)
}

function isNullDataOutput (script) {
  var chunks = decompile(script)
  return chunks[0] === OPS.OP_RETURN
}

function classifyOutput (script) {
  var chunks = decompile(script)

  if (isWitnessPubKeyHashOutput(chunks)) {
    return 'witnesspubkeyhash'
  } else if (isWitnessScriptHashOutput(chunks)) {
    return 'witnessscripthash'
  } else if (isPubKeyHashOutput(chunks)) {
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

function classifyInput (script, allowIncomplete) {
  var chunks = decompile(script)

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
  return compile([pubKey, OPS.OP_CHECKSIG])
}

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG
function pubKeyHashOutput (pubKeyHash) {
  typeforce(types.Hash160bit, pubKeyHash)

  return compile([OPS.OP_DUP, OPS.OP_HASH160, pubKeyHash, OPS.OP_EQUALVERIFY, OPS.OP_CHECKSIG])
}

// OP_HASH160 {scriptHash} OP_EQUAL
function scriptHashOutput (scriptHash) {
  typeforce(types.Hash160bit, scriptHash)

  return compile([OPS.OP_HASH160, scriptHash, OPS.OP_EQUAL])
}

// m [pubKeys ...] n OP_CHECKMULTISIG
function multisigOutput (m, pubKeys) {
  typeforce(types.tuple(types.Number, [types.Buffer]), arguments)

  var n = pubKeys.length
  if (n < m) throw new Error('Not enough pubKeys provided')

  return compile([].concat(
    OP_INT_BASE + m,
    pubKeys,
    OP_INT_BASE + n,
    OPS.OP_CHECKMULTISIG
  ))
}

// OP_0 {pubKeyHash}
function witnessPubKeyHashOutput (pubKeyHash) {
  typeforce(types.Hash160bit, pubKeyHash)

  return compile([OPS.OP_0, pubKeyHash])
}

// OP_0 {scriptHash}
function witnessScriptHashOutput (scriptHash) {
  typeforce(types.Hash256bit, scriptHash)

  return compile([OPS.OP_0, scriptHash])
}

// {signature}
function pubKeyInput (signature) {
  typeforce(types.Buffer, signature)

  return compile([signature])
}

// {signature} {pubKey}
function pubKeyHashInput (signature, pubKey) {
  typeforce(types.tuple(types.Buffer, types.Buffer), arguments)

  return compile([signature, pubKey])
}

// <scriptSig> {serialized scriptPubKey script}
function scriptHashInput (scriptSig, scriptPubKey) {
  var scriptSigChunks = decompile(scriptSig)
  var serializedScriptPubKey = compile(scriptPubKey)

  return compile([].concat(
    scriptSigChunks,
    serializedScriptPubKey
  ))
}

// <scriptSig> {serialized scriptPubKey script}
function witnessScriptHashInput (scriptSig, scriptPubKey) {
  return scriptHashInput(scriptSig, scriptPubKey)
}

// OP_0 [signatures ...]
function multisigInput (signatures, scriptPubKey) {
  if (scriptPubKey) {
    var chunks = decompile(scriptPubKey)
    if (!isMultisigOutput(chunks)) throw new Error('Expected multisig scriptPubKey')

    var mOp = chunks[0]
    var nOp = chunks[chunks.length - 2]
    var m = mOp - OP_INT_BASE
    var n = nOp - OP_INT_BASE

    if (signatures.length < m) throw new Error('Not enough signatures provided')
    if (signatures.length > n) throw new Error('Too many signatures provided')
  }

  return compile([].concat(OPS.OP_0, signatures))
}

function nullDataOutput (data) {
  return compile([OPS.OP_RETURN, data])
}

module.exports = {
  compile: compile,
  decompile: decompile,
  fromASM: fromASM,
  toASM: toASM,

  number: require('./script_number'),

  isCanonicalPubKey: isCanonicalPubKey,
  isCanonicalSignature: isCanonicalSignature,
  isDefinedHashType: isDefinedHashType,
  isPubKeyHashInput: isPubKeyHashInput,
  isPubKeyHashOutput: isPubKeyHashOutput,
  isPubKeyInput: isPubKeyInput,
  isPubKeyOutput: isPubKeyOutput,
  isScriptHashInput: isScriptHashInput,
  isScriptHashOutput: isScriptHashOutput,
  isWitnessPubKeyHashOutput: isWitnessPubKeyHashOutput,
  isWitnessScriptHashOutput: isWitnessScriptHashOutput,
  isMultisigInput: isMultisigInput,
  isMultisigOutput: isMultisigOutput,
  isNullDataOutput: isNullDataOutput,

  classifyOutput: classifyOutput,
  classifyInput: classifyInput,
  pubKeyOutput: pubKeyOutput,
  pubKeyHashOutput: pubKeyHashOutput,
  scriptHashOutput: scriptHashOutput,
  witnessPubKeyHashOutput: witnessPubKeyHashOutput,
  witnessScriptHashInput: witnessScriptHashInput,
  witnessScriptHashOutput: witnessScriptHashOutput,

  multisigOutput: multisigOutput,
  pubKeyInput: pubKeyInput,
  pubKeyHashInput: pubKeyHashInput,
  scriptHashInput: scriptHashInput,
  multisigInput: multisigInput,
  nullDataOutput: nullDataOutput
}
