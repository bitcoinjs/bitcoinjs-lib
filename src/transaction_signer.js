var bscript = require('./script')
var OPS = require('./opcodes.json')
var bscriptNumber = require('./script_number')
var bcrypto = require('./crypto')
var bufferEquals = require('buffer-equals')
var typeforce = require('typeforce')
var types = require('./types')
var ECPair = require('./ecpair')
var ECSignature = require('./ecsignature')
var Transaction = require('./transaction')
var EMPTY_SCRIPT = new Buffer(0)
var SIGNABLE_SCRIPTS = [
  bscript.types.MULTISIG,
  bscript.types.P2PKH,
  bscript.types.P2PK
]

var ALLOWED_P2SH_SCRIPTS = [
  bscript.types.MULTISIG,
  bscript.types.P2PKH,
  bscript.types.P2PK,
  bscript.types.P2WSH,
  bscript.types.P2WPKH
]

function calculateSigHash (tx, nIn, scriptCode, sigHashType, sigVersion, txOutAmount) {
  return sigVersion === 1
    ? tx.hashForWitnessV0(nIn, scriptCode, txOutAmount, sigHashType)
    : tx.hashForSignature(nIn, scriptCode, sigHashType)
}

function sortMultisigs (tx, nIn, txOutValue, ecsigs, publicKeys, scriptCode, sigVersion) {
  var results = []
  var hash
  var ikey = 0
  var isig = 0
  var sig, key
  var success = true
  var sigsCount = ecsigs.length
  var keysCount = publicKeys.length
  while (success && ecsigs.length > 0) {
    sig = ECSignature.parseScriptSignature(ecsigs[isig])
    key = ECPair.fromPublicKeyBuffer(publicKeys[ikey])
    hash = calculateSigHash(tx, nIn, scriptCode, sig.hashType, sigVersion, txOutValue)
    if (key.verify(hash, sig.signature)) {
      isig++
      results[key.getPublicKeyBuffer().toString('binary')] = ecsigs[isig]
    }
    ikey++
    if (sigsCount > keysCount) {
      success = false
    }
  }

  return results
}

function calculateSignature (tx, nIn, key, scriptCode, sigHashType, sigVersion, txOutValue) {
  var hash = calculateSigHash(tx, nIn, scriptCode, sigHashType, sigVersion, txOutValue)
  return key.sign(hash).toScriptSignature(sigHashType)
}

function pushOnlyRead (op) {
  if (op === OPS.OP_0) {
    return new Buffer()
  } else if (op instanceof Buffer) {
    return op
  } else if (op === OPS.OP_1NEGATE || op >= OPS.OP_1 && op <= OPS.OP_16) {
    return bscriptNumber.encode(op - 0x50)
  } else {
    throw new Error('Should only be run on a push-only script')
  }
}

function pushOnlyWrite (buffer) {
  if (!(buffer instanceof Buffer)) {
    throw new Error('Non-buffer passed to pushOnlyWrite')
  }

  if (buffer.length === 0) {
    return OPS.OP_0
  } else if (buffer.length === 1 && (buffer[0] === 0x81 || buffer[0] >= 1 && buffer[0] <= 16)) {
    return bscriptNumber.decode(buffer)
  } else {
    return buffer
  }
}

function evalPushOnly (script) {
  return bscript.decompile(script).map(pushOnlyRead)
}

function pushAll (chunks) {
  return bscript.compile(chunks.map(pushOnlyWrite))
}

function solveScript (scriptCode) {
  if (!(scriptCode instanceof Buffer)) {
    throw new Error('Argument 0 for solveScript must be a Buffer')
  }

  var outputType = bscript.classifyOutput(scriptCode)
  var canSign = SIGNABLE_SCRIPTS.indexOf(outputType) !== -1
  var solvedBy = null
  var requiredSigs = null

  switch (outputType) {
    // We can only determine the relevant hash from these, not if it's signable
    case bscript.types.P2SH:
      solvedBy = bscript.scriptHash.output.decode(scriptCode)
      break
    case bscript.types.P2WSH:
      solvedBy = bscript.witnessScriptHash.output.decode(scriptCode)
      break

    // We can immediately solve signatures for these
    // When adding a new script type, edit here
    case bscript.types.P2WPKH:
      requiredSigs = 1
      solvedBy = bscript.witnessPubKeyHash.output.decode(scriptCode)
      break
    case bscript.types.P2PK:
      requiredSigs = 1
      solvedBy = bscript.pubKey.output.decode(scriptCode)
      break
    case bscript.types.P2PKH:
      requiredSigs = 1
      solvedBy = bscript.pubKeyHash.output.decode(scriptCode)
      break
    case bscript.types.MULTISIG:
      solvedBy = bscript.multisig.output.decode(scriptCode)
      requiredSigs = solvedBy.m
      break
  }

  return {
    type: outputType,
    script: scriptCode,
    canSign: canSign,
    solvedBy: solvedBy,
    requiredSigs: requiredSigs
  }
}

