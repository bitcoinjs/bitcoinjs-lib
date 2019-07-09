'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bip174_1 = require('bip174');
const utils_1 = require('bip174/src/lib/utils');
const address_1 = require('./address');
const bufferutils_1 = require('./bufferutils');
const crypto_1 = require('./crypto');
const ecpair_1 = require('./ecpair');
const networks_1 = require('./networks');
const payments = require('./payments');
const bscript = require('./script');
const transaction_1 = require('./transaction');
const varuint = require('varuint-bitcoin');
const DEFAULT_OPTS = {
  network: networks_1.bitcoin,
  maximumFeeRate: 5000,
};
class Psbt extends bip174_1.Psbt {
  constructor(opts = {}) {
    super();
    this.__CACHE = {
      __NON_WITNESS_UTXO_TX_CACHE: [],
      __NON_WITNESS_UTXO_BUF_CACHE: [],
      __TX_IN_CACHE: {},
      __TX: new transaction_1.Transaction(),
    };
    // set defaults
    this.opts = Object.assign({}, DEFAULT_OPTS, opts);
    this.__CACHE.__TX = transaction_1.Transaction.fromBuffer(
      this.globalMap.unsignedTx,
    );
    this.setVersion(2);
    // set cache
    const self = this;
    delete this.globalMap.unsignedTx;
    Object.defineProperty(this.globalMap, 'unsignedTx', {
      enumerable: true,
      get() {
        if (self.__CACHE.__TX_BUF_CACHE !== undefined) {
          return self.__CACHE.__TX_BUF_CACHE;
        } else {
          self.__CACHE.__TX_BUF_CACHE = self.__CACHE.__TX.toBuffer();
          return self.__CACHE.__TX_BUF_CACHE;
        }
      },
      set(data) {
        self.__CACHE.__TX_BUF_CACHE = data;
      },
    });
    // Make data hidden when enumerating
    const dpew = (obj, attr, enumerable, writable) =>
      Object.defineProperty(obj, attr, {
        enumerable,
        writable,
      });
    dpew(this, '__TX', false, true);
    dpew(this, '__EXTRACTED_TX', false, true);
    dpew(this, '__CACHE', false, true);
    dpew(this, 'opts', false, true);
  }
  static fromTransaction(txBuf) {
    const tx = transaction_1.Transaction.fromBuffer(txBuf);
    checkTxEmpty(tx);
    const psbt = new this();
    psbt.__CACHE.__TX = tx;
    checkTxForDupeIns(tx, psbt.__CACHE);
    let inputCount = tx.ins.length;
    let outputCount = tx.outs.length;
    while (inputCount > 0) {
      psbt.inputs.push({
        keyVals: [],
      });
      inputCount--;
    }
    while (outputCount > 0) {
      psbt.outputs.push({
        keyVals: [],
      });
      outputCount--;
    }
    return psbt;
  }
  static fromBuffer(buffer) {
    let tx;
    const txCountGetter = txBuf => {
      tx = transaction_1.Transaction.fromBuffer(txBuf);
      checkTxEmpty(tx);
      return {
        inputCount: tx.ins.length,
        outputCount: tx.outs.length,
      };
    };
    const psbt = super.fromBuffer(buffer, txCountGetter);
    psbt.__CACHE.__TX = tx;
    checkTxForDupeIns(tx, psbt.__CACHE);
    return psbt;
  }
  get inputCount() {
    return this.inputs.length;
  }
  setMaximumFeeRate(satoshiPerByte) {
    check32Bit(satoshiPerByte); // 42.9 BTC per byte IS excessive... so throw
    this.opts.maximumFeeRate = satoshiPerByte;
  }
  setVersion(version) {
    check32Bit(version);
    checkInputsForPartialSig(this.inputs, 'setVersion');
    const c = this.__CACHE;
    c.__TX.version = version;
    c.__TX_BUF_CACHE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  setLocktime(locktime) {
    check32Bit(locktime);
    checkInputsForPartialSig(this.inputs, 'setLocktime');
    const c = this.__CACHE;
    c.__TX.locktime = locktime;
    c.__TX_BUF_CACHE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  setSequence(inputIndex, sequence) {
    check32Bit(sequence);
    checkInputsForPartialSig(this.inputs, 'setSequence');
    const c = this.__CACHE;
    if (c.__TX.ins.length <= inputIndex) {
      throw new Error('Input index too high');
    }
    c.__TX.ins[inputIndex].sequence = sequence;
    c.__TX_BUF_CACHE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  addInput(inputData) {
    checkInputsForPartialSig(this.inputs, 'addInput');
    const inputAdder = getInputAdder(this.__CACHE);
    super.addInput(inputData, inputAdder);
    this.__CACHE.__FEE_RATE = undefined;
    this.__CACHE.__EXTRACTED_TX = undefined;
    return this;
  }
  addOutput(outputData) {
    checkInputsForPartialSig(this.inputs, 'addOutput');
    const { address } = outputData;
    if (typeof address === 'string') {
      const { network } = this.opts;
      const script = address_1.toOutputScript(address, network);
      outputData = Object.assign(outputData, { script });
    }
    const self = this;
    const outputAdder = (_outputData, txBuf) => {
      if (
        !txBuf ||
        _outputData.script === undefined ||
        _outputData.value === undefined ||
        !Buffer.isBuffer(_outputData.script) ||
        typeof _outputData.value !== 'number'
      ) {
        throw new Error('Error adding output.');
      }
      self.__CACHE.__TX.outs.push({
        script: _outputData.script,
        value: _outputData.value,
      });
      return self.__CACHE.__TX.toBuffer();
    };
    super.addOutput(outputData, true, outputAdder);
    this.__CACHE.__FEE_RATE = undefined;
    this.__CACHE.__EXTRACTED_TX = undefined;
    return this;
  }
  addNonWitnessUtxoToInput(inputIndex, nonWitnessUtxo) {
    super.addNonWitnessUtxoToInput(inputIndex, nonWitnessUtxo);
    const input = this.inputs[inputIndex];
    addNonWitnessTxCache(this.__CACHE, input, inputIndex);
    return this;
  }
  extractTransaction(disableFeeCheck) {
    if (!this.inputs.every(isFinalized)) throw new Error('Not finalized');
    if (!disableFeeCheck) {
      const feeRate = this.__CACHE.__FEE_RATE || this.getFeeRate();
      const vsize = this.__CACHE.__EXTRACTED_TX.virtualSize();
      const satoshis = feeRate * vsize;
      if (feeRate >= this.opts.maximumFeeRate) {
        throw new Error(
          `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in ` +
            `fees, which is ${feeRate} satoshi per byte for a transaction ` +
            `with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per ` +
            `byte). Use setMaximumFeeRate method to raise your threshold, or ` +
            `pass true to the first arg of extractTransaction.`,
        );
      }
    }
    if (this.__CACHE.__EXTRACTED_TX) return this.__CACHE.__EXTRACTED_TX;
    const tx = this.__CACHE.__TX.clone();
    this.inputs.forEach((input, idx) => {
      if (input.finalScriptSig) tx.ins[idx].script = input.finalScriptSig;
      if (input.finalScriptWitness) {
        tx.ins[idx].witness = scriptWitnessToWitnessStack(
          input.finalScriptWitness,
        );
      }
    });
    this.__CACHE.__EXTRACTED_TX = tx;
    return tx;
  }
  getFeeRate() {
    if (!this.inputs.every(isFinalized))
      throw new Error('PSBT must be finalized to calculate fee rate');
    if (this.__CACHE.__FEE_RATE) return this.__CACHE.__FEE_RATE;
    let tx;
    let inputAmount = 0;
    let mustFinalize = true;
    if (this.__CACHE.__EXTRACTED_TX) {
      tx = this.__CACHE.__EXTRACTED_TX;
      mustFinalize = false;
    } else {
      tx = this.__CACHE.__TX.clone();
    }
    this.inputs.forEach((input, idx) => {
      if (mustFinalize && input.finalScriptSig)
        tx.ins[idx].script = input.finalScriptSig;
      if (mustFinalize && input.finalScriptWitness) {
        tx.ins[idx].witness = scriptWitnessToWitnessStack(
          input.finalScriptWitness,
        );
      }
      if (input.witnessUtxo) {
        inputAmount += input.witnessUtxo.value;
      } else if (input.nonWitnessUtxo) {
        const nwTx = nonWitnessUtxoTxFromCache(this.__CACHE, input, idx);
        const vout = this.__CACHE.__TX.ins[idx].index;
        const out = nwTx.outs[vout];
        inputAmount += out.value;
      }
    });
    this.__CACHE.__EXTRACTED_TX = tx;
    const outputAmount = tx.outs.reduce((total, o) => total + o.value, 0);
    const fee = inputAmount - outputAmount;
    const bytes = tx.virtualSize();
    this.__CACHE.__FEE_RATE = Math.floor(fee / bytes);
    return this.__CACHE.__FEE_RATE;
  }
  finalizeAllInputs() {
    const inputResults = range(this.inputs.length).map(idx =>
      this.finalizeInput(idx),
    );
    const result = inputResults.every(val => val === true);
    return {
      result,
      inputResults,
    };
  }
  finalizeInput(inputIndex) {
    const input = utils_1.checkForInput(this.inputs, inputIndex);
    const { script, isP2SH, isP2WSH, isSegwit } = getScriptFromInput(
      inputIndex,
      input,
      this.__CACHE.__TX,
      this.__CACHE,
    );
    if (!script) return false;
    const scriptType = classifyScript(script);
    if (!canFinalize(input, script, scriptType)) return false;
    const { finalScriptSig, finalScriptWitness } = getFinalScripts(
      script,
      scriptType,
      input.partialSig,
      isSegwit,
      isP2SH,
      isP2WSH,
    );
    if (finalScriptSig)
      this.addFinalScriptSigToInput(inputIndex, finalScriptSig);
    if (finalScriptWitness)
      this.addFinalScriptWitnessToInput(inputIndex, finalScriptWitness);
    if (!finalScriptSig && !finalScriptWitness) return false;
    this.clearFinalizedInput(inputIndex);
    return true;
  }
  validateSignatures(inputIndex, pubkey) {
    const input = this.inputs[inputIndex];
    const partialSig = (input || {}).partialSig;
    if (!input || !partialSig || partialSig.length < 1)
      throw new Error('No signatures to validate');
    const mySigs = pubkey
      ? partialSig.filter(sig => sig.pubkey.equals(pubkey))
      : partialSig;
    if (mySigs.length < 1) throw new Error('No signatures for this pubkey');
    const results = [];
    let hashCache;
    let scriptCache;
    let sighashCache;
    for (const pSig of mySigs) {
      const sig = bscript.signature.decode(pSig.signature);
      const { hash, script } =
        sighashCache !== sig.hashType
          ? getHashForSig(
              inputIndex,
              Object.assign({}, input, { sighashType: sig.hashType }),
              this.__CACHE.__TX,
              this.__CACHE,
            )
          : { hash: hashCache, script: scriptCache };
      sighashCache = sig.hashType;
      hashCache = hash;
      scriptCache = script;
      checkScriptForPubkey(pSig.pubkey, script, 'verify');
      const keypair = ecpair_1.fromPublicKey(pSig.pubkey);
      results.push(keypair.verify(hash, sig.signature));
    }
    return results.every(res => res === true);
  }
  sign(keyPair) {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    // TODO: Add a pubkey/pubkeyhash cache to each input
    // as input information is added, then eventually
    // optimize this method.
    const results = [];
    for (const [i] of this.inputs.entries()) {
      try {
        this.signInput(i, keyPair);
        results.push(true);
      } catch (err) {
        results.push(false);
      }
    }
    if (results.every(v => v === false)) {
      throw new Error('No inputs were signed');
    }
    return this;
  }
  signAsync(keyPair) {
    return new Promise((resolve, reject) => {
      if (!keyPair || !keyPair.publicKey)
        return reject(new Error('Need Signer to sign input'));
      // TODO: Add a pubkey/pubkeyhash cache to each input
      // as input information is added, then eventually
      // optimize this method.
      const results = [];
      const promises = [];
      for (const [i] of this.inputs.entries()) {
        promises.push(
          this.signInputAsync(i, keyPair).then(
            () => {
              results.push(true);
            },
            () => {
              results.push(false);
            },
          ),
        );
      }
      return Promise.all(promises).then(() => {
        if (results.every(v => v === false)) {
          return reject(new Error('No inputs were signed'));
        }
        resolve();
      });
    });
  }
  signInput(inputIndex, keyPair) {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const { hash, sighashType } = getHashAndSighashType(
      this.inputs,
      inputIndex,
      keyPair.publicKey,
      this.__CACHE.__TX,
      this.__CACHE,
    );
    const partialSig = {
      pubkey: keyPair.publicKey,
      signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
    };
    return this.addPartialSigToInput(inputIndex, partialSig);
  }
  signInputAsync(inputIndex, keyPair) {
    return new Promise((resolve, reject) => {
      if (!keyPair || !keyPair.publicKey)
        return reject(new Error('Need Signer to sign input'));
      const { hash, sighashType } = getHashAndSighashType(
        this.inputs,
        inputIndex,
        keyPair.publicKey,
        this.__CACHE.__TX,
        this.__CACHE,
      );
      Promise.resolve(keyPair.sign(hash)).then(signature => {
        const partialSig = {
          pubkey: keyPair.publicKey,
          signature: bscript.signature.encode(signature, sighashType),
        };
        this.addPartialSigToInput(inputIndex, partialSig);
        resolve();
      });
    });
  }
}
exports.Psbt = Psbt;
function addNonWitnessTxCache(cache, input, inputIndex) {
  cache.__NON_WITNESS_UTXO_BUF_CACHE[inputIndex] = input.nonWitnessUtxo;
  const tx = transaction_1.Transaction.fromBuffer(input.nonWitnessUtxo);
  cache.__NON_WITNESS_UTXO_TX_CACHE[inputIndex] = tx;
  const self = cache;
  const selfIndex = inputIndex;
  delete input.nonWitnessUtxo;
  Object.defineProperty(input, 'nonWitnessUtxo', {
    enumerable: true,
    get() {
      const buf = self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex];
      const txCache = self.__NON_WITNESS_UTXO_TX_CACHE[selfIndex];
      if (buf !== undefined) {
        return buf;
      } else {
        const newBuf = txCache.toBuffer();
        self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = newBuf;
        return newBuf;
      }
    },
    set(data) {
      self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = data;
    },
  });
}
function checkTxForDupeIns(tx, cache) {
  tx.ins.forEach(input => {
    checkTxInputCache(cache, input);
  });
}
function checkTxInputCache(cache, input) {
  const key =
    bufferutils_1.reverseBuffer(Buffer.from(input.hash)).toString('hex') +
    ':' +
    input.index;
  if (cache.__TX_IN_CACHE[key]) throw new Error('Duplicate input detected.');
  cache.__TX_IN_CACHE[key] = 1;
}
function isFinalized(input) {
  return !!input.finalScriptSig || !!input.finalScriptWitness;
}
function getHashAndSighashType(inputs, inputIndex, pubkey, unsignedTx, cache) {
  const input = utils_1.checkForInput(inputs, inputIndex);
  const { hash, sighashType, script } = getHashForSig(
    inputIndex,
    input,
    unsignedTx,
    cache,
  );
  checkScriptForPubkey(pubkey, script, 'sign');
  return {
    hash,
    sighashType,
  };
}
function getFinalScripts(
  script,
  scriptType,
  partialSig,
  isSegwit,
  isP2SH,
  isP2WSH,
) {
  let finalScriptSig;
  let finalScriptWitness;
  // Wow, the payments API is very handy
  const payment = getPayment(script, scriptType, partialSig);
  const p2wsh = !isP2WSH ? null : payments.p2wsh({ redeem: payment });
  const p2sh = !isP2SH ? null : payments.p2sh({ redeem: p2wsh || payment });
  if (isSegwit) {
    if (p2wsh) {
      finalScriptWitness = witnessStackToScriptWitness(p2wsh.witness);
    } else {
      finalScriptWitness = witnessStackToScriptWitness(payment.witness);
    }
    if (p2sh) {
      finalScriptSig = p2sh.input;
    }
  } else {
    if (p2sh) {
      finalScriptSig = p2sh.input;
    } else {
      finalScriptSig = payment.input;
    }
  }
  return {
    finalScriptSig,
    finalScriptWitness,
  };
}
function getSortedSigs(script, partialSig) {
  const p2ms = payments.p2ms({ output: script });
  // for each pubkey in order of p2ms script
  return p2ms.pubkeys
    .map(pk => {
      // filter partialSig array by pubkey being equal
      return (
        partialSig.filter(ps => {
          return ps.pubkey.equals(pk);
        })[0] || {}
      ).signature;
      // Any pubkey without a match will return undefined
      // this last filter removes all the undefined items in the array.
    })
    .filter(v => !!v);
}
function getPayment(script, scriptType, partialSig) {
  let payment;
  switch (scriptType) {
    case 'multisig':
      const sigs = getSortedSigs(script, partialSig);
      payment = payments.p2ms({
        output: script,
        signatures: sigs,
      });
      break;
    case 'pubkey':
      payment = payments.p2pk({
        output: script,
        signature: partialSig[0].signature,
      });
      break;
    case 'pubkeyhash':
      payment = payments.p2pkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      });
      break;
    case 'witnesspubkeyhash':
      payment = payments.p2wpkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      });
      break;
  }
  return payment;
}
function canFinalize(input, script, scriptType) {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
    case 'witnesspubkeyhash':
      return hasSigs(1, input.partialSig);
    case 'multisig':
      const p2ms = payments.p2ms({ output: script });
      return hasSigs(p2ms.m, input.partialSig);
    default:
      return false;
  }
}
function checkScriptForPubkey(pubkey, script, action) {
  const pubkeyHash = crypto_1.hash160(pubkey);
  const decompiled = bscript.decompile(script);
  if (decompiled === null) throw new Error('Unknown script error');
  const hasKey = decompiled.some(element => {
    if (typeof element === 'number') return false;
    return element.equals(pubkey) || element.equals(pubkeyHash);
  });
  if (!hasKey) {
    throw new Error(
      `Can not ${action} for this input with the key ${pubkey.toString('hex')}`,
    );
  }
}
function getHashForSig(inputIndex, input, unsignedTx, cache) {
  const sighashType =
    input.sighashType || transaction_1.Transaction.SIGHASH_ALL;
  let hash;
  let script;
  if (input.nonWitnessUtxo) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
      cache,
      input,
      inputIndex,
    );
    const prevoutHash = unsignedTx.ins[inputIndex].hash;
    const utxoHash = nonWitnessUtxoTx.getHash();
    // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
    if (!prevoutHash.equals(utxoHash)) {
      throw new Error(
        `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`,
      );
    }
    const prevoutIndex = unsignedTx.ins[inputIndex].index;
    const prevout = nonWitnessUtxoTx.outs[prevoutIndex];
    if (input.redeemScript) {
      // If a redeemScript is provided, the scriptPubKey must be for that redeemScript
      checkRedeemScript(inputIndex, prevout.script, input.redeemScript);
      script = input.redeemScript;
      hash = unsignedTx.hashForSignature(
        inputIndex,
        input.redeemScript,
        sighashType,
      );
    } else {
      script = prevout.script;
      hash = unsignedTx.hashForSignature(
        inputIndex,
        prevout.script,
        sighashType,
      );
    }
  } else if (input.witnessUtxo) {
    let _script; // so we don't shadow the `let script` above
    if (input.redeemScript) {
      // If a redeemScript is provided, the scriptPubKey must be for that redeemScript
      checkRedeemScript(
        inputIndex,
        input.witnessUtxo.script,
        input.redeemScript,
      );
      _script = input.redeemScript;
    } else {
      _script = input.witnessUtxo.script;
    }
    if (isP2WPKH(_script)) {
      // P2WPKH uses the P2PKH template for prevoutScript when signing
      const signingScript = payments.p2pkh({ hash: _script.slice(2) }).output;
      hash = unsignedTx.hashForWitnessV0(
        inputIndex,
        signingScript,
        input.witnessUtxo.value,
        sighashType,
      );
      script = _script;
    } else {
      if (!input.witnessScript)
        throw new Error('Segwit input needs witnessScript if not P2WPKH');
      checkWitnessScript(inputIndex, _script, input.witnessScript);
      hash = unsignedTx.hashForWitnessV0(
        inputIndex,
        input.witnessScript,
        input.witnessUtxo.value,
        sighashType,
      );
      // want to make sure the script we return is the actual meaningful script
      script = input.witnessScript;
    }
  } else {
    throw new Error('Need a Utxo input item for signing');
  }
  return {
    script,
    sighashType,
    hash,
  };
}
function scriptCheckerFactory(payment, paymentScriptName) {
  return (inputIndex, scriptPubKey, redeemScript) => {
    const redeemScriptOutput = payment({
      redeem: { output: redeemScript },
    }).output;
    if (!scriptPubKey.equals(redeemScriptOutput)) {
      throw new Error(
        `${paymentScriptName} for input #${inputIndex} doesn't match the scriptPubKey in the prevout`,
      );
    }
  };
}
const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script');
const checkWitnessScript = scriptCheckerFactory(
  payments.p2wsh,
  'Witness script',
);
function isPaymentFactory(payment) {
  return script => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}
