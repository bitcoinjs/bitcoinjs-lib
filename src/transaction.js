// FIXME: To all ye that enter here, be weary of Buffers, Arrays and Hex interchanging between the outpoints

var assert = require('assert')
var bufferutils = require('./bufferutils')
var crypto = require('./crypto')
var ecdsa = require('./ecdsa')
var opcodes = require('./opcodes')
var scripts = require('./scripts')

var Address = require('./address')
var ECKey = require('./eckey')
var Script = require('./script')

var DEFAULT_SEQUENCE = 0xffffffff
var SIGHASH_ALL = 0x01
var SIGHASH_NONE = 0x02
var SIGHASH_SINGLE = 0x03
var SIGHASH_ANYONECANPAY = 0x80

function Transaction() {
  this.version = 1
  this.locktime = 0
  this.ins = []
  this.outs = []
}

/**
 * Create a new txin.
 *
 * Can be called with any of:
 *
 * - A transaction and an index
 * - A transaction hash and an index
 *
 * Note that this method does not sign the created input.
 */
Transaction.prototype.addInput = function(tx, outIndex) {
  var hash

  if (typeof tx === 'string') {
    hash = new Buffer(tx, 'hex')
    assert.equal(hash.length, 32, 'Invalid TX hash')

    // TxHash hex is big-endian, we need little-endian
    Array.prototype.reverse.call(hash)

  } else {
    assert(tx instanceof Transaction, 'Expected Transaction, got ' + tx)
    hash = crypto.hash256(tx.toBuffer())

  }

  this.ins.push(new TransactionIn({
    outpoint: {
      hash: hash,
      index: outIndex
    },
    script: Script.EMPTY
  }))
}

/**
 * Create a new txout.
 *
 * Can be called with:
 *
 * - A base58 address string and a value
 * - An Address object and a value
 * - A scriptPubKey Script and a value
 */
Transaction.prototype.addOutput = function(scriptPubKey, value) {
  // Attempt to get a valid address if it's a base58 address string
  if (typeof scriptPubKey === 'string') {
    scriptPubKey = Address.fromBase58Check(scriptPubKey)
  }

  // Attempt to get a valid script if it's an Address object
  if (scriptPubKey instanceof Address) {
    var address = scriptPubKey

    scriptPubKey = address.toOutputScript()
  }

  this.outs.push(new TransactionOut({
    script: scriptPubKey,
    value: value,
  }))
}

