var bcrypto = require('./crypto')
var bufferutils = require('./bufferutils')
var networks = require('./networks')
var ops = require('./opcodes')
var scripts = require('./scripts')

var Address = require('./address')
var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')
var Transaction = require('./transaction')

function extractInput (txIn) {
  var redeemScript
  var scriptSig = txIn.script
  var scriptSigChunks = scripts.decompileToChunks(scriptSig)

  var prevOutScript
  var prevOutType = scripts.classifyInput(scriptSig, true)
  var scriptType

  // Re-classify if scriptHash
  if (prevOutType === 'scripthash') {
    redeemScript = scriptSigChunks.slice(-1)[0]
    prevOutScript = scripts.scriptHashOutput(bcrypto.hash160(redeemScript))

    scriptSig = scripts.compileToBuffer(scriptSigChunks.slice(0, -1))
    scriptSigChunks = scriptSigChunks.slice(0, -1)

    scriptType = scripts.classifyInput(scriptSig, true)
  } else {
    scriptType = prevOutType
  }

  // pre-empt redeemScript decompilation
  var redeemScriptChunks
  if (redeemScript) {
    redeemScriptChunks = scripts.decompileToChunks(redeemScript)
  }

  // Extract hashType, pubKeys and signatures
  var hashType, parsed, pubKeys, signatures

  switch (scriptType) {
    case 'pubkeyhash':
      parsed = ECSignature.parseScriptSignature(scriptSigChunks[0])
      hashType = parsed.hashType
      pubKeys = scriptSigChunks.slice(1)
      signatures = [parsed.signature]
      prevOutScript = scripts.pubKeyHashOutput(bcrypto.hash160(pubKeys[0]))

      break

    case 'pubkey':
      parsed = ECSignature.parseScriptSignature(scriptSigChunks[0])
      hashType = parsed.hashType
      signatures = [parsed.signature]

      if (redeemScript) {
        pubKeys = redeemScriptChunks.slice(0, 1)
      }

      break

    case 'multisig':
      signatures = scriptSigChunks.slice(1).map(function (chunk) {
        if (chunk === ops.OP_0) return chunk

        var parsed = ECSignature.parseScriptSignature(chunk)
        hashType = parsed.hashType

        return parsed.signature
      })

      if (redeemScript) {
        pubKeys = redeemScriptChunks.slice(1, -2)
      }

      break
  }

  return {
    hashType: hashType,
    prevOutScript: prevOutScript,
    prevOutType: prevOutType,
    pubKeys: pubKeys,
    redeemScript: redeemScript,
    scriptType: scriptType,
    signatures: signatures
  }
}

function TransactionBuilder (network) {
  this.prevTxMap = {}
  this.prevOutScripts = {}
  this.prevOutTypes = {}
  this.network = network || networks.bitcoin

  this.inputs = []
  this.tx = new Transaction()
}

TransactionBuilder.fromTransaction = function (transaction, network) {
  var txb = new TransactionBuilder(network)

  // Copy other transaction fields
  txb.tx.version = transaction.version
  txb.tx.locktime = transaction.locktime

  // Extract/add inputs
  transaction.ins.forEach(function (txIn) {
    txb.addInput(txIn.hash, txIn.index, txIn.sequence)
  })

  // Extract/add outputs
  transaction.outs.forEach(function (txOut) {
    txb.addOutput(txOut.script, txOut.value)
  })

  // Extract/add signatures
  txb.inputs = transaction.ins.map(function (txIn) {
    // TODO: verify whether extractInput is sane with coinbase scripts
    if (Transaction.isCoinbaseHash(txIn.hash)) {
      throw new Error('coinbase inputs not supported')
    }

    // Ignore empty scripts
    if (txIn.script.length === 0) return {}

    return extractInput(txIn)
  })

  return txb
}