const isP2WPKH = isPaymentFactory(payments.p2wpkh);
const isP2PKH = isPaymentFactory(payments.p2pkh);
const isP2MS = isPaymentFactory(payments.p2ms);
const isP2PK = isPaymentFactory(payments.p2pk);
function classifyScript(script) {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}
function getScriptFromInput(inputIndex, input, unsignedTx, cache) {
  const res = {
    script: null,
    isSegwit: false,
    isP2SH: false,
    isP2WSH: false,
  };
  if (input.nonWitnessUtxo) {
    if (input.redeemScript) {
      res.isP2SH = true;
      res.script = input.redeemScript;
    } else {
      const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
        cache,
        input,
        inputIndex,
      );
      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      res.script = nonWitnessUtxoTx.outs[prevoutIndex].script;
    }
  } else if (input.witnessUtxo) {
    res.isSegwit = true;
    res.isP2SH = !!input.redeemScript;
    res.isP2WSH = !!input.witnessScript;
    if (input.witnessScript) {
      res.script = input.witnessScript;
    } else if (input.redeemScript) {
      res.script = payments.p2wpkh({
        hash: input.redeemScript.slice(2),
      }).output;
    } else {
      res.script = payments.p2wpkh({
        hash: input.witnessUtxo.script.slice(2),
      }).output;
    }
  }
  return res;
}
function hasSigs(neededSigs, partialSig) {
  if (!partialSig) return false;
  if (partialSig.length > neededSigs) throw new Error('Too many signatures');
  return partialSig.length === neededSigs;
}
function witnessStackToScriptWitness(witness) {
  let buffer = Buffer.allocUnsafe(0);
  function writeSlice(slice) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)]);
  }
  function writeVarInt(i) {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);
    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length);
    writeSlice(slice);
  }
  function writeVector(vector) {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }
  writeVector(witness);
  return buffer;
}
function scriptWitnessToWitnessStack(buffer) {
  let offset = 0;
  function readSlice(n) {
    offset += n;
    return buffer.slice(offset - n, offset);
  }
  function readVarInt() {
    const vi = varuint.decode(buffer, offset);
    offset += varuint.decode.bytes;
    return vi;
  }
  function readVarSlice() {
    return readSlice(readVarInt());
  }
  function readVector() {
    const count = readVarInt();
    const vector = [];
    for (let i = 0; i < count; i++) vector.push(readVarSlice());
    return vector;
  }
  return readVector();
}
function range(n) {
  return [...Array(n).keys()];
}
function checkTxEmpty(tx) {
  const isEmpty = tx.ins.every(
    input =>
      input.script &&
      input.script.length === 0 &&
      input.witness &&
      input.witness.length === 0,
  );
  if (!isEmpty) {
    throw new Error('Format Error: Transaction ScriptSigs are not empty');
  }
}
function checkInputsForPartialSig(inputs, action) {
  inputs.forEach(input => {
    let throws = false;
    if ((input.partialSig || []).length === 0) return;
    input.partialSig.forEach(pSig => {
      const { hashType } = bscript.signature.decode(pSig.signature);
      const whitelist = [];
      const isAnyoneCanPay =
        hashType & transaction_1.Transaction.SIGHASH_ANYONECANPAY;
      if (isAnyoneCanPay) whitelist.push('addInput');
      const hashMod = hashType & 0x1f;
      switch (hashMod) {
        case transaction_1.Transaction.SIGHASH_ALL:
          break;
        case transaction_1.Transaction.SIGHASH_SINGLE:
        case transaction_1.Transaction.SIGHASH_NONE:
          whitelist.push('addOutput');
          whitelist.push('setSequence');
          break;
      }
      if (whitelist.indexOf(action) === -1) {
        throws = true;
      }
    });
    if (throws) {
      throw new Error('Can not modify transaction, signatures exist.');
    }
  });
}
function nonWitnessUtxoTxFromCache(cache, input, inputIndex) {
  if (!cache.__NON_WITNESS_UTXO_TX_CACHE[inputIndex]) {
    addNonWitnessTxCache(cache, input, inputIndex);
  }
  return cache.__NON_WITNESS_UTXO_TX_CACHE[inputIndex];
}
function getInputAdder(cache) {
  const selfCache = cache;
  return (_inputData, txBuf) => {
    if (
      !txBuf ||
      _inputData.hash === undefined ||
      _inputData.index === undefined ||
      (!Buffer.isBuffer(_inputData.hash) &&
        typeof _inputData.hash !== 'string') ||
      typeof _inputData.index !== 'number'
    ) {
      throw new Error('Error adding input.');
    }
    const prevHash = Buffer.isBuffer(_inputData.hash)
      ? _inputData.hash
      : bufferutils_1.reverseBuffer(Buffer.from(_inputData.hash, 'hex'));
    // Check if input already exists in cache.
    const input = { hash: prevHash, index: _inputData.index };
    checkTxInputCache(selfCache, input);
    selfCache.__TX.ins.push(
      Object.assign({}, input, {
        script: Buffer.alloc(0),
        sequence:
          _inputData.sequence || transaction_1.Transaction.DEFAULT_SEQUENCE,
        witness: [],
      }),
    );
    return selfCache.__TX.toBuffer();
  };
}
function check32Bit(num) {
  if (
    typeof num !== 'number' ||
    num !== Math.floor(num) ||
    num > 0xffffffff ||
    num < 0
  ) {
    throw new Error('Invalid 32 bit integer');
  }
}
