var baddress = require('./address')
var bcrypto = require('./crypto')
var bscript = require('./script')
var bufferReverse = require('buffer-reverse')
var networks = require('./networks')
var ops = require('./opcodes.json')
var typeforce = require('typeforce')
var types = require('./types')
var scriptTypes = bscript.types

var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')
var Transaction = require('./transaction')

// inspects a scriptSig w/ optional redeemScript and
// derives any input information required
function expandInput (scriptSig, redeemScript) {
  var scriptSigChunks = bscript.decompile(scriptSig)
  var prevOutType = bscript.classifyInput(scriptSigChunks, true)
  var pubKeys, signatures, prevOutScript

  switch (prevOutType) {
    case scriptTypes.P2SH:
      // FIXME: maybe depth limit instead, how possible is this anyway?
      if (redeemScript) throw new Error('Recursive P2SH script')

      var redeemScriptSig = scriptSigChunks.slice(0, -1)
      redeemScript = scriptSigChunks[scriptSigChunks.length - 1]

      var result = expandInput(redeemScriptSig, redeemScript)
      result.redeemScript = redeemScript
      result.redeemScriptType = result.prevOutType
      result.prevOutScript = bscript.scriptHash.output.encode(bcrypto.hash160(redeemScript))
      result.prevOutType = scriptTypes.P2SH
      return result

    case scriptTypes.P2PKH:
      // if (redeemScript) throw new Error('Nonstandard... P2SH(P2PKH)')
      pubKeys = scriptSigChunks.slice(1)
      signatures = scriptSigChunks.slice(0, 1)

      if (redeemScript) break
      prevOutScript = bscript.pubKeyHash.output.encode(bcrypto.hash160(pubKeys[0]))
      break

    case scriptTypes.P2PK:
      if (redeemScript) {
        pubKeys = bscript.decompile(redeemScript).slice(0, 1)
      }

      signatures = scriptSigChunks.slice(0, 1)
      break

    case scriptTypes.MULTISIG:
      if (redeemScript) {
        pubKeys = bscript.decompile(redeemScript).slice(1, -2)
      }

      signatures = scriptSigChunks.slice(1).map(function (chunk) {
        return chunk === ops.OP_0 ? undefined : chunk
      })
      break
  }

  return {
    pubKeys: pubKeys,
    signatures: signatures,
    prevOutScript: prevOutScript,
    prevOutType: prevOutType
  }
}

// could be done in expandInput, but requires the original Transaction for hashForSignature
function fixMultisigOrder (input, transaction, vin) {
  if (input.redeemScriptType !== scriptTypes.MULTISIG || !input.redeemScript) return
  if (input.pubKeys.length === input.signatures.length) return

  var unmatched = input.signatures.concat()

  input.signatures = input.pubKeys.map(function (pubKey, y) {
    var keyPair = ECPair.fromPublicKeyBuffer(pubKey)
    var match

    // check for a signature
    unmatched.some(function (signature, i) {
      // skip if undefined || OP_0
      if (!signature) return false

      // TODO: avoid O(n) hashForSignature
      var parsed = ECSignature.parseScriptSignature(signature)
      var hash = transaction.hashForSignature(vin, input.redeemScript, parsed.hashType)

      // skip if signature does not match pubKey
      if (!keyPair.verify(hash, parsed.signature)) return false

      // remove matched signature from unmatched
      unmatched[i] = undefined
      match = signature

      return true
    })

    return match
  })
}

function expandOutput (script, scriptType, ourPubKey) {
  typeforce(types.Buffer, script)

  var scriptChunks = bscript.decompile(script)
  if (!scriptType) {
    scriptType = bscript.classifyOutput(script)
  }

  var pubKeys = []

  switch (scriptType) {
    // does our hash160(pubKey) match the output scripts?
    case scriptTypes.P2PKH:
      if (!ourPubKey) break

      var pkh1 = scriptChunks[2]
      var pkh2 = bcrypto.hash160(ourPubKey)
      if (pkh1.equals(pkh2)) pubKeys = [ourPubKey]
      break

    case scriptTypes.P2PK:
      pubKeys = scriptChunks.slice(0, 1)
      break

    case scriptTypes.MULTISIG:
      pubKeys = scriptChunks.slice(1, -2)
      break

    default: return { scriptType: scriptType }
  }

  return {
    pubKeys: pubKeys,
    scriptType: scriptType,
    signatures: pubKeys.map(function () { return undefined })
  }
}

