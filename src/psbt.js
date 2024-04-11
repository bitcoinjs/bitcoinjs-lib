'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.Psbt = void 0;
const bip174_1 = require('bip174');
const utils_1 = require('bip174/src/lib/utils');
const address_1 = require('./address');
const bufferutils_1 = require('./bufferutils');
const networks_1 = require('./networks');
const payments = require('./payments');
const bscript = require('./script');
const transaction_1 = require('./transaction');
const bip371_1 = require('./psbt/bip371');
const psbtutils_1 = require('./psbt/psbtutils');
const transaction_2 = require('./psbt/transaction');
const cache_1 = require('./psbt/global/cache');
const global_1 = require('./psbt/global');
const input_1 = require('./psbt/input');
const sign_1 = require('./psbt/global/sign');
const script_1 = require('./psbt/input/script');
const output_1 = require('./psbt/output');
const hash_1 = require('./psbt/global/hash');
/**
 * These are the default arguments for a Psbt instance.
 */
const DEFAULT_OPTS = {
  /**
   * A bitcoinjs Network object. This is only used if you pass an `address`
   * parameter to addOutput. Otherwise it is not needed and can be left default.
   */
  network: networks_1.bitcoin,
  /**
   * When extractTransaction is called, the fee rate is checked.
   * THIS IS NOT TO BE RELIED ON.
   * It is only here as a last ditch effort to prevent sending a 500 BTC fee etc.
   */
  maximumFeeRate: 5000, // satoshi per byte
};
/**
 * Psbt class can parse and generate a PSBT binary based off of the BIP174.
 * There are 6 roles that this class fulfills. (Explained in BIP174)
 *
 * Creator: This can be done with `new Psbt()`
 *
 * Updater: This can be done with `psbt.addInput(input)`, `psbt.addInputs(inputs)`,
 *   `psbt.addOutput(output)`, `psbt.addOutputs(outputs)` when you are looking to
 *   add new inputs and outputs to the PSBT, and `psbt.updateGlobal(itemObject)`,
 *   `psbt.updateInput(itemObject)`, `psbt.updateOutput(itemObject)`
 *   addInput requires hash: Buffer | string; and index: number; as attributes
 *   and can also include any attributes that are used in updateInput method.
 *   addOutput requires script: Buffer; and value: number; and likewise can include
 *   data for updateOutput.
 *   For a list of what attributes should be what types. Check the bip174 library.
 *   Also, check the integration tests for some examples of usage.
 *
 * Signer: There are a few methods. signAllInputs and signAllInputsAsync, which will search all input
 *   information for your pubkey or pubkeyhash, and only sign inputs where it finds
 *   your info. Or you can explicitly sign a specific input with signInput and
 *   signInputAsync. For the async methods you can create a SignerAsync object
 *   and use something like a hardware wallet to sign with. (You must implement this)
 *
 * Combiner: psbts can be combined easily with `psbt.combine(psbt2, psbt3, psbt4 ...)`
 *   the psbt calling combine will always have precedence when a conflict occurs.
 *   Combine checks if the internal bitcoin transaction is the same, so be sure that
 *   all sequences, version, locktime, etc. are the same before combining.
 *
 * Input Finalizer: This role is fairly important. Not only does it need to construct
 *   the input scriptSigs and witnesses, but it SHOULD verify the signatures etc.
 *   Before running `psbt.finalizeAllInputs()` please run `psbt.validateSignaturesOfAllInputs()`
 *   Running any finalize method will delete any data in the input(s) that are no longer
 *   needed due to the finalized scripts containing the information.
 *
 * Transaction Extractor: This role will perform some checks before returning a
 *   Transaction object. Such as fee rate not being larger than maximumFeeRate etc.
 */