Transaction.prototype.toBuffer = function () {
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

  this.ins.forEach(function(txin, i) {
    writeSlice(txin.outpoint.hash)
    writeUInt32(txin.outpoint.index)
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
  assert.equal(offset, buffer.length, 'Invalid transaction object')

  return buffer
}

Transaction.prototype.toHex = function() {
  return this.toBuffer().toString('hex')
}

/**
 * Hash transaction for signing a specific input.
 *
 * Bitcoin uses a different hash for each signed transaction input. This
 * method copies the transaction, makes the necessary changes based on the
 * hashType, serializes and finally hashes the result. This hash can then be
 * used to sign the transaction input in question.
 */
Transaction.prototype.hashForSignature = function(prevOutScript, inIndex, hashType) {
  assert(inIndex >= 0, 'Invalid vin index')
  assert(inIndex < this.ins.length, 'Invalid vin index')
  assert(prevOutScript instanceof Script, 'Invalid Script object')

  var txTmp = this.clone()
  var hashScript = prevOutScript.without(opcodes.OP_CODESEPARATOR)

  // Blank out other inputs' signatures
  txTmp.ins.forEach(function(txin) {
    txin.script = Script.EMPTY
  })
  txTmp.ins[inIndex].script = hashScript

  var hashTypeModifier = hashType & 0x1f
  if (hashTypeModifier === SIGHASH_NONE) {
    assert(false, 'SIGHASH_NONE not yet supported')

  } else if (hashTypeModifier === SIGHASH_SINGLE) {
    assert(false, 'SIGHASH_SINGLE not yet supported')

  }

  if (hashType & SIGHASH_ANYONECANPAY) {
    assert(false, 'SIGHASH_ANYONECANPAY not yet supported')
  }

  var hashTypeBuffer = new Buffer(4)
  hashTypeBuffer.writeInt32LE(hashType, 0)

  var buffer = Buffer.concat([txTmp.toBuffer(), hashTypeBuffer])
  return crypto.hash256(buffer)
}

Transaction.prototype.getId = function () {
  var buffer = crypto.hash256(this.toBuffer())

  // Big-endian is used for TxHash
  Array.prototype.reverse.call(buffer)

  return buffer.toString('hex')
}

Transaction.prototype.clone = function () {
  var newTx = new Transaction()
  newTx.version = this.version
  newTx.locktime = this.locktime

  newTx.ins = this.ins.map(function(txin) {
    return new TransactionIn(txin)
  })

  newTx.outs = this.outs.map(function(txout) {
    return new TransactionOut(txout)
  })

  return newTx
}

Transaction.fromBuffer = function(buffer) {
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

  var tx = new Transaction()
  tx.version = readUInt32()

  var vinLen = readVarInt()
  for (var i = 0; i < vinLen; ++i) {
    var hash = readSlice(32)
    var vout = readUInt32()
    var scriptLen = readVarInt()
    var script = readSlice(scriptLen)
    var sequence = readUInt32()

    tx.ins.push(new TransactionIn({
      outpoint: {
        hash: hash,
        index: vout
      },
      script: Script.fromBuffer(script),
      sequence: sequence
    }))
  }

  var voutLen = readVarInt()
  for (i = 0; i < voutLen; ++i) {
    var value = readUInt64()
    var scriptLen = readVarInt()
    var script = readSlice(scriptLen)

    tx.outs.push(new TransactionOut({
      value: value,
      script: Script.fromBuffer(script)
    }))
  }

  tx.locktime = readUInt32()
  assert.equal(offset, buffer.length, 'Invalid transaction')

  return tx
}

Transaction.fromHex = function(hex) {
  return Transaction.fromBuffer(new Buffer(hex, 'hex'))
}

/**
 * Signs a pubKeyHash output at some index with the given key
 */
Transaction.prototype.sign = function(index, key, type) {
  var prevOutScript = key.pub.getAddress().toOutputScript()
  var signature = this.signInput(index, prevOutScript, key, type)

  // FIXME: Assumed prior TX was pay-to-pubkey-hash
  var scriptSig = scripts.pubKeyHashInput(signature, key.pub)
  this.setInputScript(index, scriptSig)
}

Transaction.prototype.signInput = function(index, prevOutScript, key, type) {
  type = type || SIGHASH_ALL
  assert(key instanceof ECKey, 'Invalid private key')

  var hash = this.hashForSignature(prevOutScript, index, type)
  var signature = key.sign(hash)
  var DERencoded = ecdsa.serializeSig(signature)

  return Buffer.concat([
    new Buffer(DERencoded),
    new Buffer([type])
  ])
}

Transaction.prototype.setInputScript = function(index, script) {
  this.ins[index].script = script
}

// FIXME: should probably be validateInput(index, pub)
Transaction.prototype.validateInput = function(index, script, pub, DERsig) {
  var type = DERsig.readUInt8(DERsig.length - 1)
  DERsig = DERsig.slice(0, -1)

  var hash = this.hashForSignature(script, index, type)
  var sig = ecdsa.parseSig(DERsig)

  return pub.verify(hash, sig)
}

Transaction.feePerKb = 20000
Transaction.prototype.estimateFee = function(feePerKb){
  var uncompressedInSize = 180
  var outSize = 34
  var fixedPadding = 34

  if(feePerKb == undefined) feePerKb = Transaction.feePerKb;
  var size = this.ins.length * uncompressedInSize + this.outs.length * outSize + fixedPadding

  return feePerKb * Math.ceil(size / 1000)
}

function TransactionIn(data) {
  assert(data.outpoint && data.script, 'Invalid TxIn parameters')
  this.outpoint = data.outpoint
  this.script = data.script
  this.sequence = data.sequence == undefined ? DEFAULT_SEQUENCE : data.sequence
}

TransactionIn.prototype.clone = function () {
  return new TransactionIn({
    outpoint: {
      hash: this.outpoint.hash,
      index: this.outpoint.index
    },
    script: this.script,
    sequence: this.sequence
  })
}

function TransactionOut(data) {
  this.script = data.script
  this.value = data.value
}

TransactionOut.prototype.clone = function() {
  return new TransactionOut({
    script: this.script,
    value: this.value
  })
}

module.exports = Transaction
