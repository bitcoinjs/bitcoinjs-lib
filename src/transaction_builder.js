const Buffer = require('safe-buffer').Buffer
const baddress = require('./address')
const bcrypto = require('./crypto')
const bscript = require('./script')
const networks = require('./networks')
const ops = require('bitcoin-ops')
const payments = require('./payments')
const typeforce = require('typeforce')
const types = require('./types')
const classify = require('./classify')
const SCRIPT_TYPES = classify.types

const ECPair = require('./ecpair')
const Transaction = require('./transaction')

function expandInput (scriptSig, witnessStack, type, scriptPubKey) {
  if (scriptSig.length === 0 && witnessStack.length === 0) return {}
  if (!type) {
    let ssType = classify.input(scriptSig, true)
    let wsType = classify.witness(witnessStack, true)
    if (ssType === SCRIPT_TYPES.NONSTANDARD) ssType = undefined
    if (wsType === SCRIPT_TYPES.NONSTANDARD) wsType = undefined
    type = ssType || wsType
  }

  switch (type) {
    case SCRIPT_TYPES.P2WPKH: {
      const { output, pubkey, signature } = payments.p2wpkh({ witness: witnessStack })

      return {
        prevOutScript: output,
        prevOutType: SCRIPT_TYPES.P2WPKH,
        pubkeys: [pubkey],
        signatures: [signature]
      }
    }

    case SCRIPT_TYPES.P2PKH: {
      const { output, pubkey, signature } = payments.p2pkh({ input: scriptSig })

      return {
        prevOutScript: output,
        prevOutType: SCRIPT_TYPES.P2PKH,
        pubkeys: [pubkey],
        signatures: [signature]
      }
    }

    case SCRIPT_TYPES.P2PK: {
      const { signature } = payments.p2pk({ input: scriptSig })

      return {
        prevOutType: SCRIPT_TYPES.P2PK,
        pubkeys: [undefined],
        signatures: [signature]
      }
    }

    case SCRIPT_TYPES.P2MS: {
      const { m, pubkeys, signatures } = payments.p2ms({
        input: scriptSig,
        output: scriptPubKey
      }, { allowIncomplete: true })

      return {
        prevOutType: SCRIPT_TYPES.P2MS,
        pubkeys: pubkeys,
        signatures: signatures,
        maxSignatures: m
      }
    }
  }

  if (type === SCRIPT_TYPES.P2SH) {
    const { output, redeem } = payments.p2sh({
      input: scriptSig,
      witness: witnessStack
    })

    const outputType = classify.output(redeem.output)
    const expanded = expandInput(redeem.input, redeem.witness, outputType, redeem.output)
    if (!expanded.prevOutType) return {}

    return {
      prevOutScript: output,
      prevOutType: SCRIPT_TYPES.P2SH,
      redeemScript: redeem.output,
      redeemScriptType: expanded.prevOutType,
      witnessScript: expanded.witnessScript,
      witnessScriptType: expanded.witnessScriptType,

      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures
    }
  }

  if (type === SCRIPT_TYPES.P2WSH) {
    const { output, redeem } = payments.p2wsh({
      input: scriptSig,
      witness: witnessStack
    })
    const outputType = classify.output(redeem.output)
    let expanded
    if (outputType === SCRIPT_TYPES.P2WPKH) {
      expanded = expandInput(redeem.input, redeem.witness, outputType)
    } else {
      expanded = expandInput(bscript.compile(redeem.witness), [], outputType, redeem.output)
    }
    if (!expanded.prevOutType) return {}

    return {
      prevOutScript: output,
      prevOutType: SCRIPT_TYPES.P2WSH,
      witnessScript: redeem.output,
      witnessScriptType: expanded.prevOutType,

      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures
    }
  }

  return {
    prevOutType: SCRIPT_TYPES.NONSTANDARD,
    prevOutScript: scriptSig
  }
}

