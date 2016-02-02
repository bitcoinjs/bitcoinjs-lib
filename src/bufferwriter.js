var bufferutils = require('./bufferutils')
var typeforce = require('typeforce')
var types = require('./types')

var BufferWriter = function (length) {
  typeforce(types.tuple(types.Number), arguments)
  this.buffer = new Buffer(length)
  this.offset = 0
}

BufferWriter.prototype.writeSlice = function (slice) {
  slice.copy(this.buffer, this.offset)
  this.offset += slice.length

  return this
}

BufferWriter.prototype.writeSliceWithVarInt = function (script) {
  this.writeVarInt(script.length)
  this.writeSlice(script)

  return this
}

BufferWriter.prototype.writeScript = BufferWriter.prototype.writeSliceWithVarInt

BufferWriter.prototype.writeInt = function (i) {
  this.buffer.writeUInt8(i, this.offset)
  this.offset += 1

  return this
}

BufferWriter.prototype.writeUInt64 = function (i) {
  bufferutils.writeUInt64LE(this.buffer, i, this.offset)
  this.offset += 8

  return this
}

BufferWriter.prototype.writeUInt32 = function (i) {
  this.buffer.writeUInt32LE(i, this.offset)
  this.offset += 4

  return this
}

BufferWriter.prototype.writeVarInt = function (i) {
  var n = bufferutils.writeVarInt(this.buffer, i, this.offset)
  this.offset += n

  return this
}

module.exports = BufferWriter
