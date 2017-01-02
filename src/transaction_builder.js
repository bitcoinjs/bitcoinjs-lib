var baddress = require('./address')
var bcrypto = require('./crypto')
var bscript = require('./script')
var networks = require('./networks')
var ops = require('bitcoin-ops')
var typeforce = require('typeforce')
var types = require('./types')
var scriptTypes = bscript.types
var SIGNABLE = [bscript.types.P2PKH, bscript.types.P2PK, bscript.types.MULTISIG]
var P2SH = SIGNABLE.concat([bscript.types.P2WPKH, bscript.types.P2WSH])
var EMPTY_SCRIPT = new Buffer(0)

var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')
var Transaction = require('./transaction')

function extractChunks (type, chunks) {
  var pubKeys = []
  var signatures = []
  switch (type) {
    case scriptTypes.P2PKH:
      // if (redeemScript) throw new Error('Nonstandard... P2SH(P2PKH)')
      pubKeys = chunks.slice(1)
      signatures = chunks.slice(0, 1)
      break

    case scriptTypes.P2PK:
      pubKeys[0] = null
      signatures = chunks.slice(0, 1)
      break

    case scriptTypes.MULTISIG:
      signatures = chunks.slice(1).map(function (chunk) {
        return chunk === ops.OP_0 ? undefined : chunk
      })
      break
  }
  return {
    pubKeys: pubKeys,
    signatures: signatures
  }
}

function expandInput (scriptSig, redeemScript, witnessStack) {
  var prevOutScript
  var prevOutType
  var witnessScript
  var witnessScriptType
  var witness = false
  var p2wsh = false
  var p2sh = false
  var witnessProgram

  var classifyWitness = bscript.classifyWitness(witnessStack);
  if (classifyWitness === scriptTypes.P2WSH) {
    witnessScript = witnessStack[witnessStack.length - 1]
    witnessScriptType = bscript.classifyOutput(witnessScript)
    p2wsh = true
    if (scriptSig.length === 0) {
      prevOutScript = bscript.witnessScriptHash.output.encode(bcrypto.sha256(witnessScript))
      // bare witness
    } else {
      if (!redeemScript) {
        throw new Error('No redeemScript provided for P2WSH, but scriptSig wasn\'t empty')
      }
      witnessProgram = bscript.witnessScriptHash.output.encode(bcrypto.sha256(witnessScript))
      if (!redeemScript.equals(witnessProgram)) {
        throw new Error('Redeem script didn\'t match witnessScript')
      }
      prevOutScript = bscript.scriptHash.output.encode(bscript.hash160(witnessProgram))
    }

    console.log(bscript.classifyOutput(witnessScript))
    console.log(SIGNABLE.indexOf(bscript.classifyOutput(witnessScript)))
    if (SIGNABLE.indexOf(bscript.classifyOutput(witnessScript)) === -1) {
      throw new Error('unsupported witness script')
    }
  } else if (classifyWitness === scriptTypes.P2WPKH) {
    var keyHash = witnessStack[witnessStack.length - 1]
    if (scriptSig.length === 0) {
      prevOutScript = bscript.witnessPubKeyHash.output.encode(keyHash)
      // bare witness
    } else {
      if (!redeemScript) {
        throw new Error('No redeemScript provided for P2WPKH, but scriptSig wasn\'t empty');
      }
      witnessProgram = bscript.witnessPubKeyHash.output.encode(keyHash)
      if (!redeemScript.equals(witnessProgram)) {
        throw new Error('Redeem script did not have the right witness program')
      }
      prevOutScript = bscript.scriptHash.output.encode(bcrypto.hash160(witnessProgram));
    }
  }

  if (typeof prevOutScript === 'undefined' && redeemScript) {
    prevOutScript = bscript.scriptHash.output.encode(bcrypto.hash160(redeemScript))
  }

  if (typeof prevOutScript === 'undefined' && scriptSig) {
    prevOutType = bscript.classifyInput(scriptSig)
    if (!(scriptTypes.P2SH === prevOutType || P2SH.indexOf(prevOutType) !== -1)) {
      throw new Error('Unsupported scriptSig')
    }
  }

  var scriptType = bscript.classifyOutput(prevOutScript)
  var redeemScriptType
  var chunks = bscript.toStack(scriptSig)
  if (scriptType === scriptTypes.P2SH) {
    p2sh = true
    scriptType = redeemScriptType = bscript.classifyOutput(redeemScript)
    if (P2SH.indexOf(scriptType) === -1) {
      throw new Error('P2SH script not supported ' + scriptType)
    }
    chunks = chunks.slice(0, -1)
  }

  if (scriptType === scriptTypes.P2WSH) {
    chunks = witnessStack.slice(0, -1)
    scriptType = bscript.classifyOutput(witnessScript)
  } else if (scriptType === scriptTypes.P2WPKH) {
    chunks = witnessStack
  }

  var expanded = extractChunks(scriptType, chunks)

  var result = {
    pubKeys: expanded.pubKeys,
    signatures: expanded.signatures,
    prevOutScript: prevOutScript,
    prevOutType: prevOutType
  }

  if (p2sh) {
    result.redeemScript = redeemScript
    result.redeemScriptType = redeemScriptType
  }

  if (p2wsh) {
    result.witnessScript = witnessScript
    result.witnessScriptType = witnessScriptType
  }

  return result
}

