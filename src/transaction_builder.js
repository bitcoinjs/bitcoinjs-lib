var assert = require('assert')
var scripts = require('./scripts')

var ECPubKey = require('./ecpubkey')
var ECSignature = require('./ecsignature')
var Script = require('./script')
var Transaction = require('./transaction')

function extractInput(txIn, tx, vout) {
  assert(!Array.prototype.every.call(txIn.hash, function(x) {
    return x === 0
  }), 'coinbase inputs not supported')

  var redeemScript
  var scriptSig = txIn.script
  var prevOutScript
  var prevOutType = scripts.classifyInput(scriptSig)
  var scriptType

  // Re-classify if P2SH
  if (prevOutType === 'scripthash') {
    redeemScript = Script.fromBuffer(scriptSig.chunks.slice(-1)[0])
    prevOutScript = scripts.scriptHashOutput(redeemScript.getHash())

    scriptSig = Script.fromChunks(scriptSig.chunks.slice(0, -1))
    scriptType = scripts.classifyInput(scriptSig)
    assert.equal(scripts.classifyOutput(redeemScript), scriptType, 'Non-matching scriptSig and scriptPubKey in input')

  } else {
    scriptType = prevOutType
  }

  // Extract hashType, pubKeys and signatures
  var hashType, initialized, parsed, pubKeys, signatures

  switch (scriptType) {
    case 'pubkeyhash':
      parsed = ECSignature.parseScriptSignature(scriptSig.chunks[0])
      hashType = parsed.hashType
      pubKeys = [ECPubKey.fromBuffer(scriptSig.chunks[1])]
      signatures = [parsed.signature]

      initialized = true
      prevOutScript = pubKeys[0].getAddress().toOutputScript()

      break

    case 'pubkey':
      parsed = ECSignature.parseScriptSignature(scriptSig.chunks[0])
      hashType = parsed.hashType
      signatures = [parsed.signature]
      initialized = true

      if (redeemScript) {
        pubKeys = [ECPubKey.fromBuffer(redeemScript.chunks[0])]
      }

      break

    case 'multisig':
      parsed = scriptSig.chunks.slice(1).map(ECSignature.parseScriptSignature)
      hashType = parsed[0].hashType
      signatures = parsed.map(function(p) { return p.signature })
      initialized = true

      if (redeemScript) {
        pubKeys = redeemScript.chunks.slice(1, -2).map(ECPubKey.fromBuffer)

        // offset signatures such that they are in order
        var signatureHash = tx.hashForSignature(vout, redeemScript, hashType)

        var offset = 0
        pubKeys.some(function(pubKey) {
          if (pubKey.verify(signatureHash, signatures[offset])) return true

          offset++
          signatures = [,].concat(signatures)
          assert(signatures.length <= pubKeys.length, 'Invalid multisig scriptSig')
        })
      }

      break

    default:
      if (redeemScript) {
        initialized = true
      }

      break
  }

  return {
    hashType: hashType,
    initialized: initialized,
    prevOutScript: prevOutScript,
    prevOutType: prevOutType,
    pubKeys: pubKeys,
    redeemScript: redeemScript,
    scriptType: scriptType,
    signatures: signatures
  }
}

function TransactionBuilder() {
  this.prevTxMap = {}

  this.inputs = []
  this.tx = new Transaction()
}

// Static constructors
TransactionBuilder.fromTransaction = function(transaction) {
  var txb = new TransactionBuilder()

  // Copy other transaction fields
  txb.tx.version = transaction.version
  txb.tx.locktime = transaction.locktime

  // Extract/add inputs
  transaction.ins.forEach(function(txIn) {
    txb.addInput(txIn.hash, txIn.index, txIn.sequence)
  })

  // Extract/add outputs
  transaction.outs.forEach(function(txOut) {
    txb.addOutput(txOut.script, txOut.value)
  })

  // Extract/add signatures
  txb.inputs = transaction.ins.map(function(txIn, vout) {
    // Coinbase inputs not supported
    assert(!Array.prototype.every.call(txIn.hash, function(x) {
      return x === 0
    }), 'coinbase inputs not supported')

    // Ignore empty scripts
    if (txIn.script.buffer.length === 0) return

    return extractInput(txIn, transaction, vout)
  })

  return txb
}