TransactionBuilder.prototype.addInput = function (txHash, vout, sequence, prevOutScript) {
  // is it a txId?
  if (typeof txHash === 'string') {
    // a txId is big-endian hex, we want a little-endian Buffer
    txHash = new Buffer(txHash, 'hex')
    Array.prototype.reverse.call(txHash)

  // is it a Transaction?
  } else if (txHash instanceof Transaction) {
    prevOutScript = txHash.outs[vout].script
    txHash = txHash.getHash()
  }

  var input = {}
  if (prevOutScript) {
    var prevOutScriptChunks = scripts.decompileToChunks(prevOutScript)
    var prevOutType = scripts.classifyOutput(prevOutScriptChunks)

    // if we can, extract pubKey information
    switch (prevOutType) {
      case 'multisig':
        input.pubKeys = prevOutScriptChunks.slice(1, -2)
        break

      case 'pubkey':
        input.pubKeys = prevOutScriptChunks.slice(0, 1)
        break
    }

    if (prevOutType !== 'scripthash') {
      input.scriptType = prevOutType
    }

    input.prevOutScript = prevOutScript
    input.prevOutType = prevOutType
  }

  var valid = this.inputs.every(function (input2) {
    if (input2.hashType === undefined) return true

    return input2.hashType & Transaction.SIGHASH_ANYONECANPAY
  })

  if (!valid) throw new Error('No, this would invalidate signatures')

  var prevOut = txHash.toString('hex') + ':' + vout
  if (this.prevTxMap[prevOut]) throw new Error('Transaction is already an input')

  var vin = this.tx.addInput(txHash, vout, sequence)
  this.inputs[vin] = input
  this.prevTxMap[prevOut] = vin

  return vin
}

TransactionBuilder.prototype.addOutput = function (scriptPubKey, value) {
  var valid = this.inputs.every(function (input) {
    if (input.hashType === undefined) return true

    return (input.hashType & 0x1f) === Transaction.SIGHASH_SINGLE
  })

  if (!valid) throw new Error('No, this would invalidate signatures')

  // Attempt to get a script if it's a base58 address string
  if (typeof scriptPubKey === 'string') {
    scriptPubKey = Address.toOutputScript(scriptPubKey, this.network)
  }

  return this.tx.addOutput(scriptPubKey, value)
}

TransactionBuilder.prototype.build = function () {
  return this.__build(false)
}
TransactionBuilder.prototype.buildIncomplete = function () {
  return this.__build(true)
}

var canSignTypes = {
  'pubkeyhash': true,
  'multisig': true,
  'pubkey': true
}

TransactionBuilder.prototype.__build = function (allowIncomplete) {
  if (!allowIncomplete) {
    if (!this.tx.ins.length) throw new Error('Transaction has no inputs')
    if (!this.tx.outs.length) throw new Error('Transaction has no outputs')
  }

  var tx = this.tx.clone()

  // Create script signatures from signature meta-data
  this.inputs.forEach(function (input, index) {
    var scriptType = input.scriptType
    var scriptSig

    if (!allowIncomplete) {
      if (!scriptType) throw new Error('Transaction is not complete')
      if (!canSignTypes[scriptType]) throw new Error(scriptType + ' not supported')
      if (!input.signatures) throw new Error('Transaction is missing signatures')
    }

    if (input.signatures) {
      switch (scriptType) {
        case 'pubkeyhash':
          var pkhSignature = input.signatures[0].toScriptSignature(input.hashType)
          scriptSig = scripts.pubKeyHashInput(pkhSignature, input.pubKeys[0])
          break

        case 'multisig':
          // Array.prototype.map is sparse-compatible
          var msSignatures = input.signatures.map(function (signature) {
            return signature && signature.toScriptSignature(input.hashType)
          })

          // fill in blanks with OP_0
          if (allowIncomplete) {
            for (var i = 0; i < msSignatures.length; ++i) {
              if (msSignatures[i]) continue

              msSignatures[i] = ops.OP_0
            }
          } else {
            // Array.prototype.filter returns non-sparse array
            msSignatures = msSignatures.filter(function (x) { return x })
          }

          var redeemScript = allowIncomplete ? undefined : input.redeemScript
          scriptSig = scripts.multisigInput(msSignatures, redeemScript)
          break

        case 'pubkey':
          var pkSignature = input.signatures[0].toScriptSignature(input.hashType)
          scriptSig = scripts.pubKeyInput(pkSignature)
          break
      }
    }

    // did we build a scriptSig?
    if (scriptSig) {
      // wrap as scriptHash if necessary
      if (input.prevOutType === 'scripthash') {
        scriptSig = scripts.scriptHashInput(scriptSig, input.redeemScript)
      }

      tx.setInputScript(index, scriptSig)
    }
  })

  return tx
}

