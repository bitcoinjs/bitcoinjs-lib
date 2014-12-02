var assert = require('assert')
var scripts = require('./scripts')

var ECPubKey = require('./ecpubkey')
var ECSignature = require('./ecsignature')
var Script = require('./script')
var Transaction = require('./transaction')

function TransactionBuilder() {
  this.prevOutMap = {}
  this.prevOutScripts = {}
  this.prevOutTypes = {}

  this.signatures = []
  this.tx = new Transaction()
}

// Static constructors
TransactionBuilder.fromTransaction = function(transaction) {
  var txb = new TransactionBuilder()

  // Extract/add inputs
  transaction.ins.forEach(function(txIn) {
    txb.addInput(txIn.hash, txIn.index, txIn.sequence)
  })

  // Extract/add outputs
  transaction.outs.forEach(function(txOut) {
    txb.addOutput(txOut.script, txOut.value)
  })

  // Extract/add signatures
  transaction.ins.forEach(function(txIn, i) {
    // Ignore empty scripts
    if (txIn.script.buffer.length === 0) return

    assert(!Array.prototype.every.call(txIn.hash, function(x) {
      return x === 0
    }), 'coinbase inputs not supported')

    var redeemScript
    var scriptSig = txIn.script
    var scriptType = scripts.classifyInput(scriptSig)

    // Re-classify if P2SH
    if (scriptType === 'scripthash') {
      redeemScript = Script.fromBuffer(scriptSig.chunks.slice(-1)[0])
      scriptSig = Script.fromChunks(scriptSig.chunks.slice(0, -1))

      scriptType = scripts.classifyInput(scriptSig)
      assert.equal(scripts.classifyOutput(redeemScript), scriptType, 'Non-matching scriptSig and scriptPubKey in input')
    }

    // Extract hashType, pubKeys and signatures
    var hashType, pubKeys, signatures

    switch (scriptType) {
      case 'pubkeyhash':
        var parsed = ECSignature.parseScriptSignature(scriptSig.chunks[0])
        var pubKey = ECPubKey.fromBuffer(scriptSig.chunks[1])

        hashType = parsed.hashType
        pubKeys = [pubKey]
        signatures = [parsed.signature]

        break

      case 'multisig':
        var scriptSigs = scriptSig.chunks.slice(1) // ignore OP_0
        var parsed = scriptSigs.map(function(scriptSig) {
          return ECSignature.parseScriptSignature(scriptSig)
        })

        hashType = parsed[0].hashType
        pubKeys = []
        signatures = parsed.map(function(p) { return p.signature })

        break

      case 'pubkey':
        var parsed = ECSignature.parseScriptSignature(scriptSig.chunks[0])

        hashType = parsed.hashType
        pubKeys = []
        signatures = [parsed.signature]

        break

      default:
        assert(false, scriptType + ' inputs not supported')
    }

    txb.signatures[i] = {
      hashType: hashType,
      pubKeys: pubKeys,
      redeemScript: redeemScript,
      scriptType: scriptType,
      signatures: signatures
    }
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

  var prevOutType
  if (prevOutScript !== undefined) {
    prevOutType = scripts.classifyOutput(prevOutScript)

    assert.notEqual(prevOutType, 'nonstandard', 'PrevOutScript not supported (nonstandard)')
  }

  assert(this.signatures.every(function(input) {
    return input.hashType & Transaction.SIGHASH_ANYONECANPAY
  }), 'No, this would invalidate signatures')

  var prevOut = prevOutHash.toString('hex') + ':' + index
  assert(!(prevOut in this.prevOutMap), 'Transaction is already an input')

  var vout = this.tx.addInput(prevOutHash, index, sequence)
  this.prevOutMap[prevOut] = true
  this.prevOutScripts[vout] = prevOutScript
  this.prevOutTypes[vout] = prevOutType

  return vout
}

TransactionBuilder.prototype.addOutput = function(scriptPubKey, value) {
  assert(this.signatures.every(function(signature) {
    return (signature.hashType & 0x1f) === Transaction.SIGHASH_SINGLE
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
    assert(this.signatures.length > 0, 'Transaction has no signatures')
    assert.equal(this.signatures.length, this.tx.ins.length, 'Transaction is missing signatures')
  }

  var tx = this.tx.clone()

  // Create script signatures from signature meta-data
  this.signatures.forEach(function(input, index) {
    var scriptSig
    var scriptType = input.scriptType

    var signatures = input.signatures.map(function(signature) {
      return signature.toScriptSignature(input.hashType)
    })

    switch (scriptType) {
      case 'pubkeyhash':
        var signature = signatures[0]
        var pubKey = input.pubKeys[0]
        scriptSig = scripts.pubKeyHashInput(signature, pubKey)

        break

      case 'multisig':
        var redeemScript = allowIncomplete ? undefined : input.redeemScript
        scriptSig = scripts.multisigInput(signatures, redeemScript)

        break

      case 'pubkey':
        var signature = signatures[0]
        scriptSig = scripts.pubKeyInput(signature)

        break

      default:
        assert(false, scriptType + ' not supported')
    }

    if (input.redeemScript) {
      scriptSig = scripts.scriptHashInput(scriptSig, input.redeemScript)
    }

    tx.setInputScript(index, scriptSig)
  })

  return tx
}

TransactionBuilder.prototype.sign = function(index, privKey, redeemScript, hashType) {
  assert(this.tx.ins.length >= index, 'No input at index: ' + index)
  hashType = hashType || Transaction.SIGHASH_ALL

  var prevOutScript = this.prevOutScripts[index]
  var prevOutType = this.prevOutTypes[index]

  var scriptType, hash
  if (redeemScript) {
    prevOutScript = prevOutScript || scripts.scriptHashOutput(redeemScript.getHash())
    prevOutType = prevOutType || 'scripthash'

    assert.equal(prevOutType, 'scripthash', 'PrevOutScript must be P2SH')

    scriptType = scripts.classifyOutput(redeemScript)

    assert.notEqual(scriptType, 'scripthash', 'RedeemScript can\'t be P2SH')
    assert.notEqual(scriptType, 'nonstandard', 'RedeemScript not supported (nonstandard)')

    hash = this.tx.hashForSignature(index, redeemScript, hashType)

  } else {
    prevOutScript = prevOutScript || privKey.pub.getAddress().toOutputScript()
    prevOutType = prevOutType || 'pubkeyhash'

    assert.notEqual(prevOutType, 'scripthash', 'PrevOutScript is P2SH, missing redeemScript')

    scriptType = prevOutType

    hash = this.tx.hashForSignature(index, prevOutScript, hashType)
  }

  this.prevOutScripts[index] = prevOutScript
  this.prevOutTypes[index] = prevOutType

  if (!(index in this.signatures)) {
    this.signatures[index] = {
      hashType: hashType,
      pubKeys: [],
      redeemScript: redeemScript,
      scriptType: scriptType,
      signatures: []
    }
  } else {
    assert.equal(scriptType, 'multisig', scriptType + ' doesn\'t support multiple signatures')
  }

  var input = this.signatures[index]
  assert.equal(input.hashType, hashType, 'Inconsistent hashType')
  assert.deepEqual(input.redeemScript, redeemScript, 'Inconsistent redeemScript')

  var signature = privKey.sign(hash)
  input.pubKeys.push(privKey.pub)
  input.signatures.push(signature)
}

module.exports = TransactionBuilder