// Operations
TransactionBuilder.prototype.addInput = function(prevTx, index, sequence, prevOutScript) {
  var prevOutHash

  if (typeof prevTx === 'string') {
    prevOutHash = new Buffer(prevTx, 'hex')

    // TxId hex is big-endian, we want little-endian hash
    Array.prototype.reverse.call(prevOutHash)

  } else if (prevTx instanceof Transaction) {
    prevOutHash = prevTx.getHash()
    prevOutScript = prevTx.outs[index].script

  } else {
    prevOutHash = prevTx

  }

  var input = {}
  if (prevOutScript) {
    var prevOutType = scripts.classifyOutput(prevOutScript)

    // if we can, extract pubKey information
    switch (prevOutType) {
      case 'multisig':
        input.pubKeys = prevOutScript.chunks.slice(1, -2).map(ECPubKey.fromBuffer)
        break

      case 'pubkey':
        input.pubKeys = prevOutScript.chunks.slice(0, 1).map(ECPubKey.fromBuffer)
        break
    }

    if (prevOutType !== 'scripthash') {
      input.scriptType = prevOutType
    }

    input.prevOutScript = prevOutScript
    input.prevOutType = prevOutType
  }

  assert(this.inputs.every(function(input2) {
    if (input2.hashType === undefined) return true

    return input2.hashType & Transaction.SIGHASH_ANYONECANPAY
  }), 'No, this would invalidate signatures')

  var prevOut = prevOutHash.toString('hex') + ':' + index
  assert(!(prevOut in this.prevTxMap), 'Transaction is already an input')

  var vout = this.tx.addInput(prevOutHash, index, sequence)

  this.prevTxMap[prevOut] = true
  this.inputs[vout] = input

  return vout
}

TransactionBuilder.prototype.addOutput = function(scriptPubKey, value) {
  assert(this.inputs.every(function(input) {
    if (input.hashType === undefined) return true

    return (input.hashType & 0x1f) === Transaction.SIGHASH_SINGLE
  }), 'No, this would invalidate signatures')

  return this.tx.addOutput(scriptPubKey, value)
}

TransactionBuilder.prototype.build = function() {
  return this.__build(false)
}

TransactionBuilder.prototype.buildIncomplete = function() {
  return this.__build(true)
}

TransactionBuilder.prototype.__build = function(allowIncomplete) {
  if (!allowIncomplete) {
    assert(this.tx.ins.length > 0, 'Transaction has no inputs')
    assert(this.tx.outs.length > 0, 'Transaction has no outputs')
  }

  var tx = this.tx.clone()

  // Create script signatures from signature meta-data
  this.inputs.forEach(function(input, index) {
    if (!allowIncomplete) {
      assert(input.initialized, 'Transaction is not complete')
    }

    var scriptSig

    switch (input.scriptType) {
      case 'pubkeyhash':
        assert(input.signatures, 'Transaction is missing signatures')
        assert.equal(input.signatures.length, 1, 'Transaction is missing signatures')

        var pkhSignature = input.signatures[0].toScriptSignature(input.hashType)
        scriptSig = scripts.pubKeyHashInput(pkhSignature, input.pubKeys[0])
        break

      case 'multisig':
        assert(input.signatures, 'Transaction is missing signatures')

        var signatures = input.signatures.map(function(signature) {
          return signature.toScriptSignature(input.hashType)
        }).filter(function(signature) { return !!signature })

        var redeemScript = allowIncomplete ? undefined : input.redeemScript
        scriptSig = scripts.multisigInput(signatures, redeemScript)
        break

      case 'pubkey':
        assert(input.signatures, 'Transaction is missing signatures')
        assert.equal(input.signatures.length, 1, 'Transaction is missing signatures')

        var pkSignature = input.signatures[0].toScriptSignature(input.hashType)
        scriptSig = scripts.pubKeyInput(pkSignature)
        break

      default:
        if (allowIncomplete) return

        assert(false, input.scriptType + ' not supported')
    }

    if (input.redeemScript) {
      scriptSig = scripts.scriptHashInput(scriptSig, input.redeemScript)
    }

    tx.setInputScript(index, scriptSig)
  })

  return tx
}

