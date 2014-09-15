var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var enforceType = require('./types')
var opcodes = require('./opcodes')

var Script = require('./script')

function RawTransaction() {
  this.version = 1
  this.locktime = 0
  this.ins = []
  this.outs = []
}

RawTransaction.DEFAULT_SEQUENCE = 0xffffffff
RawTransaction.SIGHASH_ALL = 0x01
RawTransaction.SIGHASH_NONE = 0x02
RawTransaction.SIGHASH_SINGLE = 0x03
RawTransaction.SIGHASH_ANYONECANPAY = 0x80

// Static constructors
RawTransaction.fromBuffer = function(buffer) {
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
    var scriptLen = readVarInt()
    var scriptBuffer = readSlice(scriptLen)
    return Script.fromBuffer(scriptBuffer)
  }

  var tx = new RawTransaction()
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
      script: readScript()
    })
  }

  tx.locktime = readUInt32()
  assert.equal(offset, buffer.length, 'Transaction has unexpected data')

  return tx
}

RawTransaction.fromHex = function(hex) {
  return RawTransaction.fromBuffer(new Buffer(hex, 'hex'))
}

// Operations
RawTransaction.prototype.addInput = function(hash, index, sequence) {
  if (sequence === undefined) sequence = RawTransaction.DEFAULT_SEQUENCE

  enforceType('Buffer', hash)
  enforceType('Number', index)
  enforceType('Number', sequence)

  assert.equal(hash.length, 32, 'Expected hash length of 32, got ' + hash.length)

  // Add the input and return the input's index
  return (this.ins.push({
    hash: hash,
    index: index,
    script: Script.EMPTY,
    sequence: sequence
  }) - 1)
}

RawTransaction.prototype.addOutput = function(scriptPubKey, value) {
  enforceType(Script, scriptPubKey)
  enforceType('Number', value)

  // Add the output and return the output's index
  return (this.outs.push({
    script: scriptPubKey,
    value: value
  }) - 1)
}

RawTransaction.prototype.clone = function () {
  var tx = new RawTransaction()
  tx.version = this.version
  tx.locktime = this.locktime

  tx.ins = this.ins.map(function(txin) {
    return {
      hash: txin.hash,
      index: txin.index,
      script: txin.script,
      sequence: txin.sequence
    }
  })

  tx.outs = this.outs.map(function(txout) {
    return {
      script: txout.script,
      value: txout.value
    }
  })

  return tx
}

/**
 * Hash transaction for signing a specific input.
 *
 * Bitcoin uses a different hash for each signed transaction input. This
 * method copies the transaction, makes the necessary changes based on the
 * hashType, serializes and finally hashes the result. This hash can then be
 * used to sign the transaction input in question.
 */
RawTransaction.prototype.hashForSignature = function(inIndex, prevOutScript, hashType) {
  enforceType('Number', inIndex)
  enforceType(Script, prevOutScript)
  enforceType('Number', hashType)

  assert(inIndex >= 0, 'Invalid vin index')
  assert(inIndex < this.ins.length, 'Invalid vin index')

  var tx = this.clone()
  var hashScript = prevOutScript.without(opcodes.OP_CODESEPARATOR)

  // Blank out other inputs' signatures
  tx.ins.forEach(function(txin) {
    txin.script = Script.EMPTY
  })
  tx.ins[inIndex].script = hashScript

  var hashTypeModifier = hashType & 0x1f
  if (hashTypeModifier === RawTransaction.SIGHASH_NONE) {
    assert(false, 'SIGHASH_NONE not yet supported')

  } else if (hashTypeModifier === RawTransaction.SIGHASH_SINGLE) {
    assert(false, 'SIGHASH_SINGLE not yet supported')

  }

  if (hashType & RawTransaction.SIGHASH_ANYONECANPAY) {
    assert(false, 'SIGHASH_ANYONECANPAY not yet supported')
  }

  var hashTypeBuffer = new Buffer(4)
  hashTypeBuffer.writeInt32LE(hashType, 0)

  var buffer = Buffer.concat([tx.toBuffer(), hashTypeBuffer])
  return crypto.hash256(buffer)
}

RawTransaction.prototype.getHash = function () {
  return crypto.hash256(this.toBuffer())
}

RawTransaction.prototype.getId = function () {
  // TxHash is little-endian, we need big-endian
  return bufferutils.reverse(this.getHash()).toString('hex')
}

RawTransaction.prototype.setInputScript = function(index, script) {
  this.ins[index].script = script
}

// Export functions
RawTransaction.prototype.toBuffer = function () {
  var txInSize = this.ins.reduce(function(a, x) {
    return a + (40 + bufferutils.varIntSize(x.script.buffer.length) + x.script.buffer.length)
  }, 0)

  var txOutSize = this.outs.reduce(function(a, x) {
    return a + (8 + bufferutils.varIntSize(x.script.buffer.length) + x.script.buffer.length)
  }, 0)

  var buffer = new Buffer(
    8 +
    bufferutils.varIntSize(this.ins.length) +
    bufferutils.varIntSize(this.outs.length) +
    txInSize +
    txOutSize
  )

  var offset = 0
  function writeSlice(slice) {
    slice.copy(buffer, offset)
    offset += slice.length
  }
  function writeUInt32(i) {
    buffer.writeUInt32LE(i, offset)
    offset += 4
  }
  function writeUInt64(i) {
    bufferutils.writeUInt64LE(buffer, i, offset)
    offset += 8
  }
  function writeVarInt(i) {
    var n = bufferutils.writeVarInt(buffer, i, offset)
    offset += n
  }

  writeUInt32(this.version)
  writeVarInt(this.ins.length)

  this.ins.forEach(function(txin) {
    writeSlice(txin.hash)
    writeUInt32(txin.index)
    writeVarInt(txin.script.buffer.length)
    writeSlice(txin.script.buffer)
    writeUInt32(txin.sequence)
  })

  writeVarInt(this.outs.length)
  this.outs.forEach(function(txout) {
    writeUInt64(txout.value)
    writeVarInt(txout.script.buffer.length)
    writeSlice(txout.script.buffer)
  })

  writeUInt32(this.locktime)

  return buffer
}

RawTransaction.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

module.exports = RawTransaction