TransactionBuilder.prototype.sign = function (index, keyPair, redeemScript, hashType) {
  if (keyPair.network !== this.network) throw new Error('Inconsistent network')
  if (!this.inputs[index]) throw new Error('No input at index: ' + index)
  hashType = hashType || Transaction.SIGHASH_ALL

  var input = this.inputs[index]
  var canSign = input.hashType &&
    input.prevOutScript &&
    input.prevOutType &&
    input.pubKeys &&
    input.scriptType &&
    input.signatures

  var kpPubKey = keyPair.getPublicKeyBuffer()

  // are we almost ready to sign?
  if (canSign) {
    // if redeemScript was provided, enforce consistency
    if (redeemScript) {
      if (!bufferutils.equal(input.redeemScript, redeemScript)) throw new Error('Inconsistent redeemScript')
    }

    if (input.hashType !== hashType) throw new Error('Inconsistent hashType')

  // no? prepare
  } else {
    // must be pay-to-scriptHash?
    if (redeemScript) {
      // if we have a prevOutScript, enforce scriptHash equality to the redeemScript
      if (input.prevOutScript) {
        if (input.prevOutType !== 'scripthash') throw new Error('PrevOutScript must be P2SH')

        var scriptHash = scripts.decompileToChunks(input.prevOutScript)[1]
        if (!bufferutils.equal(scriptHash, bcrypto.hash160(redeemScript))) throw new Error('RedeemScript does not match ' + scriptHash.toString('hex'))
      }

      var scriptType = scripts.classifyOutput(redeemScript)
      if (!canSignTypes[scriptType]) throw new Error('RedeemScript not supported (' + scriptType + ')')

      var redeemScriptChunks = scripts.decompileToChunks(redeemScript)
      var pubKeys = []
      switch (scriptType) {
        case 'multisig':
          pubKeys = redeemScriptChunks.slice(1, -2)
          break

        case 'pubkeyhash':
          var pkh1 = redeemScriptChunks[2]
          var pkh2 = bcrypto.hash160(keyPair.getPublicKeyBuffer())

          if (!bufferutils.equal(pkh1, pkh2)) throw new Error('privateKey cannot sign for this input')
          pubKeys = [kpPubKey]
          break

        case 'pubkey':
          pubKeys = redeemScriptChunks.slice(0, 1)
          break
      }

      // if we don't have a prevOutScript, generate a P2SH script
      if (!input.prevOutScript) {
        input.prevOutScript = scripts.scriptHashOutput(bcrypto.hash160(redeemScript))
        input.prevOutType = 'scripthash'
      }

      input.pubKeys = pubKeys
      input.redeemScript = redeemScript
      input.scriptType = scriptType

    // cannot be pay-to-scriptHash
    } else {
      if (input.prevOutType === 'scripthash') throw new Error('PrevOutScript is P2SH, missing redeemScript')

      // can we otherwise sign this?
      if (input.scriptType) {
        if (!input.pubKeys) throw new Error(input.scriptType + ' not supported')

      // we know nothin' Jon Snow, assume pubKeyHash
      } else {
        input.prevOutScript = scripts.pubKeyHashOutput(bcrypto.hash160(keyPair.getPublicKeyBuffer()))
        input.prevOutType = 'pubkeyhash'
        input.pubKeys = [kpPubKey]
        input.scriptType = input.prevOutType
      }
    }

    input.hashType = hashType
    input.signatures = input.signatures || []
  }

  var signatureScript = input.redeemScript || input.prevOutScript
  var signatureHash = this.tx.hashForSignature(index, signatureScript, hashType)

  // enforce signature order matches public keys
  if (input.scriptType === 'multisig' && input.redeemScript && input.signatures.length !== input.pubKeys.length) {
    // maintain a local copy of unmatched signatures
    var unmatched = input.signatures.slice()

    input.signatures = input.pubKeys.map(function (pubKey) {
      var match
      var keyPair2 = ECPair.fromPublicKeyBuffer(pubKey)

      // check for any matching signatures
      unmatched.some(function (signature, i) {
        if (!signature || !keyPair2.verify(signatureHash, signature)) return false
        match = signature

        // remove matched signature from unmatched
        unmatched.splice(i, 1)

        return true
      })

      return match || undefined
    })
  }

  // enforce in order signing of public keys
  var valid = input.pubKeys.some(function (pubKey, i) {
    if (!bufferutils.equal(kpPubKey, pubKey)) return false
    if (input.signatures[i]) throw new Error('Signature already exists')

    var signature = keyPair.sign(signatureHash)
    input.signatures[i] = signature

    return true
  })

  if (!valid) throw new Error('Key pair cannot sign for this input')
}

module.exports = TransactionBuilder
