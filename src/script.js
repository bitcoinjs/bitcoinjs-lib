var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var typeForce = require('typeforce')
var opcodes = require('./opcodes')

function Script (buffer, chunks) {
  typeForce('Buffer', buffer)
  typeForce('Array', chunks)

  this.buffer = buffer
  this.chunks = chunks
}

Script.fromASM = function (asm) {
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

  return Script.fromChunks(chunks)
}

Script.fromBuffer = function (buffer) {
  var chunks = []
  var i = 0

  while (i < buffer.length) {
    var opcode = buffer.readUInt8(i)

    // data chunk
    if ((opcode > opcodes.OP_0) && (opcode <= opcodes.OP_PUSHDATA4)) {
      var d = bufferutils.readPushDataInt(buffer, i)

      // did reading a pushDataInt fail? return non-chunked script
      if (d === null) return new Script(buffer, [])
      i += d.size

      // attempt to read too much data?
      if (i + d.number > buffer.length) return new Script(buffer, [])

      var data = buffer.slice(i, i + d.number)
      i += d.number

      chunks.push(data)

    // opcode
    } else {
      chunks.push(opcode)

      i += 1
    }
  }

  return new Script(buffer, chunks)
}

Script.fromChunks = function (chunks) {
  typeForce('Array', chunks)

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

  assert.equal(offset, buffer.length, 'Could not decode chunks')
  return new Script(buffer, chunks)
}

Script.fromHex = function (hex) {
  return Script.fromBuffer(new Buffer(hex, 'hex'))
}

Script.EMPTY = Script.fromChunks([])

Script.prototype.getHash = function () {
  return crypto.hash160(this.buffer)
}

// FIXME: doesn't work for data chunks, maybe time to use buffertools.compare...
Script.prototype.without = function (needle) {
  return Script.fromChunks(this.chunks.filter(function (op) {
    return op !== needle
  }))
}

var reverseOps = []
for (var op in opcodes) {
  var code = opcodes[op]
  reverseOps[code] = op
}

Script.prototype.toASM = function () {
  return this.chunks.map(function (chunk) {
    // data chunk
    if (Buffer.isBuffer(chunk)) {
      return chunk.toString('hex')

    // opcode
    } else {
      return reverseOps[chunk]
    }
  }).join(' ')
}

Script.prototype.toBuffer = function () {
  return this.buffer
}

Script.prototype.toHex = function () {
  return this.toBuffer().toString('hex')
}

module.exports = Script
