var baddress = require('./address')
var bcrypto = require('./crypto')
var bscript = require('./script')
var bufferEquals = require('buffer-equals')
var bufferReverse = require('buffer-reverse')
var networks = require('./networks')
var ops = require('./opcodes.json')
var typeforce = require('typeforce')
var types = require('./types')

var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')
var Transaction = require('./transaction')

// inspects a scriptSig w/ optional provided redeemScript and derives
// all necessary input information as required by TransactionBuilder
function expandInput (scriptSig, redeemScript) {
  var scriptSigChunks = bscript.decompile(scriptSig)
  var scriptSigType = bscript.classifyInput(scriptSigChunks, true)

  var hashType, pubKeys, signatures, prevOutScript

  switch (scriptSigType) {
    case 'scripthash':
      // FIXME: maybe depth limit instead, how possible is this anyway?
      if (redeemScript) throw new Error('Recursive P2SH script')

      var redeemScriptSig = scriptSigChunks.slice(0, -1)
      redeemScript = scriptSigChunks[scriptSigChunks.length - 1]

      var result = expandInput(redeemScriptSig, redeemScript)
      result.redeemScript = redeemScript
      result.redeemScriptType = result.prevOutType
      result.prevOutScript = bscript.scriptHashOutput(bcrypto.hash160(redeemScript))
      result.prevOutType = 'scripthash'
      return result

    case 'pubkeyhash':
      // if (redeemScript) throw new Error('Nonstandard... P2SH(P2PKH)')
      var s = ECSignature.parseScriptSignature(scriptSigChunks[0])
      hashType = s.hashType
      pubKeys = scriptSigChunks.slice(1)
      signatures = [s.signature]

      if (redeemScript) break

      prevOutScript = bscript.pubKeyHashOutput(bcrypto.hash160(pubKeys[0]))
      break

    case 'pubkey':
      if (redeemScript) {
        pubKeys = bscript.decompile(redeemScript).slice(0, 1)
      }

      var ss = ECSignature.parseScriptSignature(scriptSigChunks[0])
      hashType = ss.hashType
      signatures = [ss.signature]
      break

    case 'multisig':
      if (redeemScript) {
        pubKeys = bscript.decompile(redeemScript).slice(1, -2)
      }

      signatures = scriptSigChunks.slice(1).map(function (chunk) {
        if (chunk === ops.OP_0) return undefined

        var sss = ECSignature.parseScriptSignature(chunk)

        if (hashType !== undefined) {
          if (sss.hashType !== hashType) throw new Error('Inconsistent hashType')
        } else {
          hashType = sss.hashType
        }

        return sss.signature
      })

      break
  }

  return {
    hashType: hashType,
    pubKeys: pubKeys,
    signatures: signatures,
    prevOutScript: prevOutScript,
    prevOutType: scriptSigType
  }
}

function expandOutput (script, ourPubKey) {
  typeforce(types.Buffer, script)

  var scriptChunks = bscript.decompile(script)
  var scriptType = bscript.classifyOutput(script)

  var pubKeys = []

  switch (scriptType) {
    // does our hash160(pubKey) match the output scripts?
    case 'pubkeyhash':
      if (!ourPubKey) break

      var pkh1 = scriptChunks[2]
      var pkh2 = bcrypto.hash160(ourPubKey)
      if (bufferEquals(pkh1, pkh2)) pubKeys = [ourPubKey]
      break

    case 'pubkey':
      pubKeys = scriptChunks.slice(0, 1)
      break

    case 'multisig':
      pubKeys = scriptChunks.slice(1, -2)
      break

    default: return
  }

  return {
    pubKeys: pubKeys,
    scriptType: scriptType,
    signatures: pubKeys.map(function () { return undefined })
  }
}

function buildInput (input, scriptType, allowIncomplete) {
  var signatures = input.signatures
  var scriptSig

  switch (scriptType) {
    case 'pubkeyhash':
      // remove blank signatures
      signatures = signatures.filter(function (x) { return x })

      if (signatures.length < 1) throw new Error('Not enough signatures provided')
      if (signatures.length > 1) throw new Error('Too many signatures provided')

      var pkhSignature = signatures[0].toScriptSignature(input.hashType)
      scriptSig = bscript.pubKeyHashInput(pkhSignature, input.pubKeys[0])
      break

    case 'pubkey':
      // remove blank signatures
      signatures = signatures.filter(function (x) { return x })

      if (signatures.length < 1) throw new Error('Not enough signatures provided')
      if (signatures.length > 1) throw new Error('Too many signatures provided')

      var pkSignature = signatures[0].toScriptSignature(input.hashType)
      scriptSig = bscript.pubKeyInput(pkSignature)
      break

    // ref https://github.com/bitcoin/bitcoin/blob/d612837814020ae832499d18e6ee5eb919a87907/src/script/sign.cpp#L232
    case 'multisig':
      signatures = signatures.map(function (signature) {
        return signature && signature.toScriptSignature(input.hashType)
      })

      if (allowIncomplete) {
        // fill in blanks with OP_0
        for (var i = 0; i < signatures.length; ++i) {
          signatures[i] = signatures[i] || ops.OP_0
        }
      } else {
        // remove blank signatures
        signatures = signatures.filter(function (x) { return x })
      }

      scriptSig = bscript.multisigInput(signatures, allowIncomplete ? undefined : input.redeemScript)
      break
  }

  // wrap as scriptHash if necessary
  if (input.prevOutType === 'scripthash') {
    scriptSig = bscript.scriptHashInput(scriptSig, input.redeemScript)
  }

  return scriptSig
}

