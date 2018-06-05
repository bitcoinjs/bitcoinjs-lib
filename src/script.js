const Buffer = require('safe-buffer').Buffer
const bip66 = require('bip66')
const ecc = require('tiny-secp256k1')
const pushdata = require('pushdata-bitcoin')
const typeforce = require('typeforce')
const types = require('./types')
const scriptNumber = require('./script_number')

const OPS = require('bitcoin-ops')
const REVERSE_OPS = require('bitcoin-ops/map')
const OP_INT_BASE = OPS.OP_RESERVED // OP_1 - 1

function isOPInt (value) {
  return types.Number(value) &&
    ((value === OPS.OP_0) ||
    (value >= OPS.OP_1 && value <= OPS.OP_16) ||
    (value === OPS.OP_1NEGATE))
}

function isPushOnlyChunk (value) {
  return types.Buffer(value) || isOPInt(value)
}

function isPushOnly (value) {
  return types.Array(value) && value.every(isPushOnlyChunk)
}

function asMinimalOP (buffer) {
  if (buffer.length === 0) return OPS.OP_0
  if (buffer.length !== 1) return
  if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0]
  if (buffer[0] === 0x81) return OPS.OP_1NEGATE
}

function compile (chunks) {
  // TODO: remove me
  if (Buffer.isBuffer(chunks)) return chunks

  typeforce(types.Array, chunks)

  const bufferSize = chunks.reduce(function (accum, chunk) {
    // data chunk
    if (Buffer.isBuffer(chunk)) {
      // adhere to BIP62.3, minimal push policy
      if (chunk.length === 1 && asMinimalOP(chunk) !== undefined) {
        return accum + 1
      }

      return accum + pushdata.encodingLength(chunk.length) + chunk.length
    }

    // opcode
    return accum + 1
  }, 0.0)

  const buffer = Buffer.allocUnsafe(bufferSize)
  let offset = 0

  chunks.forEach(function (chunk) {
    // data chunk
    if (Buffer.isBuffer(chunk)) {
      // adhere to BIP62.3, minimal push policy
      const opcode = asMinimalOP(chunk)
      if (opcode !== undefined) {
        buffer.writeUInt8(opcode, offset)
        offset += 1
        return
      }

      offset += pushdata.encode(buffer, chunk.length, offset)
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

  const chunks = []
  let i = 0

  while (i < buffer.length) {
    const opcode = buffer[i]

    // data chunk
    if ((opcode > OPS.OP_0) && (opcode <= OPS.OP_PUSHDATA4)) {
      const d = pushdata.decode(buffer, i)

      // did reading a pushDataInt fail?
      if (d === null) return null
      i += d.size

      // attempt to read too much data?
      if (i + d.number > buffer.length) return null

      const data = buffer.slice(i, i + d.number)
      i += d.number

      // decompile minimally
      const op = asMinimalOP(data)
      if (op !== undefined) {
        chunks.push(op)
      } else {
        chunks.push(data)
      }

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
    if (Buffer.isBuffer(chunk)) {
      const op = asMinimalOP(chunk)
      if (op === undefined) return chunk.toString('hex')
      chunk = op
    }

    // opcode!
    return REVERSE_OPS[chunk]
  }).join(' ')
}

function fromASM (asm) {
  typeforce(types.String, asm)

  return compile(asm.split(' ').map(function (chunkStr) {
    // opcode?
    if (OPS[chunkStr] !== undefined) return OPS[chunkStr]
    typeforce(types.Hex, chunkStr)

    // data!
    return Buffer.from(chunkStr, 'hex')
  }))
}

function toStack (chunks) {
  chunks = decompile(chunks)
  typeforce(isPushOnly, chunks)

  return chunks.map(function (op) {
    if (Buffer.isBuffer(op)) return op
    if (op === OPS.OP_0) return Buffer.allocUnsafe(0)

    return scriptNumber.encode(op - OP_INT_BASE)
  })
}

function isCanonicalPubKey (buffer) {
  return ecc.isPoint(buffer)
}

function isDefinedHashType (hashType) {
  const hashTypeMod = hashType & ~0x80

  // return hashTypeMod > SIGHASH_ALL && hashTypeMod < SIGHASH_SINGLE
  return hashTypeMod > 0x00 && hashTypeMod < 0x04
}

function isCanonicalScriptSignature (buffer) {
  if (!Buffer.isBuffer(buffer)) return false
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false

  return bip66.check(buffer.slice(0, -1))
}

module.exports = {
  compile: compile,
  decompile: decompile,
  fromASM: fromASM,
  toASM: toASM,
  toStack: toStack,

  number: require('./script_number'),
  signature: require('./script_signature'),

  isCanonicalPubKey: isCanonicalPubKey,
  isCanonicalScriptSignature: isCanonicalScriptSignature,
  isPushOnly: isPushOnly,
  isDefinedHashType: isDefinedHashType
}
