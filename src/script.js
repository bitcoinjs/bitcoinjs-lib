var bufferutils = require('./bufferutils')
var opcodes = require('./opcodes')
var typeforce = require('typeforce')
var types = require('./types')

function coerceChunks (chunks) {
  return types.Array(chunks) ? chunks : decompile(chunks)
}

function toASM (chunks) {
  chunks = coerceChunks(chunks)

  return chunks.map(function (chunk) {
    // data chunk
    if (Buffer.isBuffer(chunk)) {
      return chunk.toString('hex')

    // opcode
    } else {
      return reverseOps[chunk]
    }
  }).join(' ')
}

function fromASM (asm) {
  typeforce(types.String, asm)

  var strChunks = asm.split(' ')
  var chunks = strChunks.map(function (strChunk) {
    // opcode
    if (strChunk in opcodes) {
      return opcodes[strChunk]

    // data chunk
    } else {
      return new Buffer(strChunk, 'hex')
    }
  })

  return chunks
}

function compile (chunks) {
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
  typeforce(types.Buffer, buffer)

  var chunks = []
  var i = 0

  while (i < buffer.length) {
    var opcode = buffer.readUInt8(i)

    // data chunk
    if ((opcode > opcodes.OP_0) && (opcode <= opcodes.OP_PUSHDATA4)) {
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

var reverseOps = []
for (var op in opcodes) {
  var code = opcodes[op]
  reverseOps[code] = op
}

module.exports = {
  compile: compile,
  decompile: decompile,
  toASM: toASM,
  fromASM: fromASM
}
