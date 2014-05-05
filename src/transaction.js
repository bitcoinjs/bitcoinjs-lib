// FIXME: To all ye that enter here, be weary of Buffers, Arrays and Hex interchanging between the outpoints

var assert = require('assert')
var Address = require('./address')
var BigInteger = require('bigi')
var BufferExt = require('./buffer')
var Script = require('./script')
var convert = require('./convert')
var crypto = require('./crypto')
var ECKey = require('./eckey').ECKey
var ecdsa = require('./ecdsa')
var Network = require('./network')

var Transaction = function (doc) {
  if (!(this instanceof Transaction)) { return new Transaction(doc) }
  this.version = 1
  this.locktime = 0
  this.ins = []
  this.outs = []
  this.defaultSequence = 0xffffffff

  if (doc) {
    if (typeof doc == "string" || Array.isArray(doc)) {
      doc = Transaction.deserialize(doc)
    }

    if (doc.hash) this.hash = doc.hash;
    if (doc.version) this.version = doc.version;
    if (doc.locktime) this.locktime = doc.locktime;
    if (doc.ins && doc.ins.length) {
      doc.ins.forEach(function(input) {
        this.addInput(new TransactionIn(input))
      }, this)
    }

    if (doc.outs && doc.outs.length) {
      doc.outs.forEach(function(output) {
        this.addOutput(new TransactionOut(output))
      }, this)
    }

    this.hash = this.hash || this.getHash()
  }
}

/**
 * Create a new txin.
 *
 * Can be called with any of:
 *
 * - An existing TransactionIn object
 * - A transaction and an index
 * - A transaction hash and an index
 * - A single string argument of the form txhash:index
 *
 * Note that this method does not sign the created input.
 */
Transaction.prototype.addInput = function (tx, outIndex) {
  if (arguments[0] instanceof TransactionIn) {
    this.ins.push(arguments[0])
    return
  }

  var hash
  if (arguments[0].length > 65) {
    var args = arguments[0].split(':')
    hash = args[0]
    outIndex = parseInt(args[1])

  } else {
    hash = typeof tx === "string" ? tx : tx.hash
    hash = Array.isArray(hash) ? convert.bytesToHex(hash) : hash
  }

  this.ins.push(new TransactionIn({
    outpoint: {
      hash: hash,
      index: outIndex
    },
    script: new Script(),
    sequence: this.defaultSequence
  }))
}

/**
 * Create a new txout.
 *
 * Can be called with:
 *
 * i) An existing TransactionOut object
 * ii) An address object or a string address, and a value
 * iii) An address:value string
 * iv) Either ii), iii) with an optional network argument
 *
 * FIXME: This is a bit convoluted
 */
Transaction.prototype.addOutput = function (address, value, network) {
  if (arguments[0] instanceof TransactionOut) {
    this.outs.push(arguments[0])
    return
  }

  if (typeof address === 'string') {
    if (arguments[0].indexOf(':') >= 0) {
      var args = arguments[0].split(':')
      address = args[0]
      value = parseInt(args[1])

      network = arguments[1]
    }

    address = Address.fromBase58Check(address)
  }

  network = network || Network.bitcoin

  this.outs.push(new TransactionOut({
    value: value,
    script: Script.createOutputScript(address, network),
    network: network
  }))
}

/**
 * Serialize this transaction.
 *
 * Returns the transaction as a binary buffer in
 * accordance with the Bitcoin protocol.
 */