// inspects a scriptSig w/ optional redeemScript and
// derives any input information required
function expandInput2 (scriptSig, redeemScript, witnessStack) {
  var witnessType
  if (witnessStack) {
    witnessType = bscript.classifyWitness(witnessStack)
  }

  var prevOutType, scriptSigChunks
  if (scriptSig.length === 0 && witnessStack) {
    prevOutType = witnessType
  } else {
    scriptSigChunks = bscript.decompile(scriptSig)
    prevOutType = bscript.classifyInput(scriptSigChunks, true)
  }

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
      result.witness = false
      return result

    case scriptTypes.P2WPKH:
      pubKeys = witnessStack.slice(1)
      signatures = witnessStack.slice(0, 1)
      break

    case scriptTypes.NONSTANDARD:
      return { prevOutType: prevOutType, prevOutScript: EMPTY_SCRIPT }

    default: return {}
  }

  return {
    pubKeys: pubKeys,
    signatures: signatures,
    prevOutScript: prevOutScript,
    prevOutType: prevOutType,
    witness: Boolean(witnessStack)
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

    // does our hash160(pubKey) match the output scripts?
    case scriptTypes.P2WPKH:
      if (!ourPubKey) break

      var wpkh1 = scriptChunks[1]
      var wpkh2 = bcrypto.hash160(ourPubKey)
      if (wpkh1.equals(wpkh2)) pubKeys = [ourPubKey]
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

function checkP2shInput (input, redeemScriptHash) {
  if (input.prevOutType) {
    if (input.prevOutType !== scriptTypes.P2SH) throw new Error('PrevOutScript must be P2SH')

    var prevOutScriptScriptHash = bscript.decompile(input.prevOutScript)[1]
    if (!prevOutScriptScriptHash.equals(redeemScriptHash)) throw new Error('Inconsistent hash160(RedeemScript)')
  }
}

function checkP2WSHInput (input, witnessScriptHash) {
  if (input.prevOutType) {
    if (input.prevOutType !== scriptTypes.P2WSH) throw new Error('PrevOutScript must be P2WSH')

    var scriptHash = bscript.decompile(input.prevOutScript)[1]
    if (!scriptHash.equals(witnessScriptHash)) throw new Error('Inconsistent sha25(WitnessScript)')
  }
}

function prepareInput (input, kpPubKey, redeemScript, witnessValue, witnessScript) {
  var expanded
  var prevOutType
  var prevOutScript

  var p2sh = false
  var p2shType
  var redeemScriptHash

  var witness = false
  var p2wsh = false
  var witnessType
  var witnessScriptHash

  if (redeemScript && witnessScript) {
    redeemScriptHash = bcrypto.hash160(redeemScript)
    witnessScriptHash = bcrypto.sha256(witnessScript)
    checkP2shInput(input, redeemScriptHash)

    if (!redeemScript.equals(bscript.witnessScriptHash.output.encode(witnessScriptHash))) throw new Error('Witness script inconsistent with redeem script')

    expanded = expandOutput(witnessScript, undefined, kpPubKey)
    if (!expanded.pubKeys) throw new Error('WitnessScript not supported "' + bscript.toASM(redeemScript) + '"')

    prevOutType = bscript.types.P2SH
    prevOutScript = bscript.scriptHash.output.encode(redeemScriptHash)
    p2sh = witness = p2wsh = true
    p2shType = bscript.types.P2WSH
    witnessType = expanded.scriptType
  } else if (redeemScript) {
    redeemScriptHash = bcrypto.hash160(redeemScript)
    checkP2shInput(input, redeemScriptHash)

    expanded = expandOutput(redeemScript, undefined, kpPubKey)
    if (!expanded.pubKeys) throw new Error('RedeemScript not supported "' + bscript.toASM(redeemScript) + '"')

    prevOutType = bscript.types.P2SH
    prevOutScript = bscript.scriptHash.output.encode(redeemScriptHash)
    p2sh = true
    p2shType = expanded.scriptType
  } else if (witnessScript) {
    witnessScriptHash = bcrypto.sha256(witnessScript)
    checkP2WSHInput(input, witnessScriptHash)

    expanded = expandOutput(witnessScript, undefined, kpPubKey)
    if (!expanded.pubKeys) throw new Error('WitnessScript not supported "' + bscript.toASM(redeemScript) + '"')

    prevOutType = bscript.types.P2WSH
    prevOutScript = bscript.witnessScriptHash.output.encode(witnessScriptHash)
    witness = p2wsh = true
    witnessType = expanded.scriptType
  } else if (input.prevOutType) {
    // embedded scripts are not possible without a redeemScript
    if (input.prevOutType === scriptTypes.P2SH ||
      input.prevOutType === scriptTypes.P2WSH) {
      throw new Error('PrevOutScript is ' + input.prevOutType + ', requires redeemScript')
    }

    prevOutType = input.prevOutType
    prevOutScript = input.prevOutScript
    expanded = expandOutput(input.prevOutScript, input.prevOutType, kpPubKey)
    if (!expanded.pubKeys) return

    witness = (input.prevOutScript === scriptTypes.P2WPKH)
  } else {
    prevOutScript = bscript.witnessPubKeyHash.output.encode(bcrypto.hash160(kpPubKey))
    expanded = expandOutput(prevOutScript, scriptTypes.P2PKH, kpPubKey)
    prevOutType = scriptTypes.P2PKH
    witness = false
  }

  if (p2sh) {
    input.redeemScript = redeemScript
    input.redeemScriptType = p2shType
  }

  if (p2wsh) {
    input.witnessScript = witnessScript
    input.witnessScriptType = witnessType
  }

  input.pubKeys = expanded.pubKeys
  input.signatures = expanded.signatures
  input.prevOutScript = prevOutScript
  input.prevOutType = prevOutType
  input.witness = witness
}

function buildStack (type, signatures, pubKeys, allowIncomplete) {
  if (type === scriptTypes.P2PKH) {
    if (signatures.length < 1 || !signatures[0]) throw new Error('Not enough signatures provided')
    return bscript.pubKeyHash.input.encodeStack(signatures[0], pubKeys[0])
  } else if (type === scriptTypes.P2PK) {
    if (signatures.length < 1 || !signatures[0]) throw new Error('Not enough signatures provided')
    return bscript.pubKey.input.encodeStack(signatures[0])
  } else {
    signatures = signatures.map(function (signature) {
      return signature || ops.OP_0
    })

    if (!allowIncomplete) {
      // remove blank signatures
      signatures = signatures.filter(function (x) { return x !== ops.OP_0 })
    }

    return bscript.multisig.input.encodeStack(signatures /* see if it's necessary first */)
  }
}

function buildInput (input, allowIncomplete) {
  var scriptType = input.prevOutType
  var sig = []
  var witness = []
  if (SIGNABLE.indexOf(scriptType) !== -1) {
    sig = buildStack(scriptType, input.signatures, input.pubKeys, input.script, allowIncomplete)
  }

  var p2sh = false
  if (scriptType === bscript.types.P2SH) {
    // We can remove this error later when we have a guarantee prepareInput
    // rejects unsignabale scripts - it MUST be signable at this point.
    if (P2SH.indexOf(input.redeemScriptType) === -1) {
      throw new Error('Impossible to sign this type')
    }
    p2sh = true
    if (SIGNABLE.indexOf(input.redeemScriptType) !== -1) {
      sig = buildStack(input.redeemScriptType, input.signatures, input.pubKeys, allowIncomplete)
    }
    // If it wasn't SIGNABLE, it's witness, defer to that
    scriptType = input.redeemScriptType
  }

  if (scriptType === bscript.types.P2WPKH) {
    // P2WPKH is a special case of P2PKH
    witness = buildStack(bscript.types.P2PKH, input.signatures, input.pubKeys, allowIncomplete)
  } else if (scriptType === bscript.types.P2WSH) {
    // We can remove this check later
    if (SIGNABLE.indexOf(input.witnessScriptType) !== -1) {
      witness = buildStack(input.witnessScriptType, input.signatures, input.pubKeys, allowIncomplete)
      witness.push(input.witnessScript)
    } else {
      // We can remove this error later when we have a guarantee prepareInput
      // rejects unsignble scripts - it MUST be signable at this point.
      throw new Error()
    }

    scriptType = input.witnessScriptType
  }

  // append redeemScript if necessary
  if (p2sh) {
    sig.push(input.redeemScript)
  }

  return {
    type: scriptType,
    script: bscript.compile(sig),
    witness: witness
  }
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
    console.log('add input')
    txb.__addInputUnsafe(txIn.hash, txIn.index, {
      sequence: txIn.sequence,
      script: txIn.script,
      witness: txIn.witness
    })
    console.log('done input')
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
    txHash = new Buffer(txHash, 'hex').reverse()

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
    console.log('options.script provided, so peek')
    input = expandInput(options.script, null, options.witness)
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
  console.log(this.tx)
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
    console.log(input)
    var scriptType = input.witnessScriptType || input.redeemScriptType || input.prevOutType
    console.log(scriptType)
    if (!scriptType && !allowIncomplete) throw new Error('Transaction is not complete')
    var result = buildInput(input, allowIncomplete)

    // skip if no result
    if (!allowIncomplete) {
      if (SIGNABLE.indexOf(result.type) === -1 && result.type !== bscript.types.P2WPKH) {
        throw new Error(result.type + ' not supported')
      }
    }

    tx.setInputScript(i, result.script)
    tx.setWitness(i, result.witness)
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
    input.pubKeys.length > 0 &&
    input.witness !== undefined
}

TransactionBuilder.prototype.sign = function (vin, keyPair, redeemScript, hashType, witnessValue, witnessScript) {
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
    prepareInput(input, kpPubKey, redeemScript, witnessValue, witnessScript)

    if (!canSign(input)) throw Error(input.prevOutType + ' not supported')
  }

  // ready to sign
  var hashScript = input.witnessScript || input.redeemScript || input.prevOutScript

  var signatureHash
  if (input.witness) {
    signatureHash = this.tx.hashForWitnessV0(vin, hashScript, witnessValue, hashType)
    console.log(hashScript);
  } else {
    signatureHash = this.tx.hashForSignature(vin, hashScript, hashType)
  }

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