function prepareInput (input, kpPubKey, redeemScript, hashType) {
  if (redeemScript) {
    var redeemScriptHash = bcrypto.hash160(redeemScript)

    // if redeemScript exists, it is pay-to-scriptHash
    // if we have a prevOutScript, enforce hash160(redeemScriptequality)  to the redeemScript
    if (input.prevOutType) {
      if (input.prevOutType !== 'scripthash') throw new Error('PrevOutScript must be P2SH')

      var prevOutScriptScriptHash = bscript.decompile(input.prevOutScript)[1]
      if (!bufferEquals(prevOutScriptScriptHash, redeemScriptHash)) throw new Error('Inconsistent hash160(RedeemScript)')

    // or, we don't have a prevOutScript, so generate a P2SH script
    } else {
      input.prevOutScript = bscript.scriptHashOutput(redeemScriptHash)
      input.prevOutType = 'scripthash'
    }

    var expanded = expandOutput(redeemScript, kpPubKey)
    if (!expanded) throw new Error('RedeemScript not supported "' + bscript.toASM(redeemScript) + '"')

    input.pubKeys = expanded.pubKeys
    input.redeemScript = redeemScript
    input.redeemScriptType = expanded.scriptType
    input.signatures = expanded.signatures

  // maybe we have some prior knowledge
  } else if (input.prevOutType && input.prevOutType !== 'pubkeyhash') {
    // pay-to-scriptHash is not possible without a redeemScript
    if (input.prevOutType === 'scripthash') throw new Error('PrevOutScript is P2SH, missing redeemScript')

    // throw if we can't sign with it
    if (!input.pubKeys || input.pubKeys.length === 0 || !input.signatures || input.signatures.length === 0) {
      throw new Error(input.prevOutType + ' not supported')
    }
    
  // no prior knowledge, assume pubKeyHash
  } else {
    input.prevOutScript = bscript.pubKeyHashOutput(bcrypto.hash160(kpPubKey))
    input.prevOutType = 'pubkeyhash'

    input.pubKeys = [kpPubKey]
    input.signatures = [undefined]
  }

  input.hashType = hashType
}

function fixMultisigOrder (input, transaction, vin) {
  var hashScriptType = input.redeemScriptType || input.prevOutType
  if (hashScriptType !== 'multisig') throw new TypeError('Expected multisig input')

  var hashType = input.hashType || Transaction.SIGHASH_ALL
  var hashScript = input.redeemScript || input.prevOutScript

  // maintain a local copy of unmatched signatures
  var unmatched = input.signatures.concat()
  var signatureHash = transaction.hashForSignature(vin, hashScript, hashType)

  input.signatures = input.pubKeys.map(function (pubKey, y) {
    var keyPair = ECPair.fromPublicKeyBuffer(pubKey)
    var match

    // check for a signature
    unmatched.some(function (signature, i) {
      // skip if undefined || OP_0
      if (!signature) return false

      // skip if signature does not match pubKey
      if (!keyPair.verify(signatureHash, signature)) return false

      // remove matched signature from unmatched
      unmatched[i] = undefined
      match = signature

      return true
    })

    return match || undefined
  })
}

function TransactionBuilder (network) {
  this.prevTxMap = {}
  this.network = network || networks.bitcoin

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
    txb.__addInputUnsafe(txIn.hash, txIn.index, txIn.sequence, txIn.script)
  })

  // fix some things not possible through the public API
  txb.inputs.forEach(function (input, i) {
    // attempt to fix any multisig inputs if they exist
    if ((input.redeemScriptType || input.prevOutType) === 'multisig') {
      // pubKeys will only exist for 'multisig' if a redeemScript was found
      if (!input.pubKeys || !input.signatures) return
      if (input.pubKeys.length === input.signatures.length) return

      fixMultisigOrder(input, transaction, i)
    }
  })

  return txb
}

TransactionBuilder.prototype.addInput = function (txHash, vout, sequence, prevOutScript) {
  if (!this.__canModifyInputs()) {
    throw new Error('No, this would invalidate signatures')
  }

  // is it a hex string?
  if (typeof txHash === 'string') {
    // transaction hashs's are displayed in reverse order, un-reverse it
    txHash = bufferReverse(new Buffer(txHash, 'hex'))

  // is it a Transaction object?
  } else if (txHash instanceof Transaction) {
    prevOutScript = txHash.outs[vout].script
    txHash = txHash.getHash()
  }

  return this.__addInputUnsafe(txHash, vout, sequence, null, prevOutScript)
}

