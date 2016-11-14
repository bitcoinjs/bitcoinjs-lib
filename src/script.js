var bip66 = require('bip66')
var bufferutils = require('./bufferutils')
var typeforce = require('typeforce')
var types = require('./types')
var scriptNumber = require('./script_number')
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

function decompilePushOnly (script) {
  return decompile(script).map(function (op) {
    if (op instanceof Buffer) {
      return op
    }

    if (op === OPS.OP_0) {
      return new Buffer(0)
    } else if (op === OPS.OP_1NEGATE || op >= OPS.OP_1 && op <= OPS.OP_16) {
      return scriptNumber.encode(op - OP_INT_BASE)
    } else {
      throw new Error('Can only evaluate push-only opcodes')
    }
  })
}

function compilePushOnly (set) {
  return compile(set.map(function (op) {
    if (op.length === 0) {
      return OPS.OP_0
    }

    if (op.length === 1) {
      if (op[0] === 0x81) {
        return OPS.OP_1NEGATE
      } else if (op[0] >= 1 && op[0] <= OPS.OP_16) {
        return op[0] + OP_INT_BASE
      }
    }

    return op
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

module.exports = {
  compile: compile,
  decompile: decompile,
  fromASM: fromASM,
  toASM: toASM,
  compilePushOnly: compilePushOnly,
  decompilePushOnly: decompilePushOnly,
  number: require('./script_number'),

  isCanonicalPubKey: isCanonicalPubKey,
  isCanonicalSignature: isCanonicalSignature,
  isDefinedHashType: isDefinedHashType
}

var templates = require('./templates')
for (var key in templates) {
  module.exports[key] = templates[key]
}