TransactionBuilder.prototype.sign = function(index, privKey, redeemScript, hashType) {
  assert(index in this.inputs, 'No input at index: ' + index)
  hashType = hashType || Transaction.SIGHASH_ALL

  var input = this.inputs[index]

  if (input.hashType !== undefined) {
    assert.equal(input.hashType, hashType, 'Inconsistent hashType')
  }

  // are we already initialized?
  if (input.initialized) {
    if (input.prevOutType === 'scripthash') {
      assert(input.redeemScript, 'PrevOutScript is P2SH, missing redeemScript')

    } else {
      assert(!input.redeemScript, 'PrevOutScript must be P2SH')
    }

    // redeemScript only needed to initialize, but if provided again, enforce consistency
    if (redeemScript) {
      assert.deepEqual(input.redeemScript, redeemScript, 'Inconsistent redeemScript')
    }

    // if signatures already exist, enforce multisig scriptType
    if (input.signatures.length > 0) {
      assert.equal(input.scriptType, 'multisig', input.scriptType + ' doesn\'t support multiple signatures')
    }

  // initialize it
  } else {
    if (redeemScript) {
      if (input.prevOutScript) {
        assert.equal(input.prevOutType, 'scripthash', 'PrevOutScript must be P2SH')

        var scriptHash = input.prevOutScript.chunks[1]
        assert.deepEqual(scriptHash, redeemScript.getHash(), 'RedeemScript does not match ' + scriptHash.toString('hex'))

      } else {
        input.prevOutScript = scripts.scriptHashOutput(redeemScript.getHash())
        input.prevOutType = 'scripthash'
      }

      var scriptType = scripts.classifyOutput(redeemScript)

      switch (scriptType) {
        case 'multisig':
          input.pubKeys = redeemScript.chunks.slice(1, -2).map(ECPubKey.fromBuffer)
          break

        case 'pubkeyhash':
          var pkh1 = redeemScript.chunks[2]
          var pkh2 = privKey.pub.getAddress().hash

          assert.deepEqual(pkh1, pkh2, 'privateKey cannot sign for this input')
          input.pubKeys = [privKey.pub]
          break

        case 'pubkey':
          input.pubKeys = redeemScript.chunks.slice(0, 1).map(ECPubKey.fromBuffer)
          break

        default:
          assert(false, 'RedeemScript not supported (' + scriptType + ')')
      }

      input.redeemScript = redeemScript
      input.scriptType = scriptType

    } else {
      assert.notEqual(input.prevOutType, 'scripthash', 'PrevOutScript is P2SH, missing redeemScript')

      if (!input.scriptType) {
        input.prevOutScript = privKey.pub.getAddress().toOutputScript()
        input.prevOutType = 'pubkeyhash'
        input.pubKeys = [privKey.pub]
        input.scriptType = input.prevOutType
      }
    }

    input.hashType = hashType
    input.initialized = true
    input.signatures = input.signatures || []
  }

  switch (input.scriptType) {
    case 'pubkeyhash':
    case 'multisig':
    case 'pubkey':
      break

    default:
      assert(false, input.scriptType + ' not supported')
  }

  var signatureHash
  if (input.redeemScript) {
    signatureHash = this.tx.hashForSignature(index, input.redeemScript, hashType)

  } else {
    signatureHash = this.tx.hashForSignature(index, input.prevOutScript, hashType)
  }

  var signature = privKey.sign(signatureHash)

  // enforce signing in order of public keys
  assert(input.pubKeys.some(function(pubKey, i) {
    if (!privKey.pub.Q.equals(pubKey.Q)) return false

    assert(!input.signatures[i], 'Signature already exists')
    input.signatures[i] = signature

    return true
  }), 'privateKey cannot sign for this input')
}

module.exports = TransactionBuilder
