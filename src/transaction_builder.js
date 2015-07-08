var assert = require('assert')
var bcrypto = require('./crypto')
var bufferutils = require('./bufferutils')
var ops = require('./opcodes')
var scripts = require('./scripts')

var Address = require('./address')
var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')
var Script = require('./script')
var Transaction = require('./transaction')

function extractInput (txIn) {
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
      pubKeys = scriptSig.chunks.slice(1)
      signatures = [parsed.signature]
      prevOutScript = Address.fromBase58Check(ECPair.fromPublicKeyBuffer(pubKeys[0]).getAddress()).toOutputScript()

      break
    }

    case 'pubkey': {
      parsed = ECSignature.parseScriptSignature(scriptSig.chunks[0])
      hashType = parsed.hashType
      signatures = [parsed.signature]

      if (redeemScript) {
        pubKeys = redeemScript.chunks.slice(0, 1)
      }

      break
    }

    case 'multisig': {
      signatures = scriptSig.chunks.slice(1).map(function (chunk) {
        if (chunk === ops.OP_0) return chunk

        var parsed = ECSignature.parseScriptSignature(chunk)
        hashType = parsed.hashType

        return parsed.signature
      })

      if (redeemScript) {
        pubKeys = redeemScript.chunks.slice(1, -2)
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

function TransactionBuilder () {
  this.prevTxMap = {}
  this.prevOutScripts = {}
  this.prevOutTypes = {}

  this.inputs = []
  this.tx = new Transaction()
}

TransactionBuilder.fromTransaction = function (transaction) {
  var txb = new TransactionBuilder()

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
    if (txIn.script.buffer.length === 0) return {}

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
    var prevOutType = scripts.classifyOutput(prevOutScript)

    // if we can, extract pubKey information
    switch (prevOutType) {
      case 'multisig': {
        input.pubKeys = prevOutScript.chunks.slice(1, -2)
        break
      }

      case 'pubkey': {
        input.pubKeys = prevOutScript.chunks.slice(0, 1)
        break
      }
    }

    if (prevOutType !== 'scripthash') {
      input.scriptType = prevOutType
    }

    input.prevOutScript = prevOutScript
    input.prevOutType = prevOutType
  }

  assert(this.inputs.every(function (input2) {
    if (input2.hashType === undefined) return true

    return input2.hashType & Transaction.SIGHASH_ANYONECANPAY
  }), 'No, this would invalidate signatures')

  var prevOut = txHash.toString('hex') + ':' + vout
  assert(!(prevOut in this.prevTxMap), 'Transaction is already an input')

  var vin = this.tx.addInput(txHash, vout, sequence)
  this.inputs[vin] = input
  this.prevTxMap[prevOut] = vin

  return vin
}

TransactionBuilder.prototype.addOutput = function (scriptPubKey, value) {
  assert(this.inputs.every(function (input) {
    if (input.hashType === undefined) return true

    return (input.hashType & 0x1f) === Transaction.SIGHASH_SINGLE
  }), 'No, this would invalidate signatures')

  // Attempt to get a valid address if it's a base58 address string
  if (typeof scriptPubKey === 'string') {
    scriptPubKey = Address.fromBase58Check(scriptPubKey)
  }

  // Attempt to get a valid script if it's an Address object
  if (scriptPubKey instanceof Address) {
    scriptPubKey = scriptPubKey.toOutputScript()
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
    assert(this.tx.ins.length > 0, 'Transaction has no inputs')
    assert(this.tx.outs.length > 0, 'Transaction has no outputs')
  }

  var tx = this.tx.clone()

  // Create script signatures from signature meta-data
  this.inputs.forEach(function (input, index) {
    var scriptType = input.scriptType
    var scriptSig

    if (!allowIncomplete) {
      assert(!!scriptType, 'Transaction is not complete')
      assert(scriptType in canSignTypes, scriptType + ' not supported')
      assert(input.signatures, 'Transaction is missing signatures')
    }

    if (input.signatures) {
      switch (scriptType) {
        case 'pubkeyhash': {
          var pkhSignature = input.signatures[0].toScriptSignature(input.hashType)
          scriptSig = scripts.pubKeyHashInput(pkhSignature, input.pubKeys[0])
          break
        }

        case 'multisig': {
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
        }

        case 'pubkey': {
          var pkSignature = input.signatures[0].toScriptSignature(input.hashType)
          scriptSig = scripts.pubKeyInput(pkSignature)
          break
        }
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
  assert(index in this.inputs, 'No input at index: ' + index)
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
      assert.deepEqual(input.redeemScript, redeemScript, 'Inconsistent redeemScript')
    }

    assert.equal(input.hashType, hashType, 'Inconsistent hashType')

  // no? prepare
  } else {
    // must be pay-to-scriptHash?
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
        case 'multisig': {
          pubKeys = redeemScript.chunks.slice(1, -2)
          break
        }

        case 'pubkeyhash': {
          var pkh1 = redeemScript.chunks[2]
          var pkh2 = bcrypto.hash160(keyPair.getPublicKeyBuffer())

          assert.deepEqual(pkh1, pkh2, 'privateKey cannot sign for this input')
          pubKeys = [kpPubKey]
          break
        }

        case 'pubkey': {
          pubKeys = redeemScript.chunks.slice(0, 1)
          break
        }
      }

      if (!input.prevOutScript) {
        input.prevOutScript = scripts.scriptHashOutput(redeemScript.getHash())
        input.prevOutType = 'scripthash'
      }

      input.pubKeys = pubKeys
      input.redeemScript = redeemScript
      input.scriptType = scriptType

    // cannot be pay-to-scriptHash
    } else {
      assert.notEqual(input.prevOutType, 'scripthash', 'PrevOutScript is P2SH, missing redeemScript')

      // can we otherwise sign this?
      if (input.scriptType) {
        assert(input.pubKeys, input.scriptType + ' not supported')

      // we know nothin' Jon Snow, assume pubKeyHash
      } else {
        input.prevOutScript = Address.fromBase58Check(keyPair.getAddress()).toOutputScript()
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
  assert(input.pubKeys.some(function (pubKey, i) {
    if (!bufferutils.equal(kpPubKey, pubKey)) return false

    assert(!input.signatures[i], 'Signature already exists')

    var signature = keyPair.sign(signatureHash)
    input.signatures[i] = signature

    return true
  }), 'key pair cannot sign for this input')
}

module.exports = TransactionBuilder
