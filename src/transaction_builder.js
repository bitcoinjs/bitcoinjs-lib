var assert = require('assert')
var ops = require('./opcodes')
var scripts = require('./scripts')

var ECPubKey = require('./ecpubkey')
var ECSignature = require('./ecsignature')
var Script = require('./script')
var Transaction = require('./transaction')

function extractInput(txIn) {
  var redeemScript
  var scriptSig = txIn.script
  var prevOutScript
  var prevOutType = scripts.classifyInput(scriptSig, true)
  var scriptType

  // Re-classify if scriptHash
  if (prevOutType === 'scripthash') {
    redeemScript = Script.fromBuffer(scriptSig.chunks.slice(-1)[0])
    prevOutScript = scripts.scriptHashOutput(redeemScript.getHash())

    scriptSig = Script.fromChunks(scriptSig.chunks.slice(0, -1))
    scriptType = scripts.classifyInput(scriptSig, true)

  } else {
    scriptType = prevOutType
  }

  // Extract hashType, pubKeys and signatures
  var hashType, parsed, pubKeys, signatures

  switch (scriptType) {
    case 'pubkeyhash': {
      parsed = ECSignature.parseScriptSignature(scriptSig.chunks[0])
      hashType = parsed.hashType
      pubKeys = [ECPubKey.fromBuffer(scriptSig.chunks[1])]
      signatures = [parsed.signature]
      prevOutScript = pubKeys[0].getAddress().toOutputScript()

      break
    }

    case 'pubkey': {
      parsed = ECSignature.parseScriptSignature(scriptSig.chunks[0])
      hashType = parsed.hashType
      signatures = [parsed.signature]

      if (redeemScript) {
        pubKeys = [ECPubKey.fromBuffer(redeemScript.chunks[0])]
      }

      break
    }

    case 'multisig': {
      signatures = scriptSig.chunks.slice(1).map(function(chunk) {
        if (chunk === ops.OP_0) return chunk

        var parsed = ECSignature.parseScriptSignature(chunk)
        hashType = parsed.hashType

        return parsed.signature
      })

      if (redeemScript) {
        pubKeys = redeemScript.chunks.slice(1, -2).map(ECPubKey.fromBuffer)
      }

      break
    }
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

function TransactionBuilder() {
  this.prevTxMap = {}
  this.prevOutScripts = {}
  this.prevOutTypes = {}

  this.inputs = []
  this.tx = new Transaction()
}

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
  txb.inputs = transaction.ins.map(function(txIn) {
    // TODO: remove me after testcase added
    assert(!Transaction.isCoinbaseHash(txIn.hash), 'coinbase inputs not supported')

    // Ignore empty scripts
    if (txIn.script.buffer.length === 0) return

    return extractInput(txIn)
  })

  return txb
}

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

  var vin = this.tx.addInput(prevOutHash, index, sequence)
  this.inputs[vin] = input
  this.prevTxMap[prevOut] = vin

  return vin
}

TransactionBuilder.prototype.addOutput = function(scriptPubKey, value) {
  assert(this.inputs.every(function(input) {
    if (input.hashType === undefined) return true

    return (input.hashType & 0x1f) === Transaction.SIGHASH_SINGLE
  }), 'No, this would invalidate signatures')

  return this.tx.addOutput(scriptPubKey, value)
}

TransactionBuilder.prototype.build = function() { return this.__build(false) }
TransactionBuilder.prototype.buildIncomplete = function() { return this.__build(true) }

var canSignTypes = { 'pubkeyhash': true, 'multisig': true, 'pubkey': true }

