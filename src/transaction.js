var bcrypto = require('./crypto')
var bscript = require('./script')
var bufferutils = require('./bufferutils')
var bufferReverse = require('buffer-reverse')
var opcodes = require('./opcodes')
var typeforce = require('typeforce')
var types = require('./types')
var BufferWriter = require('./bufferwriter')

var ADVANCED_TRANSACTION_MARKER = 0
var ADVANCED_TRANSACTION_FLAG = 1

function Transaction () {
  this.version = 1
  this.marker = null
  this.flag = null
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

  function readInt () {
    var i = buffer.readUInt8(offset)
    offset += 1

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

  // console.log('fromBuffer')

  var tx = new Transaction()
  tx.version = readUInt32()

  tx.marker = readInt()
  tx.flag = readInt()

  // check if transaction is advanced (segwit) format
  if (tx.marker === ADVANCED_TRANSACTION_MARKER && tx.flag === ADVANCED_TRANSACTION_FLAG) {
    // -
  } else {
    // undo the reading of the marker and flag byte
    offset -= 2
    tx.marker = null
    tx.flag = null
  }

  var vinLen = readVarInt()
  for (var i = 0; i < vinLen; ++i) {
    tx.ins.push({
      hash: readSlice(32),
      index: readUInt32(),
      script: readScript(),
      sequence: readUInt32(),
      witness: undefined
    })
  }

  var voutLen = readVarInt()
  for (i = 0; i < voutLen; ++i) {
    tx.outs.push({
      value: readUInt64(),
      script: readScript()
    })
  }

  if (tx.flag === ADVANCED_TRANSACTION_FLAG) {
    for (i = 0; i < vinLen; ++i) {
      tx.ins[i].witness = []
      var witnessLen = readVarInt()
      for (var x = 0; x < witnessLen; ++x) {
        tx.ins[i].witness.push(readScript())
      }
    }
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

Transaction.prototype.addInput = function (hash, index, sequence, scriptSig, witness) {
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
    sequence: sequence,
    witness: witness
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

Transaction.prototype.byteLength = function (withWitness) {
  function scriptSize (someScript) {
    var length = someScript.length

    return bufferutils.varIntSize(length) + length
  }

  var witnessLength = 0
  var advancedTxMarkerFlagLength = 0

  if (this.flag === ADVANCED_TRANSACTION_FLAG && withWitness) {
    advancedTxMarkerFlagLength = 2
    witnessLength = this.ins.reduce(function (sum, txIn) {
      var witness = txIn.witness || []

      return sum + bufferutils.varIntSize(witness.length) + witness.reduce(function (sum, witnessChunk) {
        return sum + scriptSize(witnessChunk)
      }, 0)
    }, 0)
  }

  return (
    8 +
    advancedTxMarkerFlagLength +
    bufferutils.varIntSize(this.ins.length) +
    bufferutils.varIntSize(this.outs.length) +
    this.ins.reduce(function (sum, input) { return sum + 40 + scriptSize(input.script) }, 0) +
    this.outs.reduce(function (sum, output) { return sum + 8 + scriptSize(output.script) }, 0) +
    witnessLength
  )
}

Transaction.prototype.clone = function () {
  var newTx = new Transaction()
  newTx.version = this.version
  newTx.locktime = this.locktime
  newTx.marker = this.marker
  newTx.flag = this.flag

  newTx.ins = this.ins.map(function (txIn) {
    return {
      hash: txIn.hash,
      index: txIn.index,
      script: txIn.script,
      sequence: txIn.sequence,
      witness: txIn.witness ? txIn.witness.slice() : txIn.witness
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
Transaction.prototype.hashForSignature = function (inIndex, prevOutScript, hashType, segWit, amount) {
  typeforce(types.tuple(types.UInt32, types.Buffer, /* types.UInt8 */ types.Number, types.maybe(types.Boolean)), arguments)

  if (segWit) {
    return this.hashForSignatureV2(inIndex, prevOutScript, amount, hashType)
  } else {
    return this.hashForSignatureV1(inIndex, prevOutScript, hashType)
  }
}

Transaction.prototype.hashForSignatureV2 = function (inIndex, prevOutScript, amount, hashType) {
  var hashPrevouts = new Buffer(((new Array(32 + 1)).join('00')), 'hex')
  var hashSequence = new Buffer(((new Array(32 + 1)).join('00')), 'hex')
  var hashOutputs = new Buffer(((new Array(32 + 1)).join('00')), 'hex')

  function txOutToBuffer (txOut) {
    var bufferWriter = new BufferWriter(8 + bufferutils.varIntSize(txOut.script.length) + txOut.script.length)

    bufferWriter.writeUInt64(txOut.value)
    bufferWriter.writeScript(txOut.script)

    return bufferWriter.buffer
  }

  if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
    hashPrevouts = bcrypto.hash256(Buffer.concat(this.ins.map(function (txIn) {
      var bufferWriter = new BufferWriter(36)

      bufferWriter.writeSlice(txIn.hash)
      bufferWriter.writeUInt32(txIn.index)

      return bufferWriter.buffer
    })))
  }

  if (!(hashType & Transaction.SIGHASH_ANYONECANPAY) && (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE && (hashType & 0x1f) !== Transaction.SIGHASH_NONE) {
    hashSequence = bcrypto.hash256(Buffer.concat(this.ins.map(function (txIn) {
      var bufferWriter = new BufferWriter(4)

      bufferWriter.writeUInt32(txIn.sequence)

      // console.log(txIn.sequence, bufferWriter.buffer.toString('hex'))

      return bufferWriter.buffer
    })))
  }

  if ((hashType & 0x1f) !== Transaction.SIGHASH_SINGLE && (hashType & 0x1f) !== Transaction.SIGHASH_NONE) {
    hashOutputs = bcrypto.hash256(Buffer.concat(this.outs.map(function (txOut) {
      return txOutToBuffer(txOut)
    })))
  } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE && inIndex < this.outs.length) {
    hashOutputs = bcrypto.hash256(txOutToBuffer(this.outs[inIndex]))
  }

  // console.log('hashPrevouts', hashPrevouts.toString('hex'))
  // console.log('hashSequence', hashSequence.toString('hex'))
  // console.log('hashOutputs', hashOutputs.toString('hex'))

  // TODO: cache hashPrevouts, hashSequence and hashOutputs for all signatures in a transaction

  var bufferWriter = new BufferWriter(4 + 32 + 32 + 32 + 4 + bufferutils.varIntSize(prevOutScript.length) + prevOutScript.length + 8 + 4 + 32 + 4 + 4)

  bufferWriter.writeUInt32(this.version)

  bufferWriter.writeSlice(hashPrevouts)
  bufferWriter.writeSlice(hashSequence)

  // console.log('prevOutScript', prevOutScript)
  // console.log('prevOutScript', bscript.toASM(prevOutScript))

  // console.log('amount', amount)

  // The input being signed (replacing the scriptSig with scriptCode + amount)
  // The prevout may already be contained in hashPrevout, and the nSequence
  // may already be contain in hashSequence.
  bufferWriter.writeSlice(this.ins[inIndex].hash)
  bufferWriter.writeUInt32(this.ins[inIndex].index)
  bufferWriter.writeScript(prevOutScript)
  bufferWriter.writeUInt64(amount)
  bufferWriter.writeUInt32(this.ins[inIndex].sequence)

  bufferWriter.writeSlice(hashOutputs)

  bufferWriter.writeUInt32(this.locktime)
  bufferWriter.writeUInt32(hashType)

  // console.log('SignatureHashPayload', bufferWriter.buffer.toString('hex'))
  // console.log('SignatureHash', bcrypto.hash256(bufferWriter.buffer).toString('hex'))

  return bcrypto.hash256(bufferWriter.buffer)
}

Transaction.prototype.hashForSignatureV1 = function (inIndex, prevOutScript, hashType) {
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
  return bufferReverse(this.getHash()).toString('hex')
}

Transaction.prototype.toBuffer = function (withWitness) {
  // console.log('tx.Buffer')

  // @TODO: it would be nicer if the marker/flag would be set when witness is set on one of the txIn...
  var txInHaveWitness = this.ins.some(function (txIn) {
    return typeof txIn.witness !== 'undefined'
  })

  // console.log('tx.Buffer::txInHaveWitness', txInHaveWitness)

  if (txInHaveWitness) {
    this.marker = ADVANCED_TRANSACTION_MARKER
    this.flag = ADVANCED_TRANSACTION_FLAG
  }

  var buffer = new Buffer(this.byteLength(withWitness))

  var offset = 0
  function writeSlice (slice) {
    slice.copy(buffer, offset)
    offset += slice.length
  }

  function writeInt (i) {
    buffer.writeUInt8(i, offset)
    offset += 1

    return i
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

  if (this.flag !== null && withWitness) {
    writeInt(this.marker)
    writeInt(this.flag)
  }

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

  if (this.flag === ADVANCED_TRANSACTION_FLAG && withWitness) {
    this.ins.forEach(function (txIn) {
      var witness = txIn.witness || []

      writeVarInt(witness.length)

      witness.forEach(function (witnessChunk) {
        writeVarInt(witnessChunk.length)
        writeSlice(witnessChunk)
      })
    })
  }

  writeUInt32(this.locktime)

  return buffer
}

Transaction.prototype.toHex = function (withWitness) {
  return this.toBuffer(withWitness).toString('hex')
}

Transaction.prototype.setInputScript = function (index, scriptSig, witness) {
  typeforce(types.tuple(types.Number, types.Buffer, types.maybe(types.Array)), arguments)

  this.ins[index].script = scriptSig
  this.ins[index].witness = witness
}

module.exports = Transaction
