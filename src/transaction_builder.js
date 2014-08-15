var assert = require('assert')
var scripts = require('./scripts')

var ECKey = require('./eckey')
var Transaction = require('./transaction')
var Script = require('./script')

function TransactionBuilder() {
  this.prevOutMap = {}
  this.prevOutScripts = {}
  this.prevOutTypes = {}

  this.signatures = []
  this.tx = new Transaction()
}

TransactionBuilder.prototype.addInput = function(prevTx, index, prevOutScript) {
  var prevOutHash

  if (typeof prevTx === 'string') {
    prevOutHash = new Buffer(prevTx, 'hex')

    // TxId hex is big-endian, we want little-endian hash
    Array.prototype.reverse.call(prevOutHash)

  } else if (prevTx instanceof Transaction) {
    assert(prevOutScript === undefined, 'Unnecessary Script provided')

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

  var vout = this.tx.addInput(prevOutHash, index)
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
    scriptType = prevOutType || 'pubkeyhash'

    assert.notEqual(scriptType, 'scripthash', 'PrevOutScript requires redeemScript')

    hash = this.tx.hashForSignature(index, prevOutScript, hashType)
  }

  var signature = privKey.sign(hash)

  if (!(index in this.signatures)) {
    this.signatures[index] = {
      hashType: hashType,
      pubKeys: [],
      redeemScript: redeemScript,
      scriptType: scriptType,
      signatures: []
    }
  }

  var input = this.signatures[index]
  input.pubKeys.push(privKey.pub)
  input.signatures.push(signature)

  assert.equal(input.hashType, hashType, 'Inconsistent hashType')
  assert.deepEqual(input.redeemScript, redeemScript, 'Inconsistent redeemScript')
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

  this.signatures.forEach(function(input, index) {
    var scriptSig

    var signatures = input.signatures.map(function(signature) {
      return signature.toScriptSignature(input.hashType)
    })

    if (input.scriptType === 'pubkeyhash') {
      var signature = signatures[0]
      var publicKey = input.pubKeys[0]
      scriptSig = scripts.pubKeyHashInput(signature, publicKey)

    } else if (input.scriptType === 'multisig') {
      var redeemScript = allowIncomplete ? undefined : input.redeemScript
      scriptSig = scripts.multisigInput(signatures, redeemScript)

    } else if (input.scriptType === 'pubkey') {
      var signature = signatures[0]
      scriptSig = scripts.pubKeyInput(signature)

    } else {
      assert(false, input.scriptType + ' not supported')

    }

    if (input.redeemScript) {
      scriptSig = scripts.scriptHashInput(scriptSig, input.redeemScript)
    }

    tx.setInputScript(index, scriptSig)
  })

  return tx
}

module.exports = TransactionBuilder