Transaction.prototype.serialize = function () {
  var txInSize = this.ins.reduce(function(a, x) {
    return a + (40 + BufferExt.varIntSize(x.script.buffer.length) + x.script.buffer.length)
  }, 0)

  var txOutSize = this.outs.reduce(function(a, x) {
    return a + (8 + BufferExt.varIntSize(x.script.buffer.length) + x.script.buffer.length)
  }, 0)

  var buffer = new Buffer(
    8 +
    BufferExt.varIntSize(this.ins.length) +
    BufferExt.varIntSize(this.outs.length) +
    txInSize +
    txOutSize
  )

  var offset = 0
  function writeSlice(slice) {
    if (Array.isArray(slice)) slice = new Buffer(slice) // FIXME: Performance: transitionary only
    slice.copy(buffer, offset)
    offset += slice.length
  }
  function writeUInt32(i) {
    buffer.writeUInt32LE(i, offset)
    offset += 4
  }
  function writeUInt64(i) {
    BufferExt.writeUInt64LE(buffer, i, offset)
    offset += 8
  }
  function writeVarInt(i) {
    var n = BufferExt.writeVarInt(buffer, i, offset)
    offset += n
  }

  writeUInt32(this.version)
  writeVarInt(this.ins.length)

  this.ins.forEach(function(txin, i) {
    var hash = new Buffer(txin.outpoint.hash, 'hex') // FIXME: Performance: convert on tx.addInput instead

    // TxHash hex is big-endian, we need little-endian
    Array.prototype.reverse.call(hash)

    writeSlice(hash)
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

Transaction.prototype.serializeHex = function() {
  return this.serialize().toString('hex')
}

//var OP_CODESEPARATOR = 171

var SIGHASH_ALL = 1
var SIGHASH_NONE = 2
var SIGHASH_SINGLE = 3
var SIGHASH_ANYONECANPAY = 80

/**
 * Hash transaction for signing a specific input.
 *
 * Bitcoin uses a different hash for each signed transaction input. This
 * method copies the transaction, makes the necessary changes based on the
 * hashType, serializes and finally hashes the result. This hash can then be
 * used to sign the transaction input in question.
 */
Transaction.prototype.hashTransactionForSignature =
  function (connectedScript, inIndex, hashType)
{
  var txTmp = this.clone()

  // In case concatenating two scripts ends up with two codeseparators,
  // or an extra one at the end, this prevents all those possible
  // incompatibilities.
  /*scriptCode = scriptCode.filter(function (val) {
    return val !== OP_CODESEPARATOR
    });*/

  // Blank out other inputs' signatures
  txTmp.ins.forEach(function(txin) {
    txin.script = new Script()
  })

  txTmp.ins[inIndex].script = connectedScript

  // Blank out some of the outputs
  if ((hashType & 0x1f) == SIGHASH_NONE) {
    txTmp.outs = []

    // Let the others update at will
    txTmp.ins.forEach(function(txin, i) {
      if (i != inIndex) {
        txTmp.ins[i].sequence = 0
      }
    })

  } else if ((hashType & 0x1f) == SIGHASH_SINGLE) {
    // TODO: Implement
  }

  // Blank out other inputs completely, not recommended for open transactions
  if (hashType & SIGHASH_ANYONECANPAY) {
    txTmp.ins = [txTmp.ins[inIndex]]
  }

  var htB = new Buffer(4)
  htB.writeUInt32LE(hashType, 0)

  var buffer = Buffer.concat([txTmp.serialize(), htB])
  return crypto.hash256(buffer)
}

Transaction.prototype.getHash = function () {
  var buffer = crypto.hash256(this.serialize())

  // Big-endian is used for TxHash
  Array.prototype.reverse.call(buffer)

  return buffer.toString('hex')
}

Transaction.prototype.clone = function ()
{
  var newTx = new Transaction()
  newTx.version = this.version
  newTx.locktime = this.locktime

  this.ins.forEach(function(txin) {
    newTx.addInput(txin.clone())
  })

  this.outs.forEach(function(txout) {
    newTx.addOutput(txout.clone())
  })

  return newTx
}

Transaction.deserialize = function(buffer) {
  if (typeof buffer == "string") buffer = new Buffer(buffer, 'hex')
  else if (Array.isArray(buffer)) buffer = new Buffer(buffer)

  // Copy because we mutate (reverse TxOutHashs)
  buffer = new Buffer(buffer)

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
    var i = BufferExt.readUInt64LE(buffer, offset)
    offset += 8
    return i
  }
  function readVarInt() {
    var vi = BufferExt.readVarInt(buffer, offset)
    offset += vi.size
    return vi.number
  }

  var ins = []
  var outs = []

  var version = readUInt32()
  var vinLen = readVarInt()

  for (var i = 0; i < vinLen; ++i) {
    var hash = readSlice(32)

    // TxHash is little-endian, we want big-endian hex
    Array.prototype.reverse.call(hash)

    var vout = readUInt32()
    var scriptLen = readVarInt()
    var script = readSlice(scriptLen)
    var sequence = readUInt32()

    ins.push({
      outpoint: {
        hash: hash.toString('hex'),
        index: vout,
      },
      script: Script.fromBuffer(script),
      sequence: sequence
    })
  }

  var voutLen = readVarInt()

  for (i = 0; i < voutLen; ++i) {
    var value = readUInt64()
    var scriptLen = readVarInt()
    var script = readSlice(scriptLen)

    outs.push({
      value: value,
      script: Script.fromBuffer(script)
    })
  }

  var locktime = readUInt32()
  assert.equal(offset, buffer.length, 'Invalid transaction')

  return new Transaction({
    version: version,
    ins: ins,
    outs: outs,
    locktime: locktime
  })
}

/**
 * Signs a standard output at some index with the given key
 * FIXME: network support is ugly
 */
Transaction.prototype.sign = function(index, key, type, network) {
  assert(key instanceof ECKey)
  network = network || Network.bitcoin

  var address = key.pub.getAddress(network.pubKeyHash)

  // FIXME: Assumed prior TX was pay-to-pubkey-hash
  var script = Script.createOutputScript(address, network)
  var signature = this.signScriptSig(index, script, key, type)

  var scriptSig = Script.createPubKeyHashScriptSig(signature, key.pub)
  this.setScriptSig(index, scriptSig)
}

Transaction.prototype.signScriptSig = function(index, script, key, type) {
  type = type || SIGHASH_ALL

  assert((index >= 0), 'Invalid vin index')
  assert(script instanceof Script, 'Invalid Script object')
  assert(key instanceof ECKey, 'Invalid private key')
//  assert.equal(type & 0x7F, type, 'Invalid type') // TODO

  var hash = this.hashTransactionForSignature(script, index, type)
  return key.sign(hash).concat([type])
}

Transaction.prototype.setScriptSig = function(index, script) {
  this.ins[index].script = script
}

Transaction.prototype.validateSig = function(index, script, pub, sig, type) {
  type = type || SIGHASH_ALL
  var hash = this.hashTransactionForSignature(script, index, type)

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

var TransactionIn = function (data) {
  if (typeof data == "string") {
    this.outpoint = { hash: data.split(':')[0], index: data.split(':')[1] }
  } else if (data.outpoint) {
    this.outpoint = data.outpoint
  } else {
    this.outpoint = { hash: data.hash, index: data.index }
  }

  assert(data.script, 'Invalid TxIn parameters')
  this.script = data.script
  this.sequence = data.sequence || this.defaultSequence
}

TransactionIn.prototype.clone = function () {
  return new TransactionIn({
    outpoint: {
      hash: this.outpoint.hash,
      index: this.outpoint.index
    },
    script: this.script.clone(),
    sequence: this.sequence
  })
}

function TransactionOut(data) {
  this.script = data.script
  this.value = data.value
  this.address = data.address

  var network = data.network || Network.bitcoin
  if (this.script.buffer.length > 0) {
    this.address = this.script.getToAddress(network)
  }
}

TransactionOut.prototype.clone = function() {
  return new TransactionOut({
    script: this.script.clone(),
    value: this.value,
    address: this.address
  })
}

module.exports = {
  Transaction: Transaction,
  TransactionIn: TransactionIn,
  TransactionOut: TransactionOut
}
