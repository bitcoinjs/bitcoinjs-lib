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
  this.requiredSigs = 0
  this.solve(opts)
  this.extractSig()
}

InSigner.prototype.solve = function (opts) {
  // Link scriptPubKey, and check that redeemScript/witnessScript/amount are provided
  // Sets sigVersion, signScript, scriptPubKey (solution), redeemScript (solution), and witnessScript (solution)

  // Determine scriptPubKey is solvable
  var scriptPubKey = bscript.solveOutput(opts.scriptPubKey)
  if (scriptPubKey.type !== bscript.types.P2SH && ALLOWED_P2SH_SCRIPTS.indexOf(scriptPubKey.type) === -1) {
    throw new Error('txOut script is non-standard')
  }

  var solution = scriptPubKey
  var redeemScript
  var witnessScript
  var sigVersion = Transaction.SIG_V0
  var value = 0

  if (solution.type === bscript.types.P2SH) {
    var scriptHash = solution.solvedBy
    // Redeem script must be provided by opts
    if (!(opts.redeemScript instanceof Buffer)) {
      throw new Error('Redeem script required to solve utxo')
    }
    // Check redeemScript against script-hash
    if (!scriptHash.equals(bcrypto.hash160(opts.redeemScript))) {
      throw new Error('Redeem script does not match txOut script hash')
    }
    // Prevent non-standard P2SH scripts
    solution = bscript.solveOutput(opts.redeemScript)
    if (!ALLOWED_P2SH_SCRIPTS.indexOf(solution.type)) {
      throw new Error('Unsupported P2SH script')
    }
    redeemScript = solution
  }

  if (solution.type === bscript.types.P2WPKH) {
    // txOutValue is required here
    if (!types.Satoshi(opts.value)) {
      throw new Error('Value is required for witness-key-hash')
    }
    // We set solution to this to avoid work later, since P2WPKH is a special case of P2PKH
    solution = bscript.solveOutput(bscript.pubKeyHash.output.encode(solution.solvedBy))
    sigVersion = Transaction.SIG_V1
    value = opts.value
  } else if (solution.type === bscript.types.P2WSH) {
    var witnessScriptHash = solution.solvedBy
    // Witness script must be provided by opts
    if (!(opts.witnessScript instanceof Buffer)) {
      throw new Error('P2WSH script required to solve utxo')
    }
    // txOutValue is required here
    if (!types.Satoshi(opts.value)) {
      throw new Error('Value is required for witness-script-hash')
    }
    // Check witnessScript against script hash
    if (!bcrypto.sha256(opts.witnessScript).equals(witnessScriptHash)) {
      throw new Error('Witness script does not match txOut script hash')
    }
    // Prevent non-standard P2WSH scripts
    solution = bscript.solveOutput(opts.witnessScript)
    if (SIGNABLE_SCRIPTS.indexOf(solution.type) === -1) {
      throw new Error('Witness script is not supported')
    }
    witnessScript = solution
    sigVersion = Transaction.SIG_V1
    value = opts.value
  }

  this.requiredSigs = solution.requiredSigs
  this.scriptPubKey = scriptPubKey
  this.redeemScript = redeemScript
  this.witnessScript = witnessScript
  this.value = value
  this.sigVersion = sigVersion
  this.signScript = solution
}

InSigner.prototype.isFullySigned = function () {
  return this.requiredSigs !== null && this.signatures.length === this.requiredSigs
}

