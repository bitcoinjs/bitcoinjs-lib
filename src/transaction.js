var bcrypto = require('./crypto')
var bscript = require('./script')
var bufferutils = require('./bufferutils')
var opcodes = require('./opcodes')
var typeforce = require('typeforce')
var types = require('./types')

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

Transaction.fromBuffer = function (buffer, __noStrict) {
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
    return readSlice(readVarInt())
  }

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
      script: readScript()
    })
  }

  tx.locktime = readUInt32()

  if (__noStrict) return tx
  if (offset !== buffer.length) throw new Error('Transaction has unexpected data')

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

var EMPTY_SCRIPT = new Buffer(0)

Transaction.prototype.addInput = function (hash, index, sequence, scriptSig) {
  typeforce(types.tuple(
    types.Hash256bit,
    types.UInt32,
    types.maybe(types.UInt32),
    types.maybe(types.Buffer)
  ), arguments)

  if (types.Null(sequence)) {
    sequence = Transaction.DEFAULT_SEQUENCE
  }

  // Add the input and return the input's index
  return (this.ins.push({
    hash: hash,
    index: index,
    script: scriptSig || EMPTY_SCRIPT,
    sequence: sequence
  }) - 1)
}

Transaction.prototype.addOutput = function (scriptPubKey, value) {
  typeforce(types.tuple(types.Buffer, types.UInt53), arguments)

  // Add the output and return the output's index
  return (this.outs.push({
    script: scriptPubKey,
    value: value
  }) - 1)
}

Transaction.prototype.byteLength = function () {
  function scriptSize (someScript) {
    var length = someScript.length

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

var ONE = new Buffer('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
var VALUE_UINT64_MAX = new Buffer('ffffffffffffffff', 'hex')

/**
 * Hash transaction for signing a specific input.
 *
 * Bitcoin uses a different hash for each signed transaction input.
 * This method copies the transaction, makes the necessary changes based on the
 * hashType, and then hashes the result.
 * This hash can then be used to sign the provided transaction input.
 */
Transaction.prototype.hashForSignature = function (inIndex, prevOutScript, hashType) {
  typeforce(types.tuple(types.UInt32, types.Buffer, /* types.UInt8 */ types.Number), arguments)

  // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L29
  if (inIndex >= this.ins.length) return ONE

  var txTmp = this.clone()

  // in case concatenating two scripts ends up with two codeseparators,
  // or an extra one at the end, this prevents all those possible incompatibilities.
  var hashScript = bscript.compile(bscript.decompile(prevOutScript).filter(function (x) {
    return x !== opcodes.OP_CODESEPARATOR
  }))
  var i

  // blank out other inputs' signatures
  txTmp.ins.forEach(function (input) { input.script = EMPTY_SCRIPT })
  txTmp.ins[inIndex].script = hashScript

  // blank out some of the inputs
  if ((hashType & 0x1f) === Transaction.SIGHASH_NONE) {
    // wildcard payee
    txTmp.outs = []

    // let the others update at will
    txTmp.ins.forEach(function (input, i) {
      if (i !== inIndex) {
        input.sequence = 0
      }
    })
  } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE) {
    var nOut = inIndex

    // only lock-in the txOut payee at same index as txIn
    // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L60
    if (nOut >= this.outs.length) return ONE

    txTmp.outs = txTmp.outs.slice(0, nOut + 1)

    // blank all other outputs (clear scriptPubKey, value === -1)
    var stubOut = {
      script: EMPTY_SCRIPT,
      valueBuffer: VALUE_UINT64_MAX
    }

    for (i = 0; i < nOut; i++) {
      txTmp.outs[i] = stubOut
    }

    // let the others update at will
    txTmp.ins.forEach(function (input, i) {
      if (i !== inIndex) {
        input.sequence = 0
      }
    })
  }

  // blank out other inputs completely, not recommended for open transactions
  if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
    txTmp.ins[0] = txTmp.ins[inIndex]
    txTmp.ins = txTmp.ins.slice(0, 1)
  }

  // serialize and hash
  var buffer = new Buffer(txTmp.byteLength() + 4)
  buffer.writeInt32LE(hashType, buffer.length - 4)
  txTmp.toBuffer().copy(buffer, 0)

  return bcrypto.hash256(buffer)
}

Transaction.prototype.getHash = function () {
  return bcrypto.hash256(this.toBuffer())
}

Transaction.prototype.getId = function () {
  // transaction hash's are displayed in reverse order
  return [].reverse.call(this.getHash()).toString('hex')
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
    writeVarInt(txIn.script.length)
    writeSlice(txIn.script)
    writeUInt32(txIn.sequence)
  })

  writeVarInt(this.outs.length)
  this.outs.forEach(function (txOut) {
    if (!txOut.valueBuffer) {
      writeUInt64(txOut.value)
    } else {
      writeSlice(txOut.valueBuffer)
    }

    writeVarInt(txOut.script.length)
    writeSlice(txOut.script)
  })

  writeUInt32(this.locktime)

  return buffer
}

Transaction.prototype.toHex = function () {
  return this.toBuffer().toString('hex')
}

Transaction.prototype.setInputScript = function (index, scriptSig) {
  typeforce(types.tuple(types.Number, types.Buffer), arguments)

  this.ins[index].script = scriptSig
}

module.exports = Transaction