// could be done in expandInput, but requires the original Transaction for hashForSignature
function fixMultisigOrder (input, transaction, vin) {
  if (input.redeemScriptType !== SCRIPT_TYPES.P2MS || !input.redeemScript) return
  if (input.pubkeys.length === input.signatures.length) return

  const unmatched = input.signatures.concat()

  input.signatures = input.pubkeys.map(function (pubKey) {
    const keyPair = ECPair.fromPublicKey(pubKey)
    let match

    // check for a signature
    unmatched.some(function (signature, i) {
      // skip if undefined || OP_0
      if (!signature) return false

      // TODO: avoid O(n) hashForSignature
      const parsed = bscript.signature.decode(signature)
      const hash = transaction.hashForSignature(vin, input.redeemScript, parsed.hashType)

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

function expandOutput (script, ourPubKey) {
  typeforce(types.Buffer, script)
  const type = classify.output(script)

  switch (type) {
    case SCRIPT_TYPES.P2PKH: {
      if (!ourPubKey) return { type }

      // does our hash160(pubKey) match the output scripts?
      const pkh1 = payments.p2pkh({ output: script }).hash
      const pkh2 = bcrypto.hash160(ourPubKey)
      if (!pkh1.equals(pkh2)) return { type }

      return {
        type,
        pubkeys: [ourPubKey],
        signatures: [undefined]
      }
    }

    case SCRIPT_TYPES.P2WPKH: {
      if (!ourPubKey) return { type }

      // does our hash160(pubKey) match the output scripts?
      const wpkh1 = payments.p2wpkh({ output: script }).hash
      const wpkh2 = bcrypto.hash160(ourPubKey)
      if (!wpkh1.equals(wpkh2)) return { type }

      return {
        type,
        pubkeys: [ourPubKey],
        signatures: [undefined]
      }
    }

    case SCRIPT_TYPES.P2PK: {
      const p2pk = payments.p2pk({ output: script })
      return {
        type,
        pubkeys: [p2pk.pubkey],
        signatures: [undefined]
      }
    }

    case SCRIPT_TYPES.P2MS: {
      const p2ms = payments.p2ms({ output: script })
      return {
        type,
        pubkeys: p2ms.pubkeys,
        signatures: p2ms.pubkeys.map(() => undefined),
        maxSignatures: p2ms.m
      }
    }
  }

  return { type }
}

function prepareInput (input, ourPubKey, redeemScript, witnessScript) {
  if (redeemScript && witnessScript) {
    const p2wsh = payments.p2wsh({ redeem: { output: witnessScript } })
    const p2wshAlt = payments.p2wsh({ output: redeemScript })
    const p2sh = payments.p2sh({ redeem: { output: redeemScript } })
    const p2shAlt = payments.p2sh({ redeem: p2wsh })

    // enforces P2SH(P2WSH(...))
    if (!p2wsh.hash.equals(p2wshAlt.hash)) throw new Error('Witness script inconsistent with prevOutScript')
    if (!p2sh.hash.equals(p2shAlt.hash)) throw new Error('Redeem script inconsistent with prevOutScript')

    const expanded = expandOutput(p2wsh.redeem.output, ourPubKey)
    if (!expanded.pubkeys) throw new Error(expanded.type + ' not supported as witnessScript (' + bscript.toASM(witnessScript) + ')')
    if (input.signatures && input.signatures.some(x => x)) {
      expanded.signatures = input.signatures
    }

    let signScript = witnessScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH) throw new Error('P2SH(P2WSH(P2WPKH)) is a consensus failure')

    return {
      redeemScript,
      redeemScriptType: SCRIPT_TYPES.P2WSH,

      witnessScript,
      witnessScriptType: expanded.type,

      prevOutType: SCRIPT_TYPES.P2SH,
      prevOutScript: p2sh.output,

      hasWitness: true,
      signScript,
      signType: expanded.type,

      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures
    }
  }

  if (redeemScript) {
    const p2sh = payments.p2sh({ redeem: { output: redeemScript } })

    if (input.prevOutScript) {
      let p2shAlt
      try {
        p2shAlt = payments.p2sh({ output: input.prevOutScript })
      } catch (e) { throw new Error('PrevOutScript must be P2SH') }
      if (!p2sh.hash.equals(p2shAlt.hash)) throw new Error('Redeem script inconsistent with prevOutScript')
    }

    const expanded = expandOutput(p2sh.redeem.output, ourPubKey)
    if (!expanded.pubkeys) throw new Error(expanded.type + ' not supported as redeemScript (' + bscript.toASM(redeemScript) + ')')
    if (input.signatures && input.signatures.some(x => x)) {
      expanded.signatures = input.signatures
    }

    let signScript = redeemScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH) {
      signScript = payments.p2pkh({ pubkey: expanded.pubkeys[0] }).output
    }

    return {
      redeemScript,
      redeemScriptType: expanded.type,

      prevOutType: SCRIPT_TYPES.P2SH,
      prevOutScript: p2sh.output,

      hasWitness: expanded.type === SCRIPT_TYPES.P2WPKH,
      signScript,
      signType: expanded.type,

      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures
    }
  }

  if (witnessScript) {
    const p2wsh = payments.p2wsh({ redeem: { output: witnessScript } })

    if (input.prevOutScript) {
      const p2wshAlt = payments.p2wsh({ output: input.prevOutScript })
      if (!p2wsh.hash.equals(p2wshAlt.hash)) throw new Error('Witness script inconsistent with prevOutScript')
    }

    const expanded = expandOutput(p2wsh.redeem.output, ourPubKey)
    if (!expanded.pubkeys) throw new Error(expanded.type + ' not supported as witnessScript (' + bscript.toASM(witnessScript) + ')')
    if (input.signatures && input.signatures.some(x => x)) {
      expanded.signatures = input.signatures
    }

    let signScript = witnessScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH) throw new Error('P2WSH(P2WPKH) is a consensus failure')

    return {
      witnessScript,
      witnessScriptType: expanded.type,

      prevOutType: SCRIPT_TYPES.P2WSH,
      prevOutScript: p2wsh.output,

      hasWitness: true,
      signScript,
      signType: expanded.type,

      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures
    }
  }

  if (input.prevOutType && input.prevOutScript) {
    // embedded scripts are not possible without extra information
    if (input.prevOutType === SCRIPT_TYPES.P2SH) throw new Error('PrevOutScript is ' + input.prevOutType + ', requires redeemScript')
    if (input.prevOutType === SCRIPT_TYPES.P2WSH) throw new Error('PrevOutScript is ' + input.prevOutType + ', requires witnessScript')
    if (!input.prevOutScript) throw new Error('PrevOutScript is missing')

    const expanded = expandOutput(input.prevOutScript, ourPubKey)
    if (!expanded.pubkeys) throw new Error(expanded.type + ' not supported (' + bscript.toASM(input.prevOutScript) + ')')
    if (input.signatures && input.signatures.some(x => x)) {
      expanded.signatures = input.signatures
    }

    let signScript = input.prevOutScript
    if (expanded.type === SCRIPT_TYPES.P2WPKH) {
      signScript = payments.p2pkh({ pubkey: expanded.pubkeys[0] }).output
    }

    return {
      prevOutType: expanded.type,
      prevOutScript: input.prevOutScript,

      hasWitness: expanded.type === SCRIPT_TYPES.P2WPKH,
      signScript,
      signType: expanded.type,

      pubkeys: expanded.pubkeys,
      signatures: expanded.signatures,
      maxSignatures: expanded.maxSignatures
    }
  }

  const prevOutScript = payments.p2pkh({ pubkey: ourPubKey }).output
  return {
    prevOutType: SCRIPT_TYPES.P2PKH,
    prevOutScript: prevOutScript,

    hasWitness: false,
    signScript: prevOutScript,
    signType: SCRIPT_TYPES.P2PKH,

    pubkeys: [ourPubKey],
    signatures: [undefined]
  }
}

function build (type, input, allowIncomplete) {
  const pubkeys = input.pubkeys || []
  let signatures = input.signatures || []

  switch (type) {
    case SCRIPT_TYPES.P2PKH: {
      if (pubkeys.length === 0) break
      if (signatures.length === 0) break

      return payments.p2pkh({ pubkey: pubkeys[0], signature: signatures[0] })
    }
    case SCRIPT_TYPES.P2WPKH: {
      if (pubkeys.length === 0) break
      if (signatures.length === 0) break

      return payments.p2wpkh({ pubkey: pubkeys[0], signature: signatures[0] })
    }
    case SCRIPT_TYPES.P2PK: {
      if (pubkeys.length === 0) break
      if (signatures.length === 0) break

      return payments.p2pk({ signature: signatures[0] })
    }
    case SCRIPT_TYPES.P2MS: {
      const m = input.maxSignatures
      if (allowIncomplete) {
        signatures = signatures.map(x => x || ops.OP_0)
      } else {
        signatures = signatures.filter(x => x)
      }

      // if the transaction is not not complete (complete), or if signatures.length === m, validate
      // otherwise, the number of OP_0's may be >= m, so don't validate (boo)
      const validate = !allowIncomplete || (m === signatures.length)
      return payments.p2ms({ m, pubkeys, signatures }, { allowIncomplete, validate })
    }
    case SCRIPT_TYPES.P2SH: {
      const redeem = build(input.redeemScriptType, input, allowIncomplete)
      if (!redeem) return

      return payments.p2sh({
        redeem: {
          output: redeem.output || input.redeemScript,
          input: redeem.input,
          witness: redeem.witness
        }
      })
    }
    case SCRIPT_TYPES.P2WSH: {
      const redeem = build(input.witnessScriptType, input, allowIncomplete)
      if (!redeem) return

      return payments.p2wsh({
        redeem: {
          output: input.witnessScript,
          input: redeem.input,
          witness: redeem.witness
        }
      })
    }
  }
}

function TransactionBuilder (network, maximumFeeRate) {
  this.__prevTxSet = {}
  this.network = network || networks.bitcoin

  // WARNING: This is __NOT__ to be relied on, its just another potential safety mechanism (safety in-depth)
  this.maximumFeeRate = maximumFeeRate || 2500

  this.__inputs = []
  this.__tx = new Transaction()
  this.__tx.version = 2
}

TransactionBuilder.prototype.setLockTime = function (locktime) {
  typeforce(types.UInt32, locktime)

  // if any signatures exist, throw
  if (this.__inputs.some(function (input) {
    if (!input.signatures) return false

    return input.signatures.some(function (s) { return s })
  })) {
    throw new Error('No, this would invalidate signatures')
  }

  this.__tx.locktime = locktime
}

TransactionBuilder.prototype.setVersion = function (version) {
  typeforce(types.UInt32, version)

  // XXX: this might eventually become more complex depending on what the versions represent
  this.__tx.version = version
}

TransactionBuilder.fromTransaction = function (transaction, network) {
  const txb = new TransactionBuilder(network)

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
      script: txIn.script,
      witness: txIn.witness
    })
  })

  // fix some things not possible through the public API
  txb.__inputs.forEach(function (input, i) {
    fixMultisigOrder(input, transaction, i)
  })

  return txb
}

