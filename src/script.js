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

var LIST_DECODE_NAMES = [
  decodePubKeyOutput,
  decodePubKeyHashOutput,
  decodeMultisigOutput,
  decodeNullDataOutput,
  decodeScriptHashOutput,
  decodeWitnessPubKeyHashOutput,
  decodeWitnessScriptHashOutput
]

var OP_INT_BASE = OPS.OP_RESERVED // OP_1 - 1

function compile (chunks) {
  // TODO: remove me
  if (Buffer.isBuffer(chunks)) return chunks

  typeforce(types.Array, chunks)

  var bufferSize = chunks.reduce(function (accum, chunk) {
    // data chunk
    if (Buffer.isBuffer(chunk)) {
      // adhere to BIP62.3, minimal push policy
      if (chunk.length === 1 && chunk[0] >= 1 && chunk[0] <= 16) {
        return accum + 1
      }

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
      // adhere to BIP62.3, minimal push policy
      if (chunk.length === 1 && chunk[0] >= 1 && chunk[0] <= 16) {
        var opcode = OP_INT_BASE + chunk[0]
        buffer.writeUInt8(opcode, offset)
        offset += 1
        return
      }

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

function isDefinedHashType (hashType) {
  var hashTypeMod = hashType & ~0x80

// return hashTypeMod > SIGHASH_ALL && hashTypeMod < SIGHASH_SINGLE
  return hashTypeMod > 0x00 && hashTypeMod < 0x04
}

function isCanonicalSignature (buffer) {
  if (!Buffer.isBuffer(buffer)) return false
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false

  return bip66.check(buffer.slice(0, -1))
}

function isPubKeyHashInput (script) {
  var chunks = decompile(script)

  return chunks.length === 2 &&
    isCanonicalSignature(chunks[0]) &&
    isCanonicalPubKey(chunks[1])
}

function decodePubKeyHashOutput (buffer, chunks) {
  if (buffer.length !== 25) {
    throw new Error('pub-key-hash output script is 25 bytes')
  }
  if (buffer[0] !== OPS.OP_DUP) {
    throw new Error('PubKeyHash script missing OP_DUP')
  }
  if (buffer[1] !== OPS.OP_HASH160) {
    throw new Error('PubKeyHash script missing OP_HASH160')
  }
  if (buffer[2] !== 0x14) {
    throw new Error('Incorrect opcode for pubkeyhash')
  }
  if (buffer[23] !== OPS.OP_EQUALVERIFY) {
    throw new Error('PubKeyHash script missing OP_EQUALVERIFY')
  }
  if (buffer[24] !== OPS.OP_CHECKSIG) {
    throw new Error('PubKeyHash script missing OP_CHECKSIG')
  }

  return {
    type: 'pubkeyhash',
    pubKeyHash: chunks[2]
  }
}

function isPubKeyHashOutput (script) {
  return determinesTypeOrNonstandard([decodePubKeyHashOutput], script) === 'pubkeyhash'
}

function isPubKeyInput (script) {
  var chunks = decompile(script)

  return chunks.length === 1 &&
    isCanonicalSignature(chunks[0])
}

function decodePubKeyOutput (script, chunks) {
  if (script[0] !== 0x21 && script[0] !== 0x41) {
    throw new Error('Bad (or non-minimal) public key length for pub')
  }
  if (!isCanonicalPubKey(chunks[0])) {
    throw new Error('pub-key output does not have a canonical public key')
  }
  if (chunks[1] !== OPS.OP_CHECKSIG) {
    throw new Error('pub-key output missing OP_CHECKSIG operator')
  }
  if (chunks.length !== 2) {
    throw new Error('pub-key output has two elements')
  }
  return {
    type: 'pubkey',
    publicKey: chunks[0]
  }
}

function isPubKeyOutput (script) {
  return determinesTypeOrNonstandard([decodePubKeyOutput], script) === 'pubkey'
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

  return classifyInput(scriptSigChunks, allowIncomplete) === classifyOutput(lastChunk)
}

function decodeScriptHashOutput (chunks) {
  if (chunks[0] !== OPS.OP_HASH160) {
    throw new Error()
  }
  if (chunks[1] !== 0x14) {
    throw new Error()
  }
  if (chunks[22] !== OPS.OP_EQUAL) {
    throw new Error()
  }
  return {
    type: 'scripthash',
    scriptHash: chunks[1]
  }
}

function isScriptHashOutput (script) {
  return determinesTypeOrNonstandard([decodeScriptHashOutput], script) === 'scripthash'
}

function decodeWitnessPubKeyHashOutput (script, chunks) {
  if (script.length !== 22) {
    throw new Error('P2WPKH script should be 22 bytes')
  }
  if (script[0] !== OPS.OP_0) {
    throw new Error('Missing v0 prefix for witness keyhash')
  }
  if (script[1] !== 0x14) {
    throw new Error('Witness keyhash length marker is wrong')
  }

  return {
    type: 'witnesspubkeyhash',
    witnessKeyHash: chunks[2]
  }
}

function isWitnessPubKeyHashOutput (script) {
  return determinesTypeOrNonstandard([decodeWitnessPubKeyHashOutput], script) === 'witnesspubkeyhash'
}

function decodeWitnessScriptHashOutput (script, chunks) {
  if (script.length !== 34) {
    throw new Error('P2WSH script should be 34 bytes')
  }
  if (script[0] !== OPS.OP_0) {
    throw new Error('Missing v0 prefix for witness script hash')
  }
  if (script[1] !== 0x20) {
    throw new Error('Witness program length marker is wrong')
  }

  return {
    type: 'witnessscripthash',
    witnessScriptHash: chunks[2]
  }
}

function isWitnessScriptHashOutput (script) {
  return determinesTypeOrNonstandard([decodeWitnessScriptHashOutput], script) === 'witnessscripthash'
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

function decodeMultisigOutput (scriptPubKey, chunks) {
  if (chunks.length < 4) {
    throw new Error('Multisig script should contain at least 4 elements')
  }
  if (chunks[chunks.length - 1] !== OPS.OP_CHECKMULTISIG) {
    throw new Error('Final opcode should be OP_CHECKMULTISIG')
  }
  if (!types.Number(chunks[0])) {
    throw new Error('First element must be a number-push opcode')
  }
  if (!types.Number(chunks[chunks.length - 2])) {
    throw new Error('Second-last element must be a number-push opcode')
  }
  var m = chunks[0] - OP_INT_BASE
  var n = chunks[chunks.length - 2] - OP_INT_BASE

  if (m <= 0) {
    throw new Error('Number of signatures required must be greater than zero')
  }
  if (n > 16) {
    throw new Error('Number of public keys must be less than 17')
  }
  if (m > n) {
    throw new Error('Number of signatures cannot exceed the number of public keys')
  }
  if (n !== chunks.length - 3) {
    throw new Error('n does not match the number of public keys')
  }

  var keys = chunks.slice(1, -2)
  if (!keys.every(isCanonicalPubKey)) {
    throw new Error('Non-canonical pubic key found')
  }

  return {
    type: 'multisig',
    nRequiredSigs: m,
    nPublicKeys: n,
    publicKeyBuffers: keys
  }
}

function isMultisigOutput (script) {
  return determinesTypeOrNonstandard([decodeMultisigOutput], script) === 'multisig'
}

function isNullDataOutput (script) {
  return determinesTypeOrNonstandard([decodeNullDataOutput], script) === 'nulldata'
}

function decodeNullDataOutput (script, chunks) {
  if (script[0] !== OPS.OP_RETURN) {
    throw new Error('Missing OP_RETURN at start of script')
  }

  return {
    type: 'nulldata'
  }
}

function determinesTypeOrNonstandard (functions, script) {
  if (!types.Array(functions)) {
    throw new Error('Must provide an array of functions to determinesTypeOrNonstandard')
  }
  if (!types.Buffer(script)) {
    throw new Error('Must provide a script to determinesTypeOrNonstandard')
  }
  var decoded
  var decompiled = decompile(script)
  var type = 'nonstandard'
  for (var i = 0; i < functions.length && type === 'nonstandard'; i++) {
    try {
      decoded = functions[i](script, decompiled)
      type = decoded.type
    } catch (e) {

    }
  }

  return type
}

function classifyOutput (script) {
  return determinesTypeOrNonstandard(LIST_DECODE_NAMES, script)
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
    var scriptData = decodeMultisigOutput(scriptPubKey, decompile(scriptPubKey))
    if (signatures.length < scriptData.nRequiredSigs) throw new Error('Not enough signatures provided')
    if (signatures.length > scriptData.nPublicKeys) throw new Error('Too many signatures provided')
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

  decodePubKeyOutput: decodePubKeyOutput,
  decodePubKeyHashOutput: decodePubKeyHashOutput,
  decodeMultisigOutput: decodeMultisigOutput,
  decodeScriptHashOutput: decodeScriptHashOutput,
  decodeNullDataOutput: decodeNullDataOutput,
  decodeWitnessPubKeyHashOutput: decodeWitnessPubKeyHashOutput,
  decodeWitnessScriptHashOutput: decodeWitnessScriptHashOutput,

  isPubKeyOutput: isPubKeyOutput,
  isPubKeyHashOutput: isPubKeyHashOutput,
  isMultisigOutput: isMultisigOutput,
  isScriptHashOutput: isScriptHashOutput,
  isNullDataOutput: isNullDataOutput,
  isWitnessPubKeyHashOutput: isWitnessPubKeyHashOutput,
  isWitnessScriptHashOutput: isWitnessScriptHashOutput,
  classifyOutput: classifyOutput,

  isPubKeyInput: isPubKeyInput,
  isPubKeyHashInput: isPubKeyHashInput,
  isMultisigInput: isMultisigInput,
  isScriptHashInput: isScriptHashInput,
  classifyInput: classifyInput,

  pubKeyOutput: pubKeyOutput,
  pubKeyHashOutput: pubKeyHashOutput,
  multisigOutput: multisigOutput,
  scriptHashOutput: scriptHashOutput,
  nullDataOutput: nullDataOutput,
  witnessPubKeyHashOutput: witnessPubKeyHashOutput,
  witnessScriptHashOutput: witnessScriptHashOutput,

  pubKeyInput: pubKeyInput,
  pubKeyHashInput: pubKeyHashInput,
  multisigInput: multisigInput,
  scriptHashInput: scriptHashInput,
  witnessScriptHashInput: witnessScriptHashInput
}
