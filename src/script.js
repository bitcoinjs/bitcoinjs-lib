var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var opcodes = require('./opcodes')

function Script(buffer, chunks) {
  assert(Buffer.isBuffer(buffer), 'Expected Buffer, got ' + buffer)
  assert(Array.isArray(chunks), 'Expected Array, got ' + chunks)

  this.buffer = buffer
  this.chunks = chunks
}

// Import operations
Script.fromASM = function(asm) {
  var strChunks = asm.split(' ')

  var chunks = strChunks.map(function(strChunk) {
    if (strChunk in opcodes) {
      return opcodes[strChunk]

    } else {
      return new Buffer(strChunk, 'hex')
    }
  })

  return Script.fromChunks(chunks)
}

Script.fromBuffer = function(buffer) {
  var chunks = []

  var i = 0

  while (i < buffer.length) {
    var opcode = buffer.readUInt8(i)

    if ((opcode > opcodes.OP_0) && (opcode <= opcodes.OP_PUSHDATA4)) {
      var d = bufferutils.readPushDataInt(buffer, i)
      i += d.size

      var data = buffer.slice(i, i + d.number)
      i += d.number

      chunks.push(data)

    } else {
      chunks.push(opcode)

      i += 1
    }
  }

  return new Script(buffer, chunks)
}

Script.fromChunks = function(chunks) {
  assert(Array.isArray(chunks), 'Expected Array, got ' + chunks)

  var bufferSize = chunks.reduce(function(accum, chunk) {
    if (Buffer.isBuffer(chunk)) {
      return accum + bufferutils.pushDataSize(chunk.length) + chunk.length
    }

    return accum + 1
  }, 0.0)

  var buffer = new Buffer(bufferSize)
  var offset = 0

  chunks.forEach(function(chunk) {
    if (Buffer.isBuffer(chunk)) {
      offset += bufferutils.writePushDataInt(buffer, chunk.length, offset)

      chunk.copy(buffer, offset)
      offset += chunk.length

    } else {
      buffer.writeUInt8(chunk, offset)
      offset += 1
    }
  })

  assert.equal(offset, buffer.length, 'Could not decode chunks')
  return new Script(buffer, chunks)
}

Script.fromHex = function(hex) {
  return Script.fromBuffer(new Buffer(hex, 'hex'))
}

// Constants
Script.EMPTY = Script.fromChunks([])

// Operations
Script.prototype.getHash = function() {
  return crypto.hash160(this.buffer)
}

// FIXME: doesn't work for data chunks, maybe time to use buffertools.compare...
Script.prototype.without = function(needle) {
  return Script.fromChunks(this.chunks.filter(function(op) {
    return op !== needle
  }))
}

// Export operations
var reverseOps = []
for (var op in opcodes) {
  var code = opcodes[op]
  reverseOps[code] = op
}

Script.prototype.toASM = function() {
  return this.chunks.map(function(chunk) {
    if (Buffer.isBuffer(chunk)) {
      return chunk.toString('hex')

    } else {
      return reverseOps[chunk]
    }
  }).join(' ')
}

Script.prototype.toBuffer = function() {
  return this.buffer
}

Script.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

module.exports = Script