function prepareInput (input, kpPubKey, redeemScript) {
  if (redeemScript) {
    var redeemScriptHash = bcrypto.hash160(redeemScript)

    // if redeemScript exists, it is pay-to-scriptHash
    // if we have a prevOutScript, enforce hash160(redeemScriptequality)  to the redeemScript
    if (input.prevOutType) {
      if (input.prevOutType !== scriptTypes.P2SH) throw new Error('PrevOutScript must be P2SH')

      var prevOutScriptScriptHash = bscript.decompile(input.prevOutScript)[1]
      if (!prevOutScriptScriptHash.equals(redeemScriptHash)) throw new Error('Inconsistent hash160(RedeemScript)')
    }

    var expanded = expandOutput(redeemScript, undefined, kpPubKey)
    if (!expanded.pubKeys) throw new Error('RedeemScript not supported "' + bscript.toASM(redeemScript) + '"')

    input.pubKeys = expanded.pubKeys
    input.signatures = expanded.signatures
    input.redeemScript = redeemScript
    input.redeemScriptType = expanded.scriptType
    input.prevOutScript = input.prevOutScript || bscript.scriptHash.output.encode(redeemScriptHash)
    input.prevOutType = scriptTypes.P2SH

  // maybe we have some prevOut knowledge
  } else if (input.prevOutType) {
    // pay-to-scriptHash is not possible without a redeemScript
    if (input.prevOutType === scriptTypes.P2SH) throw new Error('PrevOutScript is P2SH, missing redeemScript')

    // try to derive missing information using our kpPubKey
    expanded = expandOutput(input.prevOutScript, input.prevOutType, kpPubKey)
    if (!expanded.pubKeys) return

    input.pubKeys = expanded.pubKeys
    input.signatures = expanded.signatures

  // no prior knowledge, assume pubKeyHash
  } else {
    input.prevOutScript = bscript.pubKeyHash.output.encode(bcrypto.hash160(kpPubKey))
    input.prevOutType = scriptTypes.P2PKH
    input.pubKeys = [kpPubKey]
    input.signatures = [undefined]
  }
}

function buildInput (input, allowIncomplete) {
  var signatures = input.signatures
  var scriptType = input.redeemScriptType || input.prevOutType
  var scriptSig

  switch (scriptType) {
    case scriptTypes.P2PKH:
    case scriptTypes.P2PK:
      if (signatures.length < 1 || !signatures[0]) throw new Error('Not enough signatures provided')
      if (scriptType === scriptTypes.P2PKH) {
        scriptSig = bscript.pubKeyHash.input.encode(signatures[0], input.pubKeys[0])
      } else {
        scriptSig = bscript.pubKey.input.encode(signatures[0])
      }

      break

    // ref https://github.com/bitcoin/bitcoin/blob/d612837814020ae832499d18e6ee5eb919a87907/src/script/sign.cpp#L232
    case scriptTypes.MULTISIG:
      signatures = signatures.map(function (signature) {
        return signature || ops.OP_0
      })

      if (!allowIncomplete) {
        // remove blank signatures
        signatures = signatures.filter(function (x) { return x !== ops.OP_0 })
      }

      scriptSig = bscript.multisig.input.encode(signatures, allowIncomplete ? undefined : input.redeemScript)
      break

    default: return
  }

  // wrap as scriptHash if necessary
  if (input.prevOutType === scriptTypes.P2SH) {
    scriptSig = bscript.scriptHash.input.encode(scriptSig, input.redeemScript)
  }

  return scriptSig
}

function TransactionBuilder (network, maximumFeeRate) {
  this.prevTxMap = {}
  this.network = network || networks.bitcoin

  // WARNING: This is __NOT__ to be relied on, its just another potential safety mechanism (safety in-depth)
  this.maximumFeeRate = maximumFeeRate || 1000

  this.inputs = []
  this.tx = new Transaction()
}