/**
 * Design goals
 *
 *  - tolerate arbitrary sigHashType's on signatures
 *  - given tx, nIn, txOut, we can reliably check a redeemScript and eventual witnessScript at signing
 *  - reliably extract signatures from a signed input
 *  - create, and re-serialize given minimal state
 *  - clear separation of 'standard scripts' and the various script-hash scripts
 *
 * @param tx - the transaction we want to sign
 * @param nIn - the input we will sign here
 * @param opts
 */
function InSigner (tx, nIn, opts) {
  if ((tx instanceof Transaction) === false) {
    throw new Error('A transaction is required for InSigner')
  }
  if (opts.scriptPubKey === undefined) {
    throw new Error('A value for scriptPubKey is required')
  }

  this.tx = tx
  this.nIn = nIn
  this.publicKeys = []
  this.signatures = []
  this.requiredSigs = null
  this.solve(opts)
  this.extractSig()
}

InSigner.prototype.isFullySigned = function () {
  return this.requiredSigs !== null && this.requiredSigs === this.signatures.length
}

InSigner.prototype.extractStandard = function (solution, chunks, sigVersion) {
  var signatures = []
  var publicKeys = []
  var decoded

  // only SIGNABLE_SCRIPTS can be extracted here
  if (solution.type === bscript.types.P2PK) {
    if (bscript.pubKey.input.check(chunks)) {
      decoded = bscript.pubKey.input.decode(chunks)
      signatures[0] = decoded.signature
      publicKeys[0] = solution.solvedBy
    }
  } else if (solution.type === bscript.types.P2PKH) {
    if (bscript.pubKeyHash.input.check(chunks)) {
      decoded = bscript.pubKeyHash.input.decode(chunks)
      signatures[0] = decoded.signature
      publicKeys[0] = decoded.pubKey
    }
  } else if (solution.type === bscript.types.MULTISIG) {
    if (bscript.multisig.input.check(chunks)) {
      publicKeys = solution.solvedBy.publicKeys
      signatures = bscript.multisig.input.decode(chunks, true)

      // We need to map signature to the pubkey index in order to re-serialize
      var sigs = sortMultisigs(this.tx, this.nIn, this.txOut.value, signatures, publicKeys, solution.script, sigVersion)
      for (var i = 0, l = publicKeys.length; i < l; i++) {
        var str = publicKeys[ i ].getPublicKeyBuffer().toString('binary')
        if (sigs[ str ] !== undefined && bscript.isCanonicalSignature(sigs[str])) {
          signatures[ i ] = sigs[ str ]
        }
      }
    }
  } else {
    throw new Error('Never call extractStandardFromChunks on a non-SIGNABLE script')
  }

  return [signatures, publicKeys]
}

InSigner.prototype.solve = function (opts) {
  var solution = solveScript(opts.scriptPubKey)
  if (solution.type === bscript.types.NONSTANDARD) {
    throw new Error('txOut script is non-standard')
  }

  this.scriptPubKey = solution
  if (solution.type === bscript.types.P2SH) {
    var scriptHash = solution.solvedBy
    if (!(opts.redeemScript instanceof Buffer)) {
      throw new Error('Redeem script required to solve utxo')
    }

    if (!scriptHash.equals(bcrypto.hash160(opts.redeemScript))) {
      throw new Error('Redeem script does not match txOut script hash')
    }

    solution = solveScript(opts.redeemScript)
    if (ALLOWED_P2SH_SCRIPTS.indexOf(solution.type)) {
      this.redeemScript = solution
    } else {
      throw new Error('Unsupported P2SH script')
    }
  }

  if (solution.type === bscript.types.P2WPKH) {
    if (!types.Satoshi(opts.value)) {
      throw new Error('Value is required for witness-key-hash')
    }
    this.value = opts.value
  } else if (solution.type === bscript.types.P2WSH) {
    var witnessScriptHash = solution.solvedBy
    if (!(opts.witnessScript instanceof Buffer)) {
      throw new Error('P2WSH script required to solve utxo')
    }
    if (!types.Satoshi(opts.value)) {
      throw new Error('Value is required for witness-script-hash')
    }
    if (!bufferEquals(bcrypto.sha256(opts.witnessScript), witnessScriptHash)) {
      throw new Error('Witness script does not match txOut script hash')
    }
    this.witnessScript = solveScript(opts.witnessScript)
    this.value = opts.value
    if (SIGNABLE_SCRIPTS.indexOf(this.witnessScript.type) === -1) {
      throw new Error('witness script is not supported')
    }
  }
}