TransactionBuilder.prototype.addInput = function (txHash, vout, sequence, prevOutScript) {
  if (!this.__canModifyInputs()) {
    throw new Error('No, this would invalidate signatures')
  }

  let value

  // is it a hex string?
  if (typeof txHash === 'string') {
    // transaction hashs's are displayed in reverse order, un-reverse it
    txHash = Buffer.from(txHash, 'hex').reverse()

  // is it a Transaction object?
  } else if (txHash instanceof Transaction) {
    const txOut = txHash.outs[vout]
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

  const prevTxOut = txHash.toString('hex') + ':' + vout
  if (this.__prevTxSet[prevTxOut] !== undefined) throw new Error('Duplicate TxOut: ' + prevTxOut)

  let input = {}

  // derive what we can from the scriptSig
  if (options.script !== undefined) {
    input = expandInput(options.script, options.witness || [])
  }

  // if an input value was given, retain it
  if (options.value !== undefined) {
    input.value = options.value
  }

  // derive what we can from the previous transactions output script
  if (!input.prevOutScript && options.prevOutScript) {
    let prevOutType

    if (!input.pubkeys && !input.signatures) {
      const expanded = expandOutput(options.prevOutScript)
      if (expanded.pubkeys) {
        input.pubkeys = expanded.pubkeys
        input.signatures = expanded.signatures
      }

      prevOutType = expanded.type
    }

    input.prevOutScript = options.prevOutScript
    input.prevOutType = prevOutType || classify.output(options.prevOutScript)
  }

  const vin = this.__tx.addInput(txHash, vout, options.sequence, options.scriptSig)
  this.__inputs[vin] = input
  this.__prevTxSet[prevTxOut] = true
  return vin
}

TransactionBuilder.prototype.addOutput = function (scriptPubKey, value) {
  if (!this.__canModifyOutputs()) {
    throw new Error('No, this would invalidate signatures')
  }

  // Attempt to get a script if it's a base58 or bech32 address string
  if (typeof scriptPubKey === 'string') {
    scriptPubKey = baddress.toOutputScript(scriptPubKey, this.network)
  }

  return this.__tx.addOutput(scriptPubKey, value)
}

TransactionBuilder.prototype.build = function () {
  return this.__build(false)
}
TransactionBuilder.prototype.buildIncomplete = function () {
  return this.__build(true)
}

TransactionBuilder.prototype.__build = function (allowIncomplete) {
  if (!allowIncomplete) {
    if (!this.__tx.ins.length) throw new Error('Transaction has no inputs')
    if (!this.__tx.outs.length) throw new Error('Transaction has no outputs')
  }

  const tx = this.__tx.clone()

  // create script signatures from inputs
  this.__inputs.forEach(function (input, i) {
    if (!input.prevOutType && !allowIncomplete) throw new Error('Transaction is not complete')

    const result = build(input.prevOutType, input, allowIncomplete)
    if (!result) {
      if (!allowIncomplete && input.prevOutType === SCRIPT_TYPES.NONSTANDARD) throw new Error('Unknown input type')
      if (!allowIncomplete) throw new Error('Not enough information')
      return
    }

    tx.setInputScript(i, result.input)
    tx.setWitness(i, result.witness)
  })

  if (!allowIncomplete) {
    // do not rely on this, its merely a last resort
    if (this.__overMaximumFees(tx.virtualSize())) {
      throw new Error('Transaction has absurd fees')
    }
  }

  return tx
}

function canSign (input) {
  return input.signScript !== undefined &&
    input.signType !== undefined &&
    input.pubkeys !== undefined &&
    input.signatures !== undefined &&
    input.signatures.length === input.pubkeys.length &&
    input.pubkeys.length > 0 &&
    (
      input.hasWitness === false ||
      input.value !== undefined
    )
}

TransactionBuilder.prototype.sign = function (vin, keyPair, redeemScript, hashType, witnessValue, witnessScript) {
  // TODO: remove keyPair.network matching in 4.0.0
  if (keyPair.network && keyPair.network !== this.network) throw new TypeError('Inconsistent network')
  if (!this.__inputs[vin]) throw new Error('No input at index: ' + vin)

  hashType = hashType || Transaction.SIGHASH_ALL
  if (this.__needsOutputs(hashType)) throw new Error('Transaction needs outputs')

  const input = this.__inputs[vin]

  // if redeemScript was previously provided, enforce consistency
  if (input.redeemScript !== undefined &&
      redeemScript &&
      !input.redeemScript.equals(redeemScript)) {
    throw new Error('Inconsistent redeemScript')
  }

  const ourPubKey = keyPair.publicKey || keyPair.getPublicKey()
  if (!canSign(input)) {
    if (witnessValue !== undefined) {
      if (input.value !== undefined && input.value !== witnessValue) throw new Error('Input didn\'t match witnessValue')
      typeforce(types.Satoshi, witnessValue)
      input.value = witnessValue
    }

    if (!canSign(input)) {
      const prepared = prepareInput(input, ourPubKey, redeemScript, witnessScript)

      // updates inline
      Object.assign(input, prepared)
    }

    if (!canSign(input)) throw Error(input.prevOutType + ' not supported')
  }

  // ready to sign
  let signatureHash
  if (input.hasWitness) {
    signatureHash = this.__tx.hashForWitnessV0(vin, input.signScript, input.value, hashType)
  } else {
    signatureHash = this.__tx.hashForSignature(vin, input.signScript, hashType)
  }

  // enforce in order signing of public keys
  const signed = input.pubkeys.some(function (pubKey, i) {
    if (!ourPubKey.equals(pubKey)) return false
    if (input.signatures[i]) throw new Error('Signature already exists')

    // TODO: add tests
    if (ourPubKey.length !== 33 && input.hasWitness) {
      throw new Error('BIP143 rejects uncompressed public keys in P2WPKH or P2WSH')
    }

    const signature = keyPair.sign(signatureHash)
    input.signatures[i] = bscript.signature.encode(signature, hashType)
    return true
  })

  if (!signed) throw new Error('Key pair cannot sign for this input')
}

function signatureHashType (buffer) {
  return buffer.readUInt8(buffer.length - 1)
}

TransactionBuilder.prototype.__canModifyInputs = function () {
  return this.__inputs.every(function (input) {
    if (!input.signatures) return true

    return input.signatures.every(function (signature) {
      if (!signature) return true
      const hashType = signatureHashType(signature)

      // if SIGHASH_ANYONECANPAY is set, signatures would not
      // be invalidated by more inputs
      return hashType & Transaction.SIGHASH_ANYONECANPAY
    })
  })
}

TransactionBuilder.prototype.__needsOutputs = function (signingHashType) {
  if (signingHashType === Transaction.SIGHASH_ALL) {
    return this.__tx.outs.length === 0
  }

  // if inputs are being signed with SIGHASH_NONE, we don't strictly need outputs
  // .build() will fail, but .buildIncomplete() is OK
  return (this.__tx.outs.length === 0) && this.__inputs.some((input) => {
    if (!input.signatures) return false

    return input.signatures.some((signature) => {
      if (!signature) return false // no signature, no issue
      const hashType = signatureHashType(signature)
      if (hashType & Transaction.SIGHASH_NONE) return false // SIGHASH_NONE doesn't care about outputs
      return true // SIGHASH_* does care
    })
  })
}

TransactionBuilder.prototype.__canModifyOutputs = function () {
  const nInputs = this.__tx.ins.length
  const nOutputs = this.__tx.outs.length

  return this.__inputs.every(function (input) {
    if (input.signatures === undefined) return true

    return input.signatures.every(function (signature) {
      if (!signature) return true
      const hashType = signatureHashType(signature)

      const hashTypeMod = hashType & 0x1f
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
  const incoming = this.__inputs.reduce(function (a, x) { return a + (x.value >>> 0) }, 0)

  // but all outputs do, and if we have any input value
  // we can immediately determine if the outputs are too small
  const outgoing = this.__tx.outs.reduce(function (a, x) { return a + x.value }, 0)
  const fee = incoming - outgoing
  const feeRate = fee / bytes

  return feeRate > this.maximumFeeRate
}

module.exports = TransactionBuilder