class Psbt {
  static fromBase64(data, opts = {}) {
    const buffer = Buffer.from(data, 'base64');
    return this.fromBuffer(buffer, opts);
  }
  static fromHex(data, opts = {}) {
    const buffer = Buffer.from(data, 'hex');
    return this.fromBuffer(buffer, opts);
  }
  static fromBuffer(buffer, opts = {}) {
    const psbtBase = bip174_1.Psbt.fromBuffer(
      buffer,
      transaction_2.transactionFromBuffer,
    );
    const psbt = new Psbt(opts, psbtBase);
    (0, input_1.checkTxForDupeIns)(psbt.__CACHE.__TX, psbt.__CACHE);
    return psbt;
  }
  constructor(
    opts = {},
    data = new bip174_1.Psbt(new transaction_2.PsbtTransaction()),
  ) {
    this.data = data;
    // set defaults
    this.opts = Object.assign({}, DEFAULT_OPTS, opts);
    this.__CACHE = {
      __NON_WITNESS_UTXO_TX_CACHE: [],
      __NON_WITNESS_UTXO_BUF_CACHE: [],
      __TX_IN_CACHE: {},
      __TX: this.data.globalMap.unsignedTx.tx,
      // Psbt's predecessor (TransactionBuilder - now removed) behavior
      // was to not confirm input values  before signing.
      // Even though we highly encourage people to get
      // the full parent transaction to verify values, the ability to
      // sign non-segwit inputs without the full transaction was often
      // requested. So the only way to activate is to use @ts-ignore.
      // We will disable exporting the Psbt when unsafe sign is active.
      // because it is not BIP174 compliant.
      __UNSAFE_SIGN_NONSEGWIT: false,
    };
    if (this.data.inputs.length === 0) this.setVersion(2);
    // Make data hidden when enumerating
    const dpew = (obj, attr, enumerable, writable) =>
      Object.defineProperty(obj, attr, {
        enumerable,
        writable,
      });
    dpew(this, '__CACHE', false, true);
    dpew(this, 'opts', false, true);
  }
  get inputCount() {
    return this.data.inputs.length;
  }
  get version() {
    return this.__CACHE.__TX.version;
  }
  set version(version) {
    this.setVersion(version);
  }
  get locktime() {
    return this.__CACHE.__TX.locktime;
  }
  set locktime(locktime) {
    this.setLocktime(locktime);
  }
  get txInputs() {
    return this.__CACHE.__TX.ins.map(input => ({
      hash: (0, bufferutils_1.cloneBuffer)(input.hash),
      index: input.index,
      sequence: input.sequence,
    }));
  }
  get txOutputs() {
    return this.__CACHE.__TX.outs.map(output => {
      let address;
      try {
        address = (0, address_1.fromOutputScript)(
          output.script,
          this.opts.network,
        );
      } catch (_) {}
      return {
        script: (0, bufferutils_1.cloneBuffer)(output.script),
        value: output.value,
        address,
      };
    });
  }
  combine(...those) {
    this.data.combine(...those.map(o => o.data));
    return this;
  }
  clone() {
    // TODO: more efficient cloning
    const res = Psbt.fromBuffer(this.data.toBuffer());
    res.opts = JSON.parse(JSON.stringify(this.opts));
    return res;
  }
  setMaximumFeeRate(satoshiPerByte) {
    check32Bit(satoshiPerByte); // 42.9 BTC per byte IS excessive... so throw
    this.opts.maximumFeeRate = satoshiPerByte;
  }
  setVersion(version) {
    check32Bit(version);
    (0, input_1.checkInputsForPartialSig)(this.data.inputs, 'setVersion');
    const c = this.__CACHE;
    c.__TX.version = version;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  setLocktime(locktime) {
    check32Bit(locktime);
    (0, input_1.checkInputsForPartialSig)(this.data.inputs, 'setLocktime');
    const c = this.__CACHE;
    c.__TX.locktime = locktime;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  setInputSequence(inputIndex, sequence) {
    check32Bit(sequence);
    (0, input_1.checkInputsForPartialSig)(this.data.inputs, 'setInputSequence');
    const c = this.__CACHE;
    if (c.__TX.ins.length <= inputIndex) {
      throw new Error('Input index too high');
    }
    c.__TX.ins[inputIndex].sequence = sequence;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  addInputs(inputDatas) {
    inputDatas.forEach(inputData => this.addInput(inputData));
    return this;
  }
  addInput(inputData) {
    if (
      arguments.length > 1 ||
      !inputData ||
      inputData.hash === undefined ||
      inputData.index === undefined
    ) {
      throw new Error(
        `Invalid arguments for Psbt.addInput. ` +
          `Requires single object with at least [hash] and [index]`,
      );
    }
    (0, bip371_1.checkTaprootInputFields)(inputData, inputData, 'addInput');
    (0, input_1.checkInputsForPartialSig)(this.data.inputs, 'addInput');
    if (inputData.witnessScript)
      (0, script_1.checkInvalidP2WSH)(inputData.witnessScript);
    const c = this.__CACHE;
    this.data.addInput(inputData);
    const txIn = c.__TX.ins[c.__TX.ins.length - 1];
    (0, cache_1.checkTxInputCache)(c, txIn);
    const inputIndex = this.data.inputs.length - 1;
    const input = this.data.inputs[inputIndex];
    if (input.nonWitnessUtxo) {
      (0, cache_1.addNonWitnessTxCache)(this.__CACHE, input, inputIndex);
    }
    c.__FEE = undefined;
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  addOutputs(outputDatas) {
    outputDatas.forEach(outputData => this.addOutput(outputData));
    return this;
  }
  addOutput(outputData) {
    if (
      arguments.length > 1 ||
      !outputData ||
      outputData.value === undefined ||
      (outputData.address === undefined && outputData.script === undefined)
    ) {
      throw new Error(
        `Invalid arguments for Psbt.addOutput. ` +
          `Requires single object with at least [script or address] and [value]`,
      );
    }
    (0, input_1.checkInputsForPartialSig)(this.data.inputs, 'addOutput');
    const { address } = outputData;
    if (typeof address === 'string') {
      const { network } = this.opts;
      const script = (0, address_1.toOutputScript)(address, network);
      outputData = Object.assign(outputData, { script });
    }
    (0, bip371_1.checkTaprootOutputFields)(outputData, outputData, 'addOutput');
    const c = this.__CACHE;
    this.data.addOutput(outputData);
    c.__FEE = undefined;
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }
  extractTransaction(disableFeeCheck) {
    if (!this.data.inputs.every(global_1.isFinalized))
      throw new Error('Not finalized');
    const c = this.__CACHE;
    if (!disableFeeCheck) {
      checkFees(this, c, this.opts);
    }
    if (c.__EXTRACTED_TX) return c.__EXTRACTED_TX;
    const tx = c.__TX.clone();
    (0, input_1.inputFinalizeGetAmts)(this.data.inputs, tx, c, true);
    return tx;
  }
  getFeeRate() {
    return (0, cache_1.getTxCacheValue)(
      '__FEE_RATE',
      'fee rate',
      this.data.inputs,
      this.__CACHE,
    );
  }
  getFee() {
    return (0, cache_1.getTxCacheValue)(
      '__FEE',
      'fee',
      this.data.inputs,
      this.__CACHE,
    );
  }
  finalizeAllInputs() {
    (0, utils_1.checkForInput)(this.data.inputs, 0); // making sure we have at least one
    range(this.data.inputs.length).forEach(idx => this.finalizeInput(idx));
    return this;
  }
  finalizeInput(inputIndex, finalScriptsFunc) {
    const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
    if ((0, bip371_1.isTaprootInput)(input))
      return this._finalizeTaprootInput(
        inputIndex,
        input,
        undefined,
        finalScriptsFunc,
      );
    return this._finalizeInput(inputIndex, input, finalScriptsFunc);
  }
  finalizeTaprootInput(
    inputIndex,
    tapLeafHashToFinalize,
    finalScriptsFunc = bip371_1.tapScriptFinalizer,
  ) {
    const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
    if ((0, bip371_1.isTaprootInput)(input))
      return this._finalizeTaprootInput(
        inputIndex,
        input,
        tapLeafHashToFinalize,
        finalScriptsFunc,
      );
    throw new Error(`Cannot finalize input #${inputIndex}. Not Taproot.`);
  }
  _finalizeInput(
    inputIndex,
    input,
    finalScriptsFunc = global_1.getFinalScripts,
  ) {
    const { script, isP2SH, isP2WSH, isSegwit } = (0,
    script_1.getScriptFromInput)(inputIndex, input, this.__CACHE);
    if (!script) throw new Error(`No script found for input #${inputIndex}`);
    (0, sign_1.checkPartialSigSighashes)(input);
    const { finalScriptSig, finalScriptWitness } = finalScriptsFunc(
      inputIndex,
      input,
      script,
      isSegwit,
      isP2SH,
      isP2WSH,
    );
    if (finalScriptSig) this.data.updateInput(inputIndex, { finalScriptSig });
    if (finalScriptWitness)
      this.data.updateInput(inputIndex, { finalScriptWitness });
    if (!finalScriptSig && !finalScriptWitness)
      throw new Error(`Unknown error finalizing input #${inputIndex}`);
    this.data.clearFinalizedInput(inputIndex);
    return this;
  }
  _finalizeTaprootInput(
    inputIndex,
    input,
    tapLeafHashToFinalize,
    finalScriptsFunc = bip371_1.tapScriptFinalizer,
  ) {
    if (!input.witnessUtxo)
      throw new Error(
        `Cannot finalize input #${inputIndex}. Missing withness utxo.`,
      );
    // Check key spend first. Increased privacy and reduced block space.
    if (input.tapKeySig) {
      const payment = payments.p2tr({
        output: input.witnessUtxo.script,
        signature: input.tapKeySig,
      });
      const finalScriptWitness = (0, psbtutils_1.witnessStackToScriptWitness)(
        payment.witness,
      );
      this.data.updateInput(inputIndex, { finalScriptWitness });
    } else {
      const { finalScriptWitness } = finalScriptsFunc(
        inputIndex,
        input,
        tapLeafHashToFinalize,
      );
      this.data.updateInput(inputIndex, { finalScriptWitness });
    }
    this.data.clearFinalizedInput(inputIndex);
    return this;
  }
  getInputType(inputIndex) {
    const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
    const script = (0, script_1.getScriptFromUtxo)(
      inputIndex,
      input,
      this.__CACHE,
    );
    const result = (0, script_1.getMeaningfulScript)(
      script,
      inputIndex,
      'input',
      input.redeemScript || redeemFromFinalScriptSig(input.finalScriptSig),
      input.witnessScript ||
        redeemFromFinalWitnessScript(input.finalScriptWitness),
    );
    const type = result.type === 'raw' ? '' : result.type + '-';
    const mainType = (0, script_1.classifyScript)(result.meaningfulScript);
    return type + mainType;
  }
  inputHasPubkey(inputIndex, pubkey) {
    const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
    return (0, input_1.pubkeyInInput)(pubkey, input, inputIndex, this.__CACHE);
  }
  inputHasHDKey(inputIndex, root) {
    const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
    const derivationIsMine = (0, global_1.bip32DerivationIsMine)(root);
    return (
      !!input.bip32Derivation && input.bip32Derivation.some(derivationIsMine)
    );
  }
  outputHasPubkey(outputIndex, pubkey) {
    const output = (0, utils_1.checkForOutput)(this.data.outputs, outputIndex);
    return (0, output_1.pubkeyInOutput)(
      pubkey,
      output,
      outputIndex,
      this.__CACHE,
    );
  }
  outputHasHDKey(outputIndex, root) {
    const output = (0, utils_1.checkForOutput)(this.data.outputs, outputIndex);
    const derivationIsMine = (0, global_1.bip32DerivationIsMine)(root);
    return (
      !!output.bip32Derivation && output.bip32Derivation.some(derivationIsMine)
    );
  }
  validateSignaturesOfAllInputs(validator) {
    (0, utils_1.checkForInput)(this.data.inputs, 0); // making sure we have at least one
    const results = range(this.data.inputs.length).map(idx =>
      this.validateSignaturesOfInput(idx, validator),
    );
    return results.reduce((final, res) => res === true && final, true);
  }
  validateSignaturesOfInput(inputIndex, validator, pubkey) {
    const input = this.data.inputs[inputIndex];
    if ((0, bip371_1.isTaprootInput)(input))
      return this.validateSignaturesOfTaprootInput(
        inputIndex,
        validator,
        pubkey,
      );
    return this._validateSignaturesOfInput(inputIndex, validator, pubkey);
  }
  _validateSignaturesOfInput(inputIndex, validator, pubkey) {
    const input = this.data.inputs[inputIndex];
    const partialSig = (input || {}).partialSig;
    if (!input || !partialSig || partialSig.length < 1)
      throw new Error('No signatures to validate');
    if (typeof validator !== 'function')
      throw new Error('Need validator function to validate signatures');
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
          ? (0, hash_1.getHashForSig)(
              inputIndex,
              Object.assign({}, input, { sighashType: sig.hashType }),
              this.__CACHE,
              true,
            )
          : { hash: hashCache, script: scriptCache };
      sighashCache = sig.hashType;
      hashCache = hash;
      scriptCache = script;
      (0, script_1.checkScriptForPubkey)(pSig.pubkey, script, 'verify');
      results.push(validator(pSig.pubkey, hash, sig.signature));
    }
    return results.every(res => res === true);
  }
  validateSignaturesOfTaprootInput(inputIndex, validator, pubkey) {
    const input = this.data.inputs[inputIndex];
    const tapKeySig = (input || {}).tapKeySig;
    const tapScriptSig = (input || {}).tapScriptSig;
    if (!input && !tapKeySig && !(tapScriptSig && !tapScriptSig.length))
      throw new Error('No signatures to validate');
    if (typeof validator !== 'function')
      throw new Error('Need validator function to validate signatures');
    pubkey = pubkey && (0, bip371_1.toXOnly)(pubkey);
    const allHashses = pubkey
      ? (0, hash_1.getTaprootHashesForSig)(
          inputIndex,
          input,
          this.data.inputs,
          pubkey,
          this.__CACHE,
        )
      : (0, hash_1.getAllTaprootHashesForSig)(
          inputIndex,
          input,
          this.data.inputs,
          this.__CACHE,
        );
    if (!allHashses.length) throw new Error('No signatures for this pubkey');
    const tapKeyHash = allHashses.find(h => !h.leafHash);
    let validationResultCount = 0;
    if (tapKeySig && tapKeyHash) {
      const isValidTapkeySig = validator(
        tapKeyHash.pubkey,
        tapKeyHash.hash,
        trimTaprootSig(tapKeySig),
      );
      if (!isValidTapkeySig) return false;
      validationResultCount++;
    }
    if (tapScriptSig) {
      for (const tapSig of tapScriptSig) {
        const tapSigHash = allHashses.find(h => tapSig.pubkey.equals(h.pubkey));
        if (tapSigHash) {
          const isValidTapScriptSig = validator(
            tapSig.pubkey,
            tapSigHash.hash,
            trimTaprootSig(tapSig.signature),
          );
          if (!isValidTapScriptSig) return false;
          validationResultCount++;
        }
      }
    }
    return validationResultCount > 0;
  }
  signAllInputsHD(
    hdKeyPair,
    sighashTypes = [transaction_1.Transaction.SIGHASH_ALL],
  ) {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input');
    }
    const results = [];
    for (const i of range(this.data.inputs.length)) {
      try {
        this.signInputHD(i, hdKeyPair, sighashTypes);
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
  signAllInputsHDAsync(
    hdKeyPair,
    sighashTypes = [transaction_1.Transaction.SIGHASH_ALL],
  ) {
    return new Promise((resolve, reject) => {
      if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
        return reject(new Error('Need HDSigner to sign input'));
      }
      const results = [];
      const promises = [];
      for (const i of range(this.data.inputs.length)) {
        promises.push(
          this.signInputHDAsync(i, hdKeyPair, sighashTypes).then(
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
  signInputHD(
    inputIndex,
    hdKeyPair,
    sighashTypes = [transaction_1.Transaction.SIGHASH_ALL],
  ) {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input');
    }
    const signers = getSignersFromHD(inputIndex, this.data.inputs, hdKeyPair);
    signers.forEach(signer => this.signInput(inputIndex, signer, sighashTypes));
    return this;
  }
  signInputHDAsync(
    inputIndex,
    hdKeyPair,
    sighashTypes = [transaction_1.Transaction.SIGHASH_ALL],
  ) {
    return new Promise((resolve, reject) => {
      if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
        return reject(new Error('Need HDSigner to sign input'));
      }
      const signers = getSignersFromHD(inputIndex, this.data.inputs, hdKeyPair);
      const promises = signers.map(signer =>
        this.signInputAsync(inputIndex, signer, sighashTypes),
      );
      return Promise.all(promises)
        .then(() => {
          resolve();
        })
        .catch(reject);
    });
  }
  signAllInputs(keyPair, sighashTypes) {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    // TODO: Add a pubkey/pubkeyhash cache to each input
    // as input information is added, then eventually
    // optimize this method.
    const results = [];
    for (const i of range(this.data.inputs.length)) {
      try {
        this.signInput(i, keyPair, sighashTypes);
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
  signAllInputsAsync(keyPair, sighashTypes) {
    return new Promise((resolve, reject) => {
      if (!keyPair || !keyPair.publicKey)
        return reject(new Error('Need Signer to sign input'));
      // TODO: Add a pubkey/pubkeyhash cache to each input
      // as input information is added, then eventually
      // optimize this method.
      const results = [];
      const promises = [];
      for (const [i] of this.data.inputs.entries()) {
        promises.push(
          this.signInputAsync(i, keyPair, sighashTypes).then(
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
  signInput(inputIndex, keyPair, sighashTypes) {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
    if ((0, bip371_1.isTaprootInput)(input)) {
      return this._signTaprootInput(
        inputIndex,
        input,
        keyPair,
        undefined,
        sighashTypes,
      );
    }
    return this._signInput(inputIndex, keyPair, sighashTypes);
  }
  signTaprootInput(inputIndex, keyPair, tapLeafHashToSign, sighashTypes) {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
    if ((0, bip371_1.isTaprootInput)(input))
      return this._signTaprootInput(
        inputIndex,
        input,
        keyPair,
        tapLeafHashToSign,
        sighashTypes,
      );
    throw new Error(`Input #${inputIndex} is not of type Taproot.`);
  }
  _signInput(
    inputIndex,
    keyPair,
    sighashTypes = [transaction_1.Transaction.SIGHASH_ALL],
  ) {
    const { hash, sighashType } = (0, hash_1.getHashAndSighashType)(
      this.data.inputs,
      inputIndex,
      keyPair.publicKey,
      this.__CACHE,
      sighashTypes,
    );
    const partialSig = [
      {
        pubkey: keyPair.publicKey,
        signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
      },
    ];
    this.data.updateInput(inputIndex, { partialSig });
    return this;
  }
  _signTaprootInput(
    inputIndex,
    input,
    keyPair,
    tapLeafHashToSign,
    allowedSighashTypes = [transaction_1.Transaction.SIGHASH_DEFAULT],
  ) {
    const hashesForSig = this.checkTaprootHashesForSig(
      inputIndex,
      input,
      keyPair,
      tapLeafHashToSign,
      allowedSighashTypes,
    );
    const tapKeySig = hashesForSig
      .filter(h => !h.leafHash)
      .map(h =>
        (0, bip371_1.serializeTaprootSignature)(
          keyPair.signSchnorr(h.hash),
          input.sighashType,
        ),
      )[0];
    const tapScriptSig = hashesForSig
      .filter(h => !!h.leafHash)
      .map(h => ({
        pubkey: (0, bip371_1.toXOnly)(keyPair.publicKey),
        signature: (0, bip371_1.serializeTaprootSignature)(
          keyPair.signSchnorr(h.hash),
          input.sighashType,
        ),
        leafHash: h.leafHash,
      }));
    if (tapKeySig) {
      this.data.updateInput(inputIndex, { tapKeySig });
    }
    if (tapScriptSig.length) {
      this.data.updateInput(inputIndex, { tapScriptSig });
    }
    return this;
  }
  signInputAsync(inputIndex, keyPair, sighashTypes) {
    return Promise.resolve().then(() => {
      if (!keyPair || !keyPair.publicKey)
        throw new Error('Need Signer to sign input');
      const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
      if ((0, bip371_1.isTaprootInput)(input))
        return this._signTaprootInputAsync(
          inputIndex,
          input,
          keyPair,
          undefined,
          sighashTypes,
        );
      return this._signInputAsync(inputIndex, keyPair, sighashTypes);
    });
  }
  signTaprootInputAsync(inputIndex, keyPair, tapLeafHash, sighashTypes) {
    return Promise.resolve().then(() => {
      if (!keyPair || !keyPair.publicKey)
        throw new Error('Need Signer to sign input');
      const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
      if ((0, bip371_1.isTaprootInput)(input))
        return this._signTaprootInputAsync(
          inputIndex,
          input,
          keyPair,
          tapLeafHash,
          sighashTypes,
        );
      throw new Error(`Input #${inputIndex} is not of type Taproot.`);
    });
  }
  _signInputAsync(
    inputIndex,
    keyPair,
    sighashTypes = [transaction_1.Transaction.SIGHASH_ALL],
  ) {
    const { hash, sighashType } = (0, hash_1.getHashAndSighashType)(
      this.data.inputs,
      inputIndex,
      keyPair.publicKey,
      this.__CACHE,
      sighashTypes,
    );
    return Promise.resolve(keyPair.sign(hash)).then(signature => {
      const partialSig = [
        {
          pubkey: keyPair.publicKey,
          signature: bscript.signature.encode(signature, sighashType),
        },
      ];
      this.data.updateInput(inputIndex, { partialSig });
    });
  }
  async _signTaprootInputAsync(
    inputIndex,
    input,
    keyPair,
    tapLeafHash,
    sighashTypes = [transaction_1.Transaction.SIGHASH_DEFAULT],
  ) {
    const hashesForSig = this.checkTaprootHashesForSig(
      inputIndex,
      input,
      keyPair,
      tapLeafHash,
      sighashTypes,
    );
    const signaturePromises = [];
    const tapKeyHash = hashesForSig.filter(h => !h.leafHash)[0];
    if (tapKeyHash) {
      const tapKeySigPromise = Promise.resolve(
        keyPair.signSchnorr(tapKeyHash.hash),
      ).then(sig => {
        return {
          tapKeySig: (0, bip371_1.serializeTaprootSignature)(
            sig,
            input.sighashType,
          ),
        };
      });
      signaturePromises.push(tapKeySigPromise);
    }
    const tapScriptHashes = hashesForSig.filter(h => !!h.leafHash);
    if (tapScriptHashes.length) {
      const tapScriptSigPromises = tapScriptHashes.map(tsh => {
        return Promise.resolve(keyPair.signSchnorr(tsh.hash)).then(
          signature => {
            const tapScriptSig = [
              {
                pubkey: (0, bip371_1.toXOnly)(keyPair.publicKey),
                signature: (0, bip371_1.serializeTaprootSignature)(
                  signature,
                  input.sighashType,
                ),
                leafHash: tsh.leafHash,
              },
            ];
            return { tapScriptSig };
          },
        );
      });
      signaturePromises.push(...tapScriptSigPromises);
    }
    return Promise.all(signaturePromises).then(results => {
      results.forEach(v => this.data.updateInput(inputIndex, v));
    });
  }
  checkTaprootHashesForSig(
    inputIndex,
    input,
    keyPair,
    tapLeafHashToSign,
    allowedSighashTypes,
  ) {
    if (typeof keyPair.signSchnorr !== 'function')
      throw new Error(
        `Need Schnorr Signer to sign taproot input #${inputIndex}.`,
      );
    const hashesForSig = (0, hash_1.getTaprootHashesForSig)(
      inputIndex,
      input,
      this.data.inputs,
      keyPair.publicKey,
      this.__CACHE,
      tapLeafHashToSign,
      allowedSighashTypes,
    );
    if (!hashesForSig || !hashesForSig.length)
      throw new Error(
        `Can not sign for input #${inputIndex} with the key ${keyPair.publicKey.toString(
          'hex',
        )}`,
      );
    return hashesForSig;
  }
  toBuffer() {
    (0, cache_1.checkCache)(this.__CACHE);
    return this.data.toBuffer();
  }
  toHex() {
    (0, cache_1.checkCache)(this.__CACHE);
    return this.data.toHex();
  }
  toBase64() {
    (0, cache_1.checkCache)(this.__CACHE);
    return this.data.toBase64();
  }
  updateGlobal(updateData) {
    this.data.updateGlobal(updateData);
    return this;
  }
  updateInput(inputIndex, updateData) {
    if (updateData.witnessScript)
      (0, script_1.checkInvalidP2WSH)(updateData.witnessScript);
    (0, bip371_1.checkTaprootInputFields)(
      this.data.inputs[inputIndex],
      updateData,
      'updateInput',
    );
    this.data.updateInput(inputIndex, updateData);
    if (updateData.nonWitnessUtxo) {
      (0, cache_1.addNonWitnessTxCache)(
        this.__CACHE,
        this.data.inputs[inputIndex],
        inputIndex,
      );
    }
    return this;
  }
  updateOutput(outputIndex, updateData) {
    const outputData = this.data.outputs[outputIndex];
    (0, bip371_1.checkTaprootOutputFields)(
      outputData,
      updateData,
      'updateOutput',
    );
    this.data.updateOutput(outputIndex, updateData);
    return this;
  }
  addUnknownKeyValToGlobal(keyVal) {
    this.data.addUnknownKeyValToGlobal(keyVal);
    return this;
  }
  addUnknownKeyValToInput(inputIndex, keyVal) {
    this.data.addUnknownKeyValToInput(inputIndex, keyVal);
    return this;
  }
  addUnknownKeyValToOutput(outputIndex, keyVal) {
    this.data.addUnknownKeyValToOutput(outputIndex, keyVal);
    return this;
  }
  clearFinalizedInput(inputIndex) {
    this.data.clearFinalizedInput(inputIndex);
    return this;
  }
}
exports.Psbt = Psbt;
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
function checkFees(psbt, cache, opts) {
  const feeRate = cache.__FEE_RATE || psbt.getFeeRate();
  const vsize = cache.__EXTRACTED_TX.virtualSize();
  const satoshis = feeRate * vsize;
  if (feeRate >= opts.maximumFeeRate) {
    throw new Error(
      `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in ` +
        `fees, which is ${feeRate} satoshi per byte for a transaction ` +
        `with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per ` +
        `byte). Use setMaximumFeeRate method to raise your threshold, or ` +
        `pass true to the first arg of extractTransaction.`,
    );
  }
}
function trimTaprootSig(signature) {
  return signature.length === 64 ? signature : signature.subarray(0, 64);
}
function getSignersFromHD(inputIndex, inputs, hdKeyPair) {
  const input = (0, utils_1.checkForInput)(inputs, inputIndex);
  if (!input.bip32Derivation || input.bip32Derivation.length === 0) {
    throw new Error('Need bip32Derivation to sign with HD');
  }
  const myDerivations = input.bip32Derivation
    .map(bipDv => {
      if (bipDv.masterFingerprint.equals(hdKeyPair.fingerprint)) {
        return bipDv;
      } else {
        return;
      }
    })
    .filter(v => !!v);
  if (myDerivations.length === 0) {
    throw new Error(
      'Need one bip32Derivation masterFingerprint to match the HDSigner fingerprint',
    );
  }
  const signers = myDerivations.map(bipDv => {
    const node = hdKeyPair.derivePath(bipDv.path);
    if (!bipDv.pubkey.equals(node.publicKey)) {
      throw new Error('pubkey did not match bip32Derivation');
    }
    return node;
  });
  return signers;
}
function redeemFromFinalScriptSig(finalScript) {
  if (!finalScript) return;
  const decomp = bscript.decompile(finalScript);
  if (!decomp) return;
  const lastItem = decomp[decomp.length - 1];
  if (
    !Buffer.isBuffer(lastItem) ||
    isPubkeyLike(lastItem) ||
    isSigLike(lastItem)
  )
    return;
  const sDecomp = bscript.decompile(lastItem);
  if (!sDecomp) return;
  return lastItem;
}
function redeemFromFinalWitnessScript(finalScript) {
  if (!finalScript) return;
  const decomp = (0, script_1.scriptWitnessToWitnessStack)(finalScript);
  const lastItem = decomp[decomp.length - 1];
  if (isPubkeyLike(lastItem)) return;
  const sDecomp = bscript.decompile(lastItem);
  if (!sDecomp) return;
  return lastItem;
}
function isPubkeyLike(buf) {
  return buf.length === 33 && bscript.isCanonicalPubKey(buf);
}
function isSigLike(buf) {
  return bscript.isCanonicalScriptSignature(buf);
}
function range(n) {
  return [...Array(n).keys()];
}