InSigner.prototype.extractSig = function () {
  // Attempt decoding of the input scriptSig and witness
  var input = this.tx.ins[this.nIn]
  var solution = this.scriptPubKey
  if (solution.canSign) {
    [this.signatures, this.publicKeys] = this.extractStandard(solution, evalPushOnly(input.script), Transaction.SIG_V0)
  }

  if (solution.type === bscript.types.P2SH) {
    if (bscript.scriptHash.input.check(input.script)) {
      var p2sh = bscript.scriptHash.input.decode(input.script)
      if (!p2sh.redeemScript.equals(this.redeemScript.script)) {
        throw new Error('Redeem script from scriptSig does not match')
      }
      if (this.redeemScript.canSign) {
        [this.signatures, this.publicKeys] = this.extractStandard(solution, evalPushOnly(p2sh.redeemScriptSig), Transaction.SIG_V0)
      }
      solution = this.redeemScript
    }
  }

  if (solution.type === bscript.types.P2WPKH) {
    if (input.witness.length === 2) {
      var witnessKeyHash = solution.solvedBy
      if (!witnessKeyHash.equals(bcrypto.hash160(input.witness[1]))) {
        throw new Error('Public key does not match key-hash')
      }

      [this.signatures, this.publicKeys] = this.extractStandard(bscript.types.P2PKH, input.witness)
    }
  } else if (solution.type === bscript.types.P2WSH) {
    if (input.witness.length > 0) {
      if (!this.witnessScript.equals(input.witness[ input.witness.length - 1 ])) {
        throw new Error('Witness script does not match')
      }

      if (this.witnessScript.canSign) {
        [ this.signatures, this.publicKeys ] = this.extractStandard(solution, input.witness.slice(0, -1), Transaction.SIG_V1)
      }
    }
  }
}

function signStandard (tx, nIn, txOutValue, signatures, publicKeys, key, solution, sigHashType, sigVersion) {
  // Only SIGNABLE_SCRIPTS can be signed here
  var didSign = false
  var keyBuffer = key.getPublicKeyBuffer()
  if (solution.type === bscript.types.P2PK) {
    if (bufferEquals(keyBuffer, solution.solvedBy)) {
      signatures = [calculateSignature(tx, nIn, key, solution.script, sigHashType, sigVersion, txOutValue)]
      publicKeys = [keyBuffer]
      didSign = true
    }
  } else if (solution.type === bscript.types.P2PKH) {
    if (bufferEquals(bcrypto.hash160(keyBuffer), solution.solvedBy)) {
      signatures = [calculateSignature(tx, nIn, key, solution.script, sigHashType, sigVersion, txOutValue)]
      publicKeys = [keyBuffer]
      didSign = true
    }
  } else if (solution.type === bscript.types.MULTISIG) {
    for (var i = 0, keyLen = solution.solvedBy.pubKeys.length; i < keyLen; i++) {
      publicKeys[i] = solution.solvedBy.pubKeys[i]
      if (bufferEquals(keyBuffer, publicKeys[i])) {
        didSign = true
        signatures[i] = calculateSignature(tx, nIn, key, solution.script, sigHashType, sigVersion, txOutValue)
      }
    }
  } else {
    throw new Error('signStandard can only sign SIGNABLE_SCRIPTS')
  }

  if (!didSign) {
    throw new Error('Signing input with wrong private key')
  }

  return [signatures, publicKeys]
}

InSigner.prototype.sign = function (key, sigHashType) {
  sigHashType = sigHashType || Transaction.SIGHASH_ALL

  // Attempt to solve the txOut script
  var solution = this.scriptPubKey
  if (solution.canSign) {
    [this.signatures, this.publicKeys] = signStandard(this.tx, this.nIn, undefined, this.signatures, this.publicKeys, key, solution, sigHashType, Transaction.SIG_V0)
  }

  // If the spkPubKeyHash was solvable, and the type is P2SH, we try again with the redeemScript
  if (solution.type === bscript.types.P2SH) {
    // solution updated, type is the type of the redeemScript
    solution = this.redeemScript
    if (ALLOWED_P2SH_SCRIPTS.indexOf(solution.type) !== -1) {
      if (solution.canSign) {
        [this.signatures, this.publicKeys] = signStandard(this.tx, this.nIn, undefined, this.signatures, this.publicKeys, key, solution, sigHashType, Transaction.SIG_V0)
      }
    }
  }

  if (solution.type === bscript.types.P2WPKH) {
    var p2wpkh = solveScript(bscript.pubKeyHash.output.encode(solution.solvedBy));
    [this.signatures, this.publicKeys] = signStandard(this.tx, this.nIn, this.value, this.signatures, this.publicKeys, key, p2wpkh, sigHashType, Transaction.SIG_V1)
  } else if (solution.type === bscript.types.P2WSH) {
    solution = this.witnessScript
    if (solution.canSign) {
      [this.signatures, this.publicKeys] = signStandard(this.tx, this.nIn, this.value, this.signatures, this.publicKeys, key, solution, sigHashType, Transaction.SIG_V1)
    }
  }

  this.requiredSigs = this.publicKeys.length

  return solution
}

