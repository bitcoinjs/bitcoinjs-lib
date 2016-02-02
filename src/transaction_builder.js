var baddress = require('./address')
var bcrypto = require('./crypto')
var bscript = require('./script')
var bufferEquals = require('buffer-equals')
var networks = require('./networks')
var ops = require('./opcodes')
var typeforce = require('typeforce')
var types = require('./types')

var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')
var Transaction = require('./transaction')

// re-orders signatures to match pubKeys, fills undefined otherwise
function fixMSSignatures (transaction, vin, pubKeys, signatures, prevOutScript, hashType, skipPubKey) {
  // maintain a local copy of unmatched signatures
  var unmatched = signatures.slice()
  var cache = {}

  return pubKeys.map(function (pubKey) {
    // skip optionally provided pubKey
    if (skipPubKey && bufferEquals(skipPubKey, pubKey)) return undefined

    var matched
    var keyPair2 = ECPair.fromPublicKeyBuffer(pubKey)

    // check for a matching signature
    unmatched.some(function (signature, i) {
      // skip if undefined || OP_0
      if (!signature) return false

      var signatureHash = cache[hashType] = cache[hashType] || transaction.hashForSignature(vin, prevOutScript, hashType)
      if (!keyPair2.verify(signatureHash, signature)) return false

      // remove matched signature from unmatched
      unmatched[i] = undefined
      matched = signature

      return true
    })

    return matched || undefined
  })
}