TransactionBuilder.prototype.__addInputUnsafe = function (txHash, vout, sequence, scriptSig, prevOutScript) {
  if (Transaction.isCoinbaseHash(txHash)) {
    throw new Error('coinbase inputs not supported')
  }

  var prevTxOut = txHash.toString('hex') + ':' + vout
  if (this.prevTxMap[prevTxOut]) throw new Error('Duplicate TxOut: ' + prevTxOut)

  var input = {}

  // derive what we can from the scriptSig
  if (scriptSig) {
    input = expandInput(scriptSig)
  }

  // derive what we can from the previous transactions output script
  if (!input.prevOutScript && prevOutScript) {
    var prevOutScriptChunks = bscript.decompile(prevOutScript)
    var prevOutType = bscript.classifyOutput(prevOutScriptChunks)

    if (!input.pubKeys && !input.signatures) {
      var expanded = expandOutput(prevOutScript)
      if (expanded) {
        input.pubKeys = expanded.pubKeys
        input.signatures = expanded.signatures
      }
    }

    input.prevOutScript = prevOutScript
    input.prevOutType = prevOutType
  }

  var vin = this.tx.addInput(txHash, vout, sequence, scriptSig)
  this.inputs[vin] = input
  this.prevTxMap[prevTxOut] = true

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

var canBuildTypes = {
  'multisig': true,
  'pubkey': true,
  'pubkeyhash': true
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

    if (!allowIncomplete) {
      if (!scriptType) throw new Error('Transaction is not complete')
      if (!canBuildTypes[scriptType]) throw new Error(scriptType + ' not supported')

      // FIXME: only relevant to types that need signatures
      if (!input.signatures) throw new Error('Transaction is missing signatures')
    }

    // FIXME: only relevant to types that need signatures
    // skip if no scriptSig exists
    if (!input.signatures) return

    // build a scriptSig
    var scriptSig = buildInput(input, scriptType, allowIncomplete)
    tx.setInputScript(i, scriptSig)
  })

  return tx
}

TransactionBuilder.prototype.sign = function (vin, keyPair, redeemScript, hashType) {
  if (keyPair.network !== this.network) throw new Error('Inconsistent network')
  if (!this.inputs[vin]) throw new Error('No input at index: ' + vin)
  hashType = hashType || Transaction.SIGHASH_ALL

  var input = this.inputs[vin]
  var canSign = input.hashType !== undefined &&
    input.prevOutScript !== undefined &&
    input.pubKeys !== undefined &&
    input.signatures !== undefined &&
    input.signatures.length === input.pubKeys.length

  var kpPubKey = keyPair.getPublicKeyBuffer()

  if (canSign) {
    // if redeemScript was provided, enforce consistency
    if (redeemScript) {
      if (!bufferEquals(input.redeemScript, redeemScript)) throw new Error('Inconsistent redeemScript')
    }

    if (input.hashType !== hashType) throw new Error('Inconsistent hashType')
  } else {
    prepareInput(input, kpPubKey, redeemScript, hashType)
  }

  // ready to sign
  var hashScript = input.redeemScript || input.prevOutScript
  var signatureHash = this.tx.hashForSignature(vin, hashScript, hashType)

  // enforce in order signing of public keys
  var valid = input.pubKeys.some(function (pubKey, i) {
    if (!bufferEquals(kpPubKey, pubKey)) return false
    if (input.signatures[i]) throw new Error('Signature already exists')

    input.signatures[i] = keyPair.sign(signatureHash)
    return true
  })

  if (!valid) throw new Error('Key pair cannot sign for this input')
}

TransactionBuilder.prototype.__canModifyInputs = function () {
  return this.inputs.every(function (otherInput) {
    // no signature
    if (otherInput.hashType === undefined) return true

    // if SIGHASH_ANYONECANPAY is set, signatures would not
    // be invalidated by more inputs
    return otherInput.hashType & Transaction.SIGHASH_ANYONECANPAY
  })
}

TransactionBuilder.prototype.__canModifyOutputs = function () {
  var nInputs = this.tx.ins.length
  var nOutputs = this.tx.outs.length

  return this.inputs.every(function (input, i) {
    // any signatures?
    if (input.hashType === undefined) return true

    var hashTypeMod = input.hashType & 0x1f
    if (hashTypeMod === Transaction.SIGHASH_NONE) return true
    if (hashTypeMod === Transaction.SIGHASH_SINGLE) {
      // if SIGHASH_SINGLE is set, and nInputs > nOutputs
      // some signatures would be invalidated by the addition
      // of more outputs
      return nInputs <= nOutputs
    }

    return false
  })
}

module.exports = TransactionBuilder