function serializeStandard (outputType, signatures, publicKeys) {
  // When adding a new script type, edit here
  var chunks = []
  switch (outputType) {
    case bscript.types.P2PK:
      if (signatures.length === 1) {
        chunks = [signatures[ 0 ]]
      }
      break
    case bscript.types.P2PKH:
      if (signatures.length === 1) {
        chunks = [signatures[ 0 ], publicKeys[ 0 ]]
      }
      break
    case bscript.types.MULTISIG:
      chunks.push(new Buffer(0))
      chunks = chunks.concat(signatures.map(function (signature) {
        if (signature instanceof Buffer === false) {
          throw new Error('debugging probably required')
        }
        return signature
      }))
      break
    default:
      throw new Error('serializeStandardChunks only works with a SIGNABLE_SCRIPT')
  }

  return chunks
}

function serializeSigData (signatures, publicKeys, scriptPubKey, redeemScript, witnessScript) {
  var sigData = {
    scriptSig: EMPTY_SCRIPT,
    witness: []
  }
  var type = scriptPubKey.type
  if (scriptPubKey.canSign) {
    sigData.scriptSig = pushAll(serializeStandard(type, signatures, publicKeys))
  }

  var p2sh = false
  if (type === bscript.types.P2SH) {
    if (redeemScript === undefined) {
      throw new Error('Redeem script not provided')
    }
    p2sh = true
    type = redeemScript.type
    if (redeemScript.canSign) {
      sigData.scriptSig = pushAll(serializeStandard(type, signatures, publicKeys))
    }
  }

  if (type === bscript.types.P2WPKH) {
    sigData.witness = serializeStandard(bscript.types.P2PKH, signatures, publicKeys)
  } else if (type === bscript.types.P2WSH) {
    if (witnessScript === undefined) {
      throw new Error('Witness script not provided')
    }
    type = witnessScript.type
    if (witnessScript.canSign) {
      sigData.scriptSig = EMPTY_SCRIPT
      sigData.witness = serializeStandard(type, signatures, publicKeys)
      sigData.witness.push(witnessScript.script)
    }
  }

  if (p2sh) {
    sigData.scriptSig = bscript.scriptHash.input.encode(sigData.scriptSig, redeemScript.script)
  }

  return sigData
}

InSigner.prototype.serializeSigData = function () {
  return serializeSigData(this.signatures, this.publicKeys, this.scriptPubKey, this.redeemScript, this.witnessScript)
}

/**
 * Create a TxSigner for this transaction instance
 * @param tx
 * @constructor
 */
function TxSigner (tx) {
  if (tx === undefined || (tx instanceof Transaction) === false) {
    throw new Error('A transaction is required for TxSigner')
  }

  this.tx = tx.clone()
  this.states = []
}

/**
 * Sign a transaction.
 *
 * @param nIn - the input to sign
 * @param key - the private key to sign with
 * @param sigHashType - SIGHASH type to sign with
 * @param opts - optional data required to solve UTXO
 */
TxSigner.prototype.sign = function (nIn, key, opts, sigHashType) {
  typeforce(types.Number, nIn)
  typeforce(types.maybe(Number), sigHashType)
  if (sigHashType === undefined) {
    sigHashType = Transaction.SIGHASH_ALL
  }
  // You can probably make this work with the current library, if you can work out the witnessScript above!
  // generate opts for the internal signer based off older way of positional arguments to TxSigner.sign
  if (this.states[nIn] === undefined) {
    this.states[nIn] = new InSigner(this.tx, nIn, opts)
  }

  if (!this.states[nIn].sign(key, sigHashType)) {
    throw new Error('Unsignable input: ', nIn)
  }

  return true
}

/**
 * Produce a Transaction with our changes.
 */
TxSigner.prototype.done = function () {
  var tx = this.tx.clone()

  var states = this.states
  for (var i = 0, l = tx.ins.length; i < l; i++) {
    if (this.states[i] !== undefined) {
      var sigData = states[i].serializeSigData()
      tx.ins[i].script = sigData.scriptSig
      tx.ins[i].witness = sigData.witness
    }
  }
  return tx
}

module.exports = TxSigner