InSigner.prototype.extractSignableChunks = function (solution, chunks, sigVersion) {
  // Only SIGNABLE_SCRIPTS can be extracted here
  var signatures = []
  var publicKeys = []
  var decoded

  // only SIGNABLE_SCRIPTS can be extracted here
  if (solution.type === bscript.types.P2PK) {
    if (bscript.pubKey.input.check(chunks)) {
      decoded = bscript.pubKey.input.decode(chunks)
      if (!decoded.pubKey.equals(solution.solvedBy)) {
        throw new Error('Key in scriptSig does not match output script key')
      }

      signatures[0] = decoded.signature
      publicKeys[0] = solution.solvedBy
    }
  } else if (solution.type === bscript.types.P2PKH) {
    if (bscript.pubKeyHash.input.check(chunks)) {
      decoded = bscript.pubKeyHash.input.decode(chunks)
      if (!bcrypto.hash160(decoded.pubKey).equals(solution.solvedBy)) {
        throw new Error('Key in scriptSig does not match output script key-hash')
      }
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

InSigner.prototype.extractSig = function () {
  // Attempt decoding of the input scriptSig and witness
  var input = this.tx.ins[this.nIn]
  var solution = this.scriptPubKey
  var extractChunks = []
  if (SIGNABLE_SCRIPTS.indexOf(solution.type) !== -1) {
    extractChunks = evalPushOnly(input.script)
  }

  if (solution.type === bscript.types.P2SH) {
    if (bscript.scriptHash.input.check(input.script)) {
      // If we go to extract a P2SH scriptSig, verify the provided redeemScript
      var p2sh = bscript.scriptHash.input.decode(input.script)
      if (!p2sh.redeemScript.equals(this.redeemScript.script)) {
        throw new Error('Redeem script from scriptSig does not match')
      }
      solution = this.redeemScript
      if (SIGNABLE_SCRIPTS.indexOf(solution.type) !== -1) {
        // only do this if we can sign, otherwise we waste CPU
        extractChunks = evalPushOnly(p2sh.redeemScriptSig)
      }
    }
  }

  if (solution.type === bscript.types.P2WPKH) {
    if (input.witness.length === 2) {
      var witnessKeyHash = solution.solvedBy
      if (!witnessKeyHash.equals(bcrypto.hash160(input.witness[1]))) {
        throw new Error('Public key does not match key-hash')
      }

      extractChunks = input.witness
    }
  } else if (solution.type === bscript.types.P2WSH) {
    if (input.witness.length > 0) {
      if (!this.witnessScript.equals(input.witness[ input.witness.length - 1 ])) {
        throw new Error('Witness script does not match')
      }
      solution = input.witnessScript
      extractChunks = input.witness.slice(0, -1)
    }
  }

  if (extractChunks.length > 0) {
    [this.signatures, this.publicKeys] = this.extractSignableChunks(solution, extractChunks, this.sigVersion)
  }
}

function signSignable (tx, nIn, txOutValue, signatures, publicKeys, key, solution, sigHashType, sigVersion) {
  // Todo, skip if already signed
  // Only SIGNABLE_SCRIPTS can be signed here
  var keyBuffer = key.getPublicKeyBuffer()
  if (solution.type === bscript.types.P2PK) {
    if (bufferEquals(keyBuffer, solution.solvedBy)) {
      signatures = [calculateSignature(tx, nIn, key, solution.script, sigHashType, sigVersion, txOutValue)]
      publicKeys = [keyBuffer]
    } else {
      throw new Error('Signing input with wrong private key')
    }
  } else if (solution.type === bscript.types.P2PKH) {
    if (bufferEquals(bcrypto.hash160(keyBuffer), solution.solvedBy)) {
      signatures = [calculateSignature(tx, nIn, key, solution.script, sigHashType, sigVersion, txOutValue)]
      publicKeys = [keyBuffer]
    } else {
      throw new Error('Signing input with wrong private key')
    }
  } else if (solution.type === bscript.types.MULTISIG) {
    var match = false
    for (var i = 0, keyLen = solution.solvedBy.pubKeys.length; i < keyLen; i++) {
      publicKeys[i] = solution.solvedBy.pubKeys[i]
      if (bufferEquals(keyBuffer, publicKeys[i])) {
        match = true
        signatures[i] = calculateSignature(tx, nIn, key, solution.script, sigHashType, sigVersion, txOutValue)
      }
    }
    if (!match) {
      throw new Error('Signing input with wrong private key')
    }
  } else {
    throw new Error('signStandard can only sign SIGNABLE_SCRIPTS')
  }

  return [signatures, publicKeys]
}

/**
 * Signs the input given a key/sigHashType
 * @param key
 * @param sigHashType
 * @returns {boolean}
 */
InSigner.prototype.sign = function (key, sigHashType) {
  sigHashType = sigHashType || Transaction.SIGHASH_ALL;
  [this.signatures, this.publicKeys] = signSignable(this.tx, this.nIn, this.value, this.signatures, this.publicKeys, key, this.signScript, sigHashType, this.sigVersion)
  this.requiredSigs = this.publicKeys.length

  return true
}

/**
 * Creates an array of chunks for the scriptSig or witness
 * Future signable types go here (CSV, HTLC)
 *
 * @param outputType
 * @param signatures
 * @param publicKeys
 * @returns {Array}
 */
function serializeSignableChunks (outputType, signatures, publicKeys) {
  // Only SIGNABLE_SCRIPTS can be serialized here
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

InSigner.prototype.serializeSigData = function () {
  var scriptChunks = []
  var witnessChunks = []
  var type = this.scriptPubKey.type
  if (SIGNABLE_SCRIPTS.indexOf(this.scriptPubKey.type) !== -1) {
    scriptChunks = serializeSignableChunks(type, this.signatures, this.publicKeys)
  }

  var p2sh = false
  if (type === bscript.types.P2SH) {
    p2sh = true
    type = this.redeemScript.type
    if (SIGNABLE_SCRIPTS.indexOf(this.redeemScript.type) !== -1) {
      scriptChunks = serializeSignableChunks(type, this.signatures, this.publicKeys)
    }
  }

  if (type === bscript.types.P2WPKH) {
    witnessChunks = serializeSignableChunks(bscript.types.P2PKH, this.signatures, this.publicKeys)
  } else if (type === bscript.types.P2WSH) {
    type = this.witnessScript.type
    if (SIGNABLE_SCRIPTS.indexOf(this.witnessScript.type) !== -1) {
      scriptChunks = []
      witnessChunks = serializeSignableChunks(type, this.signatures, this.publicKeys)
      witnessChunks.push(this.witnessScript.script)
    }
  }

  if (p2sh) {
    scriptChunks.push(this.redeemScript.script)
  }

  return {
    scriptSig: pushAll(scriptChunks),
    witness: witnessChunks
  }
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