TransactionBuilder.prototype.setLockTime = function (locktime) {
  typeforce(types.UInt32, locktime)

  // if any signatures exist, throw
  if (this.inputs.some(function (input) {
    if (!input.signatures) return false

    return input.signatures.some(function (s) { return s })
  })) {
    throw new Error('No, this would invalidate signatures')
  }

  this.tx.locktime = locktime
}

TransactionBuilder.prototype.setVersion = function (version) {
  typeforce(types.UInt32, version)

  // XXX: this might eventually become more complex depending on what the versions represent
  this.tx.version = version
}

TransactionBuilder.fromTransaction = function (transaction, network) {
  var txb = new TransactionBuilder(network)

  // Copy transaction fields
  txb.setVersion(transaction.version)
  txb.setLockTime(transaction.locktime)

  // Copy outputs (done first to avoid signature invalidation)
  transaction.outs.forEach(function (txOut) {
    txb.addOutput(txOut.script, txOut.value)
  })

  // Copy inputs
  transaction.ins.forEach(function (txIn) {
    txb.__addInputUnsafe(txIn.hash, txIn.index, {
      sequence: txIn.sequence,
      script: txIn.script
    })
  })

  // fix some things not possible through the public API
  txb.inputs.forEach(function (input, i) {
    fixMultisigOrder(input, transaction, i)
  })

  return txb
}

TransactionBuilder.prototype.addInput = function (txHash, vout, sequence, prevOutScript) {
  if (!this.__canModifyInputs()) {
    throw new Error('No, this would invalidate signatures')
  }

  var value

  // is it a hex string?
  if (typeof txHash === 'string') {
    // transaction hashs's are displayed in reverse order, un-reverse it
    txHash = bufferReverse(new Buffer(txHash, 'hex'))

  // is it a Transaction object?
  } else if (txHash instanceof Transaction) {
    var txOut = txHash.outs[vout]
    prevOutScript = txOut.script
    value = txOut.value

    txHash = txHash.getHash()
  }

  return this.__addInputUnsafe(txHash, vout, {
    sequence: sequence,
    prevOutScript: prevOutScript,
    value: value
  })
}

TransactionBuilder.prototype.__addInputUnsafe = function (txHash, vout, options) {
  if (Transaction.isCoinbaseHash(txHash)) {
    throw new Error('coinbase inputs not supported')
  }

  var prevTxOut = txHash.toString('hex') + ':' + vout
  if (this.prevTxMap[prevTxOut] !== undefined) throw new Error('Duplicate TxOut: ' + prevTxOut)

  var input = {}

  // derive what we can from the scriptSig
  if (options.script !== undefined) {
    input = expandInput(options.script)
  }

  // if an input value was given, retain it
  if (options.value !== undefined) {
    input.value = options.value
  }

  // derive what we can from the previous transactions output script
  if (!input.prevOutScript && options.prevOutScript) {
    var prevOutType

    if (!input.pubKeys && !input.signatures) {
      var expanded = expandOutput(options.prevOutScript)

      if (expanded.pubKeys) {
        input.pubKeys = expanded.pubKeys
        input.signatures = expanded.signatures
      }

      prevOutType = expanded.scriptType
    }

    input.prevOutScript = options.prevOutScript
    input.prevOutType = prevOutType || bscript.classifyOutput(options.prevOutScript)
  }

  var vin = this.tx.addInput(txHash, vout, options.sequence, options.scriptSig)
  this.inputs[vin] = input
  this.prevTxMap[prevTxOut] = vin

  return vin
}

TransactionBuilder.prototype.addOutput = function (scriptPubKey, value) {
  if (!this.__canModifyOutputs()) {
    throw new Error('No, this would invalidate signatures')
  }

  // Attempt to get a script if it's a base58 address string
  if (typeof scriptPubKey === 'string') {
    scriptPubKey = baddress.toOutputScript(scriptPubKey, this.network)
  }

  return this.tx.addOutput(scriptPubKey, value)
}

TransactionBuilder.prototype.build = function () {
  return this.__build(false)
}
TransactionBuilder.prototype.buildIncomplete = function () {
  return this.__build(true)
}

