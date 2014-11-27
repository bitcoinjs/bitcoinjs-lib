var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')

var Transaction = require('./transaction')
var Script = require('./script')

function Block() {
  this.version = 1
  this.prevHash = null
  this.merkleRoot = null
  this.timestamp = 0
  this.bits = 0
  this.nonce = 0
}

Block.fromBuffer = function(buffer) {
  assert(buffer.length >= 80, 'Buffer too small (< 80 bytes)')

  var offset = 0
  function readSlice(n) {
    offset += n
    return buffer.slice(offset - n, offset)
  }

  function readUInt32() {
    var i = buffer.readUInt32LE(offset)
    offset += 4
    return i
  }

  var block = new Block()
  block.version = readUInt32()
  block.prevHash = readSlice(32)
  block.merkleRoot = readSlice(32)
  block.timestamp = readUInt32()
  block.bits = readUInt32()
  block.nonce = readUInt32()

  if (buffer.length === 80) return block

  function readUInt64() {
    var i = bufferutils.readUInt64LE(buffer, offset)
    offset += 8
    return i
  }

  function readVarInt() {
    var vi = bufferutils.readVarInt(buffer, offset)
    offset += vi.size
    return vi.number
  }

  function readScript() {
    return Script.fromBuffer(readSlice(readVarInt()))
  }

  function readTransaction() {
    var tx = new Transaction()
    tx.version = readUInt32()

    var vinLen = readVarInt()
    for (var i = 0; i < vinLen; ++i) {
      tx.ins.push({
        hash: readSlice(32),
        index: readUInt32(),
        script: readScript(),
        sequence: readUInt32()
      })
    }

    var voutLen = readVarInt()
    for (i = 0; i < voutLen; ++i) {
      tx.outs.push({
        value: readUInt64(),
        script: readScript(),
      })
    }

    tx.locktime = readUInt32()

    return tx
  }

  var nTransactions = readVarInt()
  block.transactions = []

  for (var i = 0; i < nTransactions; ++i) {
    var tx = readTransaction()
    block.transactions.push(tx)
  }

  return block
}

Block.fromHex = function(hex) {
  return Block.fromBuffer(new Buffer(hex, 'hex'))
}

Block.prototype.getHash = function() {
  return crypto.hash256(this.toBuffer(true))
}

Block.prototype.getId = function() {
  return bufferutils.reverse(this.getHash()).toString('hex')
}

Block.prototype.getUTCDate = function() {
  var date = new Date(0) // epoch
  date.setUTCSeconds(this.timestamp)

  return date
}

Block.prototype.toBuffer = function(headersOnly) {
  var buffer = new Buffer(80)

  var offset = 0
  function writeSlice(slice) {
    slice.copy(buffer, offset)
    offset += slice.length
  }

  function writeUInt32(i) {
    buffer.writeUInt32LE(i, offset)
    offset += 4
  }

  writeUInt32(this.version)
  writeSlice(this.prevHash)
  writeSlice(this.merkleRoot)
  writeUInt32(this.timestamp)
  writeUInt32(this.bits)
  writeUInt32(this.nonce)

  if (headersOnly || !this.transactions) return buffer

  var txLenBuffer = bufferutils.varIntBuffer(this.transactions.length)
  var txBuffers = this.transactions.map(function(tx) {
    return tx.toBuffer()
  })

  return Buffer.concat([buffer, txLenBuffer].concat(txBuffers))
}

Block.prototype.toHex = function(headersOnly) {
  return this.toBuffer(headersOnly).toString('hex')
}

module.exports = Block