function extractInput (transaction, txIn, vin) {
  var scriptSigChunks = bscript.decompile(txIn.script)
  var prevOutType = bscript.classifyInput(scriptSigChunks, true)
  var isSegWit = false

  if (txIn.witness && txIn.witness.length) {
    // native segwit
    if (scriptSigChunks.length === 0) {
      prevOutType = bscript.classifyInput(txIn.witness, true)
      isSegWit = true

      switch (prevOutType) {
        case 'pubkeyhash':
          prevOutType = 'segwitpubkeyhash'
          break

        default:
          throw new Error('segwit ' + prevOutType + ' not supported')
      }
    // segwit nested in P2SH
    } else if (scriptSigChunks.length === 1) {
      scriptSigChunks = txIn.witness.concat(scriptSigChunks)
      prevOutType = bscript.classifyInput(scriptSigChunks, true)
      isSegWit = true

      if (prevOutType !== 'scripthash') throw new Error('segwit ' + prevOutType + ' not supported')
    } else {
      throw new Error('not supported')
    }
  // Ignore empty scripts
  } else if (txIn.script.length === 0) {
    return {}
  }

  // console.log('extractInput::prevOutType', prevOutType)

  var processScript = function (scriptType, scriptSigChunks, isSegWit, redeemScriptChunks) {
    // console.log('extractInput::processScript')

    // ensure chunks are decompiled
    scriptSigChunks = bscript.decompile(scriptSigChunks)
    redeemScriptChunks = redeemScriptChunks ? bscript.decompile(redeemScriptChunks) : undefined

    var hashType, pubKeys, signatures, prevOutScript, redeemScript, redeemScriptType, result, parsed

    // console.log('extractInput::processScript::scriptType', scriptType)
    // console.log('extractInput::processScript::scriptSigChunks', scriptSigChunks)
    // console.log('extractInput::processScript::redeemScriptChunks', redeemScriptChunks)

    switch (scriptType) {
      case 'scripthash':
        redeemScript = scriptSigChunks.slice(-1)[0]
        scriptSigChunks = bscript.compile(scriptSigChunks.slice(0, -1))

        redeemScriptType = bscript.classifyInput(scriptSigChunks, true)
        prevOutScript = bscript.scriptHashOutput(bcrypto.hash160(redeemScript))

        // console.log('extractInput::processScript::scripthash::redeemScript', redeemScript)

        result = processScript(redeemScriptType, scriptSigChunks, isSegWit, bscript.decompile(redeemScript))

        // console.log('extractInput::processScript::scripthash::result', result)

        if (isSegWit) {
          switch (redeemScriptType) {
            case 'pubkeyhash':
              redeemScriptType = 'segwitpubkeyhash'
              break

            default:
              throw new Error('segwit scripthash[ ' + redeemScriptType + ' ] not supported')
          }
        }

        result.prevOutScript = prevOutScript
        result.redeemScript = redeemScript
        result.redeemScriptType = redeemScriptType

        return result

      case 'pubkeyhash':
        parsed = ECSignature.parseScriptSignature(scriptSigChunks[0])
        hashType = parsed.hashType
        pubKeys = scriptSigChunks.slice(1)
        signatures = [parsed.signature]
        prevOutScript = bscript.pubKeyHashOutput(bcrypto.hash160(pubKeys[0]))

        break

      case 'pubkey':
        parsed = ECSignature.parseScriptSignature(scriptSigChunks[0])
        hashType = parsed.hashType
        signatures = [parsed.signature]

        if (redeemScriptChunks) {
          pubKeys = redeemScriptChunks.slice(0, 1)
        }

        break

      case 'multisig':
        // console.log('extractInput::multisig::scriptSigChunks', scriptSigChunks)
        signatures = scriptSigChunks.slice(1).map(function (chunk) {
          if (chunk === ops.OP_0) return undefined

          parsed = ECSignature.parseScriptSignature(chunk)
          hashType = parsed.hashType

          return parsed.signature
        })

        // console.log('extractInput::multisig::redeemScriptChunks', redeemScriptChunks)
        if (redeemScriptChunks) {
          pubKeys = redeemScriptChunks.slice(1, -2)

          if (pubKeys.length !== signatures.length) {
            signatures = fixMSSignatures(transaction, vin, pubKeys, signatures, bscript.compile(redeemScriptChunks), hashType, redeemScript)
          }
        }

        // console.log('extractInput::multisig::signatures', signatures.map(function (sig) { return sig && sig.toDER() }))

        break

      case 'segwitpubkeyhash':
        parsed = ECSignature.parseScriptSignature(txIn.witness[0])
        hashType = parsed.hashType
        pubKeys = [txIn.witness[1]]
        signatures = [parsed.signature]
        prevOutScript = bscript.segWitPubKeyHashOutput(bcrypto.hash160(pubKeys[0]))

        break
    }

    return {
      hashType: hashType,
      pubKeys: pubKeys,
      signatures: signatures,
      prevOutScript: prevOutScript,
      redeemScript: redeemScript,
      redeemScriptType: redeemScriptType
    }
  }

  // Extract hashType, pubKeys, signatures and prevOutScript
  var result = processScript(prevOutType, scriptSigChunks, isSegWit)

  return {
    hashType: result.hashType,
    prevOutScript: result.prevOutScript,
    prevOutType: prevOutType,
    pubKeys: result.pubKeys,
    redeemScript: result.redeemScript,
    redeemScriptType: result.redeemScriptType,
    segWitScript: result.segWitScript,
    segWitScriptType: result.segWitScriptType,
    signatures: result.signatures,
    witness: txIn.witness || []
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
  txb.inputs = transaction.ins.map(function (txIn, vin) {
    // TODO: verify whether extractInput is sane with coinbase scripts
    if (Transaction.isCoinbaseHash(txIn.hash)) {
      throw new Error('coinbase inputs not supported')
    }

    return extractInput(transaction, txIn, vin)
  })

  // console.log('txb.fromTransaction::inputs', txb.inputs[0])
  // console.log('txb.fromTransaction::tx.ins', txb.tx.ins[0])

  return txb
}

TransactionBuilder.prototype.addInput = function (txHash, vout, sequence, prevOutScript) {
  // is it a hex string?
  if (typeof txHash === 'string') {
    // transaction hashs's are displayed in reverse order, un-reverse it
    txHash = [].reverse.call(new Buffer(txHash, 'hex'))

  // is it a Transaction object?
  } else if (txHash instanceof Transaction) {
    prevOutScript = txHash.outs[vout].script
    txHash = txHash.getHash()
  }

  var input = {}
  if (prevOutScript) {
    var prevOutScriptChunks = bscript.decompile(prevOutScript)
    var prevOutType = bscript.classifyOutput(prevOutScriptChunks)

    // if we can, extract pubKey information
    switch (prevOutType) {
      case 'multisig':
        input.pubKeys = prevOutScriptChunks.slice(1, -2)
        input.signatures = input.pubKeys.map(function () { return undefined })

        break

      case 'pubkey':
        input.pubKeys = prevOutScriptChunks.slice(0, 1)
        input.signatures = [undefined]

        break
    }

    if (prevOutType !== 'scripthash' && prevOutType !== 'segwitscripthash') {
      input.scriptType = prevOutType
    }

    input.prevOutScript = prevOutScript
    input.prevOutType = prevOutType
  }

  // if signatures exist, adding inputs is only acceptable if SIGHASH_ANYONECANPAY is used
  // throw if any signatures *didn't* use SIGHASH_ANYONECANPAY
  if (!this.inputs.every(function (otherInput) {
    // no signature
    if (otherInput.hashType === undefined) return true

    return otherInput.hashType & Transaction.SIGHASH_ANYONECANPAY
  })) {
    throw new Error('No, this would invalidate signatures')
  }

  var prevOut = txHash.toString('hex') + ':' + vout
  if (this.prevTxMap[prevOut]) throw new Error('Transaction is already an input')

  var vin = this.tx.addInput(txHash, vout, sequence)
  this.inputs[vin] = input
  this.prevTxMap[prevOut] = vin

  return vin
}

TransactionBuilder.prototype.addOutput = function (scriptPubKey, value) {
  var nOutputs = this.tx.outs.length

  // if signatures exist, adding outputs is only acceptable if SIGHASH_NONE or SIGHASH_SINGLE is used
  // throws if any signatures didn't use SIGHASH_NONE|SIGHASH_SINGLE
  if (!this.inputs.every(function (input, index) {
    // no signature
    if (input.hashType === undefined) return true

    var hashTypeMod = input.hashType & 0x1f
    if (hashTypeMod === Transaction.SIGHASH_NONE) return true
    if (hashTypeMod === Transaction.SIGHASH_SINGLE) {
      // account for SIGHASH_SINGLE signing of a non-existing output, aka the "SIGHASH_SINGLE" bug
      return index < nOutputs
    }

    return false
  })) {
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
  'pubkeyhash': true,
  'segwitpubkeyhash': true,
  'segwitscripthash': true
}

TransactionBuilder.prototype.__build = function (allowIncomplete) {
  if (!allowIncomplete) {
    if (!this.tx.ins.length) throw new Error('Transaction has no inputs')
    if (!this.tx.outs.length) throw new Error('Transaction has no outputs')
  }

  var tx = this.tx.clone()

  // Create script signatures from inputs
  this.inputs.forEach(function (input, index) {
    var scriptType = input.redeemScriptType || input.prevOutType
    var scriptSig
    var witness

    if (!allowIncomplete) {
      if (!scriptType) throw new Error('Transaction is not complete')
      if (!canBuildTypes[scriptType]) throw new Error(scriptType + ' not supported')

      // XXX: only relevant to types that need signatures
      if (!input.signatures) throw new Error('Transaction is missing signatures')
    }

    if (input.signatures) {
      var processScript = function (scriptType, parentType, redeemScript) {
        var scriptSig
        var pkhSignature

        switch (scriptType) {
          case 'pubkeyhash':
            pkhSignature = input.signatures[0].toScriptSignature(input.hashType)
            scriptSig = bscript.pubKeyHashInput(pkhSignature, input.pubKeys[0])
            break

          case 'multisig':
            var msSignatures = input.signatures.map(function (signature) {
              return signature && signature.toScriptSignature(input.hashType)
            })

            // fill in blanks with OP_0
            if (allowIncomplete) {
              for (var i = 0; i < msSignatures.length; ++i) {
                msSignatures[i] = msSignatures[i] || ops.OP_0
              }

            // remove blank signatures
            } else {
              msSignatures = msSignatures.filter(function (x) { return x })
            }

            scriptSig = bscript.multisigInput(msSignatures, allowIncomplete ? undefined : redeemScript)
            break

          case 'pubkey':
            var pkSignature = input.signatures[0].toScriptSignature(input.hashType)
            scriptSig = bscript.pubKeyInput(pkSignature)
            break

          case 'segwitpubkeyhash':
            pkhSignature = input.signatures[0].toScriptSignature(input.hashType)
            witness = input.witness
            witness[0] = pkhSignature
            scriptSig = new Buffer('')
            break

          case 'segwitscripthash':
            witness = bscript.decompile(processScript(input.segWitScriptType, scriptType, input.segWitScript))

            witness = witness.map(function (chunk) {
              if (!(chunk instanceof Buffer)) {
                return new Buffer(chunk)
              }

              return chunk
            })

            return input.redeemScript
        }

        // wrap as scriptHash if necessary
        if (parentType === 'scripthash' || parentType === 'segwitscripthash') {
          scriptSig = bscript.scriptHashInput(scriptSig, redeemScript)
        }

        return scriptSig
      }

      scriptSig = processScript(scriptType, input.prevOutType, input.redeemScript)
    }

    // did we build a scriptSig? Buffer('') is allowed
    if (scriptSig) {
      tx.setInputScript(index, scriptSig, witness)
    }
  })

  return tx
}

TransactionBuilder.prototype.sign = function (index, keyPair, redeemScript, hashType, segWit, amount, segWitScript) {
  if (keyPair.network !== this.network) throw new Error('Inconsistent network')
  if (!this.inputs[index]) throw new Error('No input at index: ' + index)
  hashType = hashType || Transaction.SIGHASH_ALL

  var input = this.inputs[index]
  var canSign = input.hashType &&
    input.prevOutScript &&
    input.prevOutType &&
    input.pubKeys &&
    input.redeemScriptType &&
    input.signatures &&
    input.signatures.length === input.pubKeys.length
  // @TODO segWit

  var kpPubKey = keyPair.getPublicKeyBuffer()
  var signatureScript

  // are we ready to sign?
  if (canSign) {
    // if redeemScript was provided, enforce consistency
    if (redeemScript) {
      if (!bufferEquals(input.redeemScript, redeemScript)) throw new Error('Inconsistent redeemScript')
    }

    if (input.hashType !== hashType) throw new Error('Inconsistent hashType')

  // no? prepare
  } else {
    // must be pay-to-scriptHash?
    if (redeemScript) {
      // if we have a prevOutScript, enforce scriptHash equality to the redeemScript
      if (input.prevOutScript) {
        if (input.prevOutType !== 'scripthash') throw new Error('PrevOutScript must be P2SH')

        var scriptHash = bscript.decompile(input.prevOutScript)[1]
        if (!bufferEquals(scriptHash, bcrypto.hash160(redeemScript))) throw new Error('RedeemScript does not match ' + scriptHash.toString('hex'))
      }

      var pubKeys, pkh1, pkh2

      var redeemScriptType
      var segWitScriptType

      var processScript = function (redeemScript) {
        var scriptType = bscript.classifyOutput(redeemScript)
        var redeemScriptChunks = bscript.decompile(redeemScript)

        switch (scriptType) {
          case 'multisig':
            pubKeys = redeemScriptChunks.slice(1, -2)

            if (segWit) {
              input.witness = [new Buffer(''), undefined, redeemScript]

              segWitScript = segWitScript || bscript.multisigOutput(1, pubKeys) // @TODO bufferEquals?
            }

            break

          case 'pubkeyhash':
            pkh1 = redeemScriptChunks[2]
            pkh2 = bcrypto.hash160(keyPair.getPublicKeyBuffer())

            if (!bufferEquals(pkh1, pkh2)) throw new Error('privateKey cannot sign for this input')
            pubKeys = [kpPubKey]

            if (segWit) {
              input.witness = [undefined, kpPubKey]
              segWitScript = segWitScript || bscript.pubKeyHashOutput(pkh1)// @TODO bufferEquals?
            }

            break

          case 'pubkey':
            pubKeys = redeemScriptChunks.slice(0, 1)

            // @TODO: P2WSH(segWit)

            break

          case 'segwitpubkeyhash':
            pkh1 = redeemScriptChunks.slice(1)[0]
            pkh2 = bcrypto.hash160(keyPair.getPublicKeyBuffer())

            if (!bufferEquals(pkh1, pkh2)) throw new Error('privateKey cannot sign for this input')
            pubKeys = [kpPubKey]

            input.witness = [undefined, kpPubKey]
            segWitScript = bscript.pubKeyHashOutput(pkh1)

            break

          case 'segwitscripthash':
            if (!segWitScript) {
              throw new Error('Missing SegWitScript for segwitscripthash')
            }

            segWitScriptType = processScript(segWitScript)

            break

          default:
            throw new Error('RedeemScript not supported (' + scriptType + ')')
        }

        return scriptType
      }

      redeemScriptType = processScript(redeemScript)

      // if we don't have a prevOutScript, generate a P2SH script
      if (!input.prevOutScript) {
        input.prevOutScript = bscript.scriptHashOutput(bcrypto.hash160(redeemScript))
        input.prevOutType = 'scripthash'
      }

      input.pubKeys = pubKeys
      input.redeemScript = redeemScript
      input.redeemScriptType = redeemScriptType
      input.segWitScript = segWitScript
      input.segWitScriptType = segWitScriptType
      input.signatures = pubKeys.map(function () { return undefined })
    } else {
      // pay-to-scriptHash is not possible without a redeemScript
      if (input.prevOutType === 'scripthash') throw new Error('PrevOutScript is P2SH, missing redeemScript')

      // console.log('input.pubKeys', input.pubKeys)
      // console.log('input.scriptType', input.scriptType)
      // console.log('segWit', segWit)

      // if we don't have a scriptType, assume pubKeyHash otherwise
      if (!input.scriptType) {
        if (segWit) {
          input.prevOutScript = bscript.segWitPubKeyHashOutput(bcrypto.hash160(keyPair.getPublicKeyBuffer()))
          input.prevOutType = 'segwitpubkeyhash'
          input.witness = [undefined, kpPubKey]
          signatureScript = bscript.pubKeyHashOutput(bcrypto.hash160(keyPair.getPublicKeyBuffer()))
        } else {
          input.prevOutScript = bscript.pubKeyHashOutput(bcrypto.hash160(keyPair.getPublicKeyBuffer()))
          input.prevOutType = 'pubkeyhash'
        }

        input.pubKeys = [kpPubKey]
        input.scriptType = input.prevOutType
        input.signatures = [undefined]
      } else {
        // throw if we can't sign with it
        if (!input.pubKeys || !input.signatures) throw new Error(input.scriptType + ' not supported')
      }
    }

    input.hashType = hashType
  }

  // console.log('sign::input.segWitScript', input.segWitScript)
  // console.log('sign::signatureScript', signatureScript)

  // ready to sign?
  signatureScript = signatureScript || input.segWitScript || input.redeemScript || input.prevOutScript
  var signatureHash = this.tx.hashForSignature(index, signatureScript, hashType, segWit, amount)

  // enforce in order signing of public keys
  var valid = input.pubKeys.some(function (pubKey, i) {
    // console.log('sign::sign', index, i)

    if (!bufferEquals(kpPubKey, pubKey)) return false
    if (input.signatures[i]) throw new Error('Signature already exists')

    input.signatures[i] = keyPair.sign(signatureHash)

    return true
  })

  if (!valid) throw new Error('Key pair cannot sign for this input')
}

module.exports = TransactionBuilder
