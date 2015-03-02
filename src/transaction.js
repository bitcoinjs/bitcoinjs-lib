var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var typeForce = require('typeforce')
var opcodes = require('./opcodes')
var scripts = require('./scripts')

var Address = require('./address')
var ECSignature = require('./ecsignature')
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

/**
 * Create a new txIn.
 *
 * Can be called with any of:
 *
 * - A transaction and an index
 * - A transaction hash and an index
 *
 * Note that this method does not sign the created input.
 */
Transaction.prototype.addInput = function (hash, index, sequence, script) {
  if (sequence === undefined || sequence === null) {
    sequence = Transaction.DEFAULT_SEQUENCE
  }

  script = script || Script.EMPTY

  if (typeof hash === 'string') {
    // TxId hex is big-endian, we need little-endian
    hash = bufferutils.reverse(new Buffer(hash, 'hex'))
  } else if (hash instanceof Transaction) {
    hash = hash.getHash()
  }

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

/**
 * Create a new txOut.
 *
 * Can be called with:
 *
 * - A base58 address string and a value
 * - An Address object and a value
 * - A scriptPubKey Script and a value
 */
Transaction.prototype.addOutput = function (scriptPubKey, value) {
  // Attempt to get a valid address if it's a base58 address string
  if (typeof scriptPubKey === 'string') {
    scriptPubKey = Address.fromBase58Check(scriptPubKey)
  }

  // Attempt to get a valid script if it's an Address object
  if (scriptPubKey instanceof Address) {
    scriptPubKey = scriptPubKey.toOutputScript()
  }

  typeForce('Script', scriptPubKey)
  typeForce('Number', value)

  // Add the output and return the output's index
  return (this.outs.push({
    script: scriptPubKey,
    value: value
  }) - 1)
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
 * Bitcoin uses a different hash for each signed transaction input. This
 * method copies the transaction, makes the necessary changes based on the
 * hashType, serializes and finally hashes the result. This hash can then be
 * used to sign the transaction input in question.
 */
Transaction.prototype.hashForSignature = function (inIndex, prevOutScript, hashType) {
  // FIXME: remove in 2.x.y
  if (arguments[0] instanceof Script) {
    console.warn('hashForSignature(prevOutScript, inIndex, ...) has been deprecated. Use hashForSignature(inIndex, prevOutScript, ...)')

    // swap the arguments (must be stored in tmp, arguments is special)
    var tmp = arguments[0]
    inIndex = arguments[1]
    prevOutScript = tmp
  }

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
  function scriptSize (script) {
    var length = script.buffer.length

    return bufferutils.varIntSize(length) + length
  }

  var buffer = new Buffer(
    8 +
    bufferutils.varIntSize(this.ins.length) +
    bufferutils.varIntSize(this.outs.length) +
    this.ins.reduce(function (sum, input) { return sum + 40 + scriptSize(input.script) }, 0) +
    this.outs.reduce(function (sum, output) { return sum + 8 + scriptSize(output.script) }, 0)
  )

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

// FIXME: remove in 2.x.y
Transaction.prototype.sign = function (index, privKey, hashType) {
  console.warn('Transaction.prototype.sign is deprecated.  Use TransactionBuilder instead.')

  var prevOutScript = privKey.pub.getAddress().toOutputScript()
  var signature = this.signInput(index, prevOutScript, privKey, hashType)

  var scriptSig = scripts.pubKeyHashInput(signature, privKey.pub)
  this.setInputScript(index, scriptSig)
}

// FIXME: remove in 2.x.y
Transaction.prototype.signInput = function (index, prevOutScript, privKey, hashType) {
  console.warn('Transaction.prototype.signInput is deprecated.  Use TransactionBuilder instead.')

  hashType = hashType || Transaction.SIGHASH_ALL

  var hash = this.hashForSignature(index, prevOutScript, hashType)
  var signature = privKey.sign(hash)

  return signature.toScriptSignature(hashType)
}

// FIXME: remove in 2.x.y
Transaction.prototype.validateInput = function (index, prevOutScript, pubKey, buffer) {
  console.warn('Transaction.prototype.validateInput is deprecated.  Use TransactionBuilder instead.')

  var parsed = ECSignature.parseScriptSignature(buffer)
  var hash = this.hashForSignature(index, prevOutScript, parsed.hashType)

  return pubKey.verify(hash, parsed.signature)
}

module.exports = Transaction
