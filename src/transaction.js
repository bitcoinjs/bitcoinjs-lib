var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var typeForce = require('typeforce')
var opcodes = require('./opcodes')

var Script = require('./script')

function Transaction () {
  this.version = 1
  this.locktime = 0
  this.ins = []
  this.outs = []
}

Transaction.DEFAULT_SEQUENCE = 0xffffffff
Transaction.SIGHASH_ALL = 0x01
Transaction.SIGHASH_NONE = 0x02
Transaction.SIGHASH_SINGLE = 0x03
Transaction.SIGHASH_ANYONECANPAY = 0x80

Transaction.fromBuffer = function (buffer, __disableAssert) {
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

  function readUInt64 () {
    var i = bufferutils.readUInt64LE(buffer, offset)
    offset += 8
    return i
  }

  function readVarInt () {
    var vi = bufferutils.readVarInt(buffer, offset)
    offset += vi.size
    return vi.number
  }

  function readScript () {
    return Script.fromBuffer(readSlice(readVarInt()))
  }

  function readGenerationScript () {
    return new Script(readSlice(readVarInt()), [])
  }

  var tx = new Transaction()
  tx.version = readUInt32()

  var vinLen = readVarInt()
  for (var i = 0; i < vinLen; ++i) {
    var hash = readSlice(32)

    if (Transaction.isCoinbaseHash(hash)) {
      tx.ins.push({
        hash: hash,
        index: readUInt32(),
        script: readGenerationScript(),
        sequence: readUInt32()
      })
    } else {
      tx.ins.push({
        hash: hash,
        index: readUInt32(),
        script: readScript(),
        sequence: readUInt32()
      })
    }
  }

  var voutLen = readVarInt()
  for (i = 0; i < voutLen; ++i) {
    tx.outs.push({
      value: readUInt64(),
      script: readScript()
    })
  }

  tx.locktime = readUInt32()

  if (!__disableAssert) {
    assert.equal(offset, buffer.length, 'Transaction has unexpected data')
  }

  return tx
}

Transaction.fromHex = function (hex) {
  return Transaction.fromBuffer(new Buffer(hex, 'hex'))
}

Transaction.isCoinbaseHash = function (buffer) {
  return Array.prototype.every.call(buffer, function (x) {
    return x === 0
  })
}

Transaction.prototype.addInput = function (hash, index, sequence, script) {
  if (sequence === undefined || sequence === null) {
    sequence = Transaction.DEFAULT_SEQUENCE
  }

  script = script || Script.EMPTY

  typeForce('Buffer', hash)
  typeForce('Number', index)
  typeForce('Number', sequence)
  typeForce('Script', script)

  assert.equal(hash.length, 32, 'Expected hash length of 32, got ' + hash.length)

  // Add the input and return the input's index
  return (this.ins.push({
    hash: hash,
    index: index,
    script: script,
    sequence: sequence
  }) - 1)
}

Transaction.prototype.addOutput = function (scriptPubKey, value) {
  typeForce('Script', scriptPubKey)
  typeForce('Number', value)

  // Add the output and return the output's index
  return (this.outs.push({
    script: scriptPubKey,
    value: value
  }) - 1)
}

Transaction.prototype.byteLength = function () {
  function scriptSize (script) {
    var length = script.buffer.length

    return bufferutils.varIntSize(length) + length
  }

  return (
    8 +
    bufferutils.varIntSize(this.ins.length) +
    bufferutils.varIntSize(this.outs.length) +
    this.ins.reduce(function (sum, input) { return sum + 40 + scriptSize(input.script) }, 0) +
    this.outs.reduce(function (sum, output) { return sum + 8 + scriptSize(output.script) }, 0)
  )
}

Transaction.prototype.clone = function () {
  var newTx = new Transaction()
  newTx.version = this.version
  newTx.locktime = this.locktime

  newTx.ins = this.ins.map(function (txIn) {
    return {
      hash: txIn.hash,
      index: txIn.index,
      script: txIn.script,
      sequence: txIn.sequence
    }
  })

  newTx.outs = this.outs.map(function (txOut) {
    return {
      script: txOut.script,
      value: txOut.value
    }
  })

  return newTx
}

/**
 * Hash transaction for signing a specific input.
 *
 * Bitcoin uses a different hash for each signed transaction input.
 * This method copies the transaction, makes the necessary changes based on the
 * hashType, and then hashes the result.
 * This hash can then be used to sign the provided transaction input.
 */
Transaction.prototype.hashForSignature = function (inIndex, prevOutScript, hashType) {
  typeForce('Number', inIndex)
  typeForce('Script', prevOutScript)
  typeForce('Number', hashType)

  assert(inIndex >= 0, 'Invalid vin index')
  assert(inIndex < this.ins.length, 'Invalid vin index')

  var txTmp = this.clone()
  var hashScript = prevOutScript.without(opcodes.OP_CODESEPARATOR)

  // Blank out other inputs' signatures
  txTmp.ins.forEach(function (txIn) {
    txIn.script = Script.EMPTY
  })
  txTmp.ins[inIndex].script = hashScript

  var hashTypeModifier = hashType & 0x1f

  if (hashTypeModifier === Transaction.SIGHASH_NONE) {
    assert(false, 'SIGHASH_NONE not yet supported')
  } else if (hashTypeModifier === Transaction.SIGHASH_SINGLE) {
    assert(false, 'SIGHASH_SINGLE not yet supported')
  }

  if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
    assert(false, 'SIGHASH_ANYONECANPAY not yet supported')
  }

  var hashTypeBuffer = new Buffer(4)
  hashTypeBuffer.writeInt32LE(hashType, 0)

  var buffer = Buffer.concat([txTmp.toBuffer(), hashTypeBuffer])
  return crypto.hash256(buffer)
}

Transaction.prototype.getHash = function () {
  return crypto.hash256(this.toBuffer())
}

Transaction.prototype.getId = function () {
  // TxHash is little-endian, we need big-endian
  return bufferutils.reverse(this.getHash()).toString('hex')
}

Transaction.prototype.toBuffer = function () {
  var buffer = new Buffer(this.byteLength())

  var offset = 0
  function writeSlice (slice) {
    slice.copy(buffer, offset)
    offset += slice.length
  }

  function writeUInt32 (i) {
    buffer.writeUInt32LE(i, offset)
    offset += 4
  }

  function writeUInt64 (i) {
    bufferutils.writeUInt64LE(buffer, i, offset)
    offset += 8
  }

  function writeVarInt (i) {
    var n = bufferutils.writeVarInt(buffer, i, offset)
    offset += n
  }

  writeUInt32(this.version)
  writeVarInt(this.ins.length)

  this.ins.forEach(function (txIn) {
    writeSlice(txIn.hash)
    writeUInt32(txIn.index)
    writeVarInt(txIn.script.buffer.length)
    writeSlice(txIn.script.buffer)
    writeUInt32(txIn.sequence)
  })

  writeVarInt(this.outs.length)
  this.outs.forEach(function (txOut) {
    writeUInt64(txOut.value)
    writeVarInt(txOut.script.buffer.length)
    writeSlice(txOut.script.buffer)
  })

  writeUInt32(this.locktime)

  return buffer
}

Transaction.prototype.toHex = function () {
  return this.toBuffer().toString('hex')
}

Transaction.prototype.setInputScript = function (index, script) {
  typeForce('Number', index)
  typeForce('Script', script)

  this.ins[index].script = script
}

module.exports = Transaction