TransactionBuilder.prototype.__build = function (allowIncomplete) {
  if (!allowIncomplete) {
    if (!this.tx.ins.length) throw new Error('Transaction has no inputs')
    if (!this.tx.outs.length) throw new Error('Transaction has no outputs')
  }

  var tx = this.tx.clone()

  // Create script signatures from inputs
  this.inputs.forEach(function (input, i) {
    var scriptType = input.redeemScriptType || input.prevOutType
    if (!scriptType && !allowIncomplete) throw new Error('Transaction is not complete')

    // build a scriptSig
    var scriptSig = buildInput(input, allowIncomplete)

    // skip if no scriptSig exists
    if (!scriptSig) {
      if (!allowIncomplete) throw new Error(scriptType + ' not supported')
      return
    }

    tx.setInputScript(i, scriptSig)
  })

  if (!allowIncomplete) {
    // do not rely on this, its merely a last resort
    if (this.__overMaximumFees(tx.byteLength())) {
      throw new Error('Transaction has absurd fees')
    }
  }

  return tx
}

function canSign (input) {
  return input.prevOutScript !== undefined &&
    input.pubKeys !== undefined &&
    input.signatures !== undefined &&
    input.signatures.length === input.pubKeys.length &&
    input.pubKeys.length > 0
}

TransactionBuilder.prototype.sign = function (vin, keyPair, redeemScript, hashType) {
  if (keyPair.network !== this.network) throw new Error('Inconsistent network')
  if (!this.inputs[vin]) throw new Error('No input at index: ' + vin)
  hashType = hashType || Transaction.SIGHASH_ALL

  var input = this.inputs[vin]

  // if redeemScript was previously provided, enforce consistency
  if (input.redeemScript !== undefined &&
      redeemScript &&
      !input.redeemScript.equals(redeemScript)) {
    throw new Error('Inconsistent redeemScript')
  }

  var kpPubKey = keyPair.getPublicKeyBuffer()
  if (!canSign(input)) {
    prepareInput(input, kpPubKey, redeemScript)

    if (!canSign(input)) throw Error(input.prevOutType + ' not supported')
  }

  // ready to sign
  var hashScript = input.redeemScript || input.prevOutScript
  var signatureHash = this.tx.hashForSignature(vin, hashScript, hashType)

  // enforce in order signing of public keys
  var signed = input.pubKeys.some(function (pubKey, i) {
    if (!kpPubKey.equals(pubKey)) return false
    if (input.signatures[i]) throw new Error('Signature already exists')

    input.signatures[i] = keyPair.sign(signatureHash).toScriptSignature(hashType)
    return true
  })

  if (!signed) throw new Error('Key pair cannot sign for this input')
}

function signatureHashType (buffer) {
  return buffer.readUInt8(buffer.length - 1)
}

TransactionBuilder.prototype.__canModifyInputs = function () {
  return this.inputs.every(function (input) {
    // any signatures?
    if (input.signatures === undefined) return true

    return input.signatures.every(function (signature) {
      if (!signature) return true
      var hashType = signatureHashType(signature)

      // if SIGHASH_ANYONECANPAY is set, signatures would not
      // be invalidated by more inputs
      return hashType & Transaction.SIGHASH_ANYONECANPAY
    })
  })
}

TransactionBuilder.prototype.__canModifyOutputs = function () {
  var nInputs = this.tx.ins.length
  var nOutputs = this.tx.outs.length

  return this.inputs.every(function (input) {
    if (input.signatures === undefined) return true

    return input.signatures.every(function (signature) {
      if (!signature) return true
      var hashType = signatureHashType(signature)

      var hashTypeMod = hashType & 0x1f
      if (hashTypeMod === Transaction.SIGHASH_NONE) return true
      if (hashTypeMod === Transaction.SIGHASH_SINGLE) {
        // if SIGHASH_SINGLE is set, and nInputs > nOutputs
        // some signatures would be invalidated by the addition
        // of more outputs
        return nInputs <= nOutputs
      }
    })
  })
}

TransactionBuilder.prototype.__overMaximumFees = function (bytes) {
  // not all inputs will have .value defined
  var incoming = this.inputs.reduce(function (a, x) { return a + (x.value >>> 0) }, 0)

  // but all outputs do, and if we have any input value
  // we can immediately determine if the outputs are too small
  var outgoing = this.tx.outs.reduce(function (a, x) { return a + x.value }, 0)
  var fee = incoming - outgoing
  var feeRate = fee / bytes

  return feeRate > this.maximumFeeRate
}

module.exports = TransactionBuilder
