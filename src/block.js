var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')

var Transaction = require('./transaction')

function Block () {
  this.version = 1
  this.prevHash = null
  this.merkleRoot = null
  this.timestamp = 0
  this.bits = 0
  this.nonce = 0
}

Block.fromBuffer = function (buffer, network) {
  assert(buffer.length >= 80, 'Buffer too small (< 80 bytes)')

  var offset = 0
  function readSlice (n) {
    offset += n
    return buffer.slice(offset - n, offset)
  }

  function readUInt32 () {
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

  function readVarInt () {
    var vi = bufferutils.readVarInt(buffer, offset)
    offset += vi.size
    return vi.number
  }

  // FIXME: poor performance
  function readTransaction () {
    var tx = Transaction.fromBuffer(buffer.slice(offset), true, network)

    offset += tx.toBuffer().length
    return tx
  }

  var nTransactions = readVarInt()
  block.transactions = []

  for (var i = 0; i < nTransactions; ++i) {
    var tx = readTransaction()
    block.transactions.push(tx)
  }

  // Read block signature (vchBlockSig) for PoS coins.
  block.blockSig = null
  if (offset < buffer.length) {
    var blockSigSize = readVarInt()
    block.blockSig = readSlice(blockSigSize)
  }

  return block
}

Block.fromHex = function (hex, network) {
  return Block.fromBuffer(new Buffer(hex, 'hex'), network)
}

Block.prototype.getHash = function () {
  return crypto.hash256(this.toBuffer(true))
}

Block.prototype.getId = function () {
  return bufferutils.reverse(this.getHash()).toString('hex')
}

Block.prototype.getUTCDate = function () {
  var date = new Date(0) // epoch
  date.setUTCSeconds(this.timestamp)

  return date
}

Block.prototype.toBuffer = function (headersOnly) {
  var buffer = new Buffer(80)

  var offset = 0
  function writeSlice (slice) {
    slice.copy(buffer, offset)
    offset += slice.length
  }

  function writeUInt32 (i) {
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
  var txBuffers = this.transactions.map(function (tx) {
    return tx.toBuffer()
  })

  var ret = Buffer.concat([buffer, txLenBuffer].concat(txBuffers))

  // Block Signature.
  if (this.blockSig) {
    var blockSigLenBuffer = bufferutils.varIntBuffer(this.blockSig.length)
    ret = Buffer.concat([ret, blockSigLenBuffer, this.blockSig])
  }

  return ret
}

Block.prototype.toHex = function (headersOnly) {
  return this.toBuffer(headersOnly).toString('hex')
}

module.exports = Block