TransactionBuilder.prototype.__build = function(allowIncomplete) {
  if (!allowIncomplete) {
    assert(this.tx.ins.length > 0, 'Transaction has no inputs')
    assert(this.tx.outs.length > 0, 'Transaction has no outputs')
  }

  var tx = this.tx.clone()

  // Create script signatures from signature meta-data
  this.inputs.forEach(function(input, index) {
    var scriptType = input.scriptType
    var scriptSig

    if (!allowIncomplete) {
      assert(!!scriptType, 'Transaction is not complete')
      assert(scriptType in canSignTypes, scriptType + ' not supported')
      assert(input.signatures, 'Transaction is missing signatures')
    }

    if (input.signatures) {
      switch (scriptType) {
        case 'pubkeyhash':
          var pkhSignature = input.signatures[0].toScriptSignature(input.hashType)
          scriptSig = scripts.pubKeyHashInput(pkhSignature, input.pubKeys[0])
          break

        case 'multisig':
          // Array.prototype.map is sparse-compatible
          var msSignatures = input.signatures.map(function(signature) {
            return signature.toScriptSignature(input.hashType)
          })

          // fill in blanks with OP_0
          for (var i = 0; i < msSignatures.length; ++i) {
            if (msSignatures[i]) continue

            msSignatures[i] = ops.OP_0
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

TransactionBuilder.prototype.sign = function(index, privKey, redeemScript, hashType) {
  assert(index in this.inputs, 'No input at index: ' + index)
  hashType = hashType || Transaction.SIGHASH_ALL

  var input = this.inputs[index]
  var canSign = input.hashType &&
                input.prevOutScript &&
                input.prevOutType &&
                input.pubKeys &&
                input.scriptType &&
                input.signatures

  // are we almost ready to sign?
  if (canSign) {
    // if redeemScript was provided, enforce consistency
    if (redeemScript) {
      assert.deepEqual(input.redeemScript, redeemScript, 'Inconsistent redeemScript')
    }

    assert.equal(input.hashType, hashType, 'Inconsistent hashType')

  // no? prepare
  } else {
    if (redeemScript) {
      // if we have a prevOutScript, enforce scriptHash equality to the redeemScript
      if (input.prevOutScript) {
        assert.equal(input.prevOutType, 'scripthash', 'PrevOutScript must be P2SH')

        var scriptHash = input.prevOutScript.chunks[1]
        assert.deepEqual(scriptHash, redeemScript.getHash(), 'RedeemScript does not match ' + scriptHash.toString('hex'))
      }

      var scriptType = scripts.classifyOutput(redeemScript)
      assert(scriptType in canSignTypes, 'RedeemScript not supported (' + scriptType + ')')

      var pubKeys = []
      switch (scriptType) {
        case 'multisig':
          pubKeys = redeemScript.chunks.slice(1, -2).map(ECPubKey.fromBuffer)
          break

        case 'pubkeyhash':
          var pkh1 = redeemScript.chunks[2]
          var pkh2 = privKey.pub.getAddress().hash

          assert.deepEqual(pkh1, pkh2, 'privateKey cannot sign for this input')
          pubKeys = [privKey.pub]
          break

        case 'pubkey':
          pubKeys = redeemScript.chunks.slice(0, 1).map(ECPubKey.fromBuffer)
          break
      }

      if (!input.prevOutScript) {
        input.prevOutScript = scripts.scriptHashOutput(redeemScript.getHash())
        input.prevOutType = 'scripthash'
      }

      input.pubKeys = pubKeys
      input.redeemScript = redeemScript
      input.scriptType = scriptType

    } else {
      assert.notEqual(input.prevOutType, 'scripthash', 'PrevOutScript is P2SH, missing redeemScript')

      // can we sign this?
      if (input.scriptType) {
        assert(input.pubKeys, input.scriptType + ' not supported')

      // we know nothin' Jon Snow, assume pubKeyHash
      } else {
        input.prevOutScript = privKey.pub.getAddress().toOutputScript()
        input.prevOutType = 'pubkeyhash'
        input.pubKeys = [privKey.pub]
        input.scriptType = input.prevOutType

      }
    }

    input.hashType = hashType
    input.signatures = input.signatures || []
  }

  // enforce in order signing of public keys
  assert(input.pubKeys.some(function(pubKey, i) {
    if (!privKey.pub.Q.equals(pubKey.Q)) return false

    assert(!input.signatures[i], 'Signature already exists')
    var signatureScript = input.redeemScript || input.prevOutScript
    var signatureHash = this.tx.hashForSignature(index, signatureScript, hashType)
    var signature = privKey.sign(signatureHash)
    input.signatures[i] = signature

    return true
  }, this), 'privateKey cannot sign for this input')
}

module.exports = TransactionBuilder
