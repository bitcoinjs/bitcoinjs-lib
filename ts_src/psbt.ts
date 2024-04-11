import { Psbt as PsbtBase } from 'bip174';
import {
  KeyValue,
  PsbtGlobalUpdate,
  PsbtInput,
  PsbtInputUpdate,
  PsbtOutputUpdate,
  TapKeySig,
  TapScriptSig,
} from 'bip174/src/lib/interfaces';
import {
  AllScriptType,
  FinalScriptsFunc,
  FinalTaprootScriptsFunc,
  HDSigner,
  HDSignerAsync,
  PsbtCache,
  PsbtInputExtended,
  PsbtOpts,
  PsbtOptsOptional,
  PsbtOutputExtended,
  PsbtTxInput,
  PsbtTxOutput,
  Signer,
  SignerAsync,
  ValidateSigFunction,
} from './psbt/interfaces';
import { checkForInput, checkForOutput } from 'bip174/src/lib/utils';
import { fromOutputScript, toOutputScript } from './address';
import { cloneBuffer } from './bufferutils';
import { bitcoin as btcNetwork } from './networks';
import * as payments from './payments';
import * as bscript from './script';
import { Transaction } from './transaction';
import {
  toXOnly,
  tapScriptFinalizer,
  serializeTaprootSignature,
  isTaprootInput,
  checkTaprootInputFields,
  checkTaprootOutputFields,
} from './psbt/bip371';
import { PsbtTransaction, transactionFromBuffer } from './psbt/transaction';
import {
  addNonWitnessTxCache,
  checkCache,
  checkTxInputCache,
  getTxCacheValue,
} from './psbt/global/cache';
import {
  bip32DerivationIsMine,
  getFinalScripts,
  isFinalized,
} from './psbt/global';
import {
  checkInputsForPartialSig,
  checkTxForDupeIns,
  inputFinalizeGetAmts,
  pubkeyInInput,
} from './psbt/input';
import { checkPartialSigSighashes, trimTaprootSig } from './psbt/global/sign';
import {
  checkInvalidP2WSH,
  checkScriptForPubkey,
  classifyScript,
  getMeaningfulScript,
  getScriptFromInput,
  getScriptFromUtxo,
  redeemFromFinalScriptSig,
  redeemFromFinalWitnessScript,
  witnessStackToScriptWitness,
} from './psbt/input/script';
import { pubkeyInOutput } from './psbt/output';
import {
  getAllTaprootHashesForSig,
  getHashAndSighashType,
  getHashForSig,
  getTaprootHashesForSig,
} from './psbt/global/hash';
import {
  check32Bit,
  checkFees,
  getSignersFromHD,
  range,
} from './psbt/psbtutils';

/**
 * These are the default arguments for a Psbt instance.
 */
const DEFAULT_OPTS: PsbtOpts = {
  /**
   * A bitcoinjs Network object. This is only used if you pass an `address`
   * parameter to addOutput. Otherwise it is not needed and can be left default.
   */
  network: btcNetwork,
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
export class Psbt {
  static fromBase64(data: string, opts: PsbtOptsOptional = {}): Psbt {
    const buffer = Buffer.from(data, 'base64');
    return this.fromBuffer(buffer, opts);
  }

  static fromHex(data: string, opts: PsbtOptsOptional = {}): Psbt {
    const buffer = Buffer.from(data, 'hex');
    return this.fromBuffer(buffer, opts);
  }

  static fromBuffer(buffer: Buffer, opts: PsbtOptsOptional = {}): Psbt {
    const psbtBase = PsbtBase.fromBuffer(buffer, transactionFromBuffer);
    const psbt = new Psbt(opts, psbtBase);
    checkTxForDupeIns(psbt.__CACHE.__TX, psbt.__CACHE);
    return psbt;
  }

  private __CACHE: PsbtCache;
  private opts: PsbtOpts;

  constructor(
    opts: PsbtOptsOptional = {},
    readonly data: PsbtBase = new PsbtBase(new PsbtTransaction()),
  ) {
    // set defaults
    this.opts = Object.assign({}, DEFAULT_OPTS, opts);
    this.__CACHE = {
      __NON_WITNESS_UTXO_TX_CACHE: [],
      __NON_WITNESS_UTXO_BUF_CACHE: [],
      __TX_IN_CACHE: {},
      __TX: (this.data.globalMap.unsignedTx as PsbtTransaction).tx,
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
    const dpew = (
      obj: any,
      attr: string,
      enumerable: boolean,
      writable: boolean,
    ): any =>
      Object.defineProperty(obj, attr, {
        enumerable,
        writable,
      });
    dpew(this, '__CACHE', false, true);
    dpew(this, 'opts', false, true);
  }

  get inputCount(): number {
    return this.data.inputs.length;
  }

  get version(): number {
    return this.__CACHE.__TX.version;
  }

  set version(version: number) {
    this.setVersion(version);
  }

  get locktime(): number {
    return this.__CACHE.__TX.locktime;
  }

  set locktime(locktime: number) {
    this.setLocktime(locktime);
  }

  get txInputs(): PsbtTxInput[] {
    return this.__CACHE.__TX.ins.map(input => ({
      hash: cloneBuffer(input.hash),
      index: input.index,
      sequence: input.sequence,
    }));
  }

  get txOutputs(): PsbtTxOutput[] {
    return this.__CACHE.__TX.outs.map(output => {
      let address;
      try {
        address = fromOutputScript(output.script, this.opts.network);
      } catch (_) {}
      return {
        script: cloneBuffer(output.script),
        value: output.value,
        address,
      };
    });
  }

  combine(...those: Psbt[]): this {
    this.data.combine(...those.map(o => o.data));
    return this;
  }

  clone(): Psbt {
    // TODO: more efficient cloning
    const res = Psbt.fromBuffer(this.data.toBuffer());
    res.opts = JSON.parse(JSON.stringify(this.opts));
    return res;
  }

  setMaximumFeeRate(satoshiPerByte: number): void {
    check32Bit(satoshiPerByte); // 42.9 BTC per byte IS excessive... so throw
    this.opts.maximumFeeRate = satoshiPerByte;
  }

  setVersion(version: number): this {
    check32Bit(version);
    checkInputsForPartialSig(this.data.inputs, 'setVersion');
    const c = this.__CACHE;
    c.__TX.version = version;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  setLocktime(locktime: number): this {
    check32Bit(locktime);
    checkInputsForPartialSig(this.data.inputs, 'setLocktime');
    const c = this.__CACHE;
    c.__TX.locktime = locktime;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  setInputSequence(inputIndex: number, sequence: number): this {
    check32Bit(sequence);
    checkInputsForPartialSig(this.data.inputs, 'setInputSequence');
    const c = this.__CACHE;
    if (c.__TX.ins.length <= inputIndex) {
      throw new Error('Input index too high');
    }
    c.__TX.ins[inputIndex].sequence = sequence;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  addInputs(inputDatas: PsbtInputExtended[]): this {
    inputDatas.forEach(inputData => this.addInput(inputData));
    return this;
  }

  addInput(inputData: PsbtInputExtended): this {
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
    checkTaprootInputFields(inputData, inputData, 'addInput');
    checkInputsForPartialSig(this.data.inputs, 'addInput');
    if (inputData.witnessScript) checkInvalidP2WSH(inputData.witnessScript);
    const c = this.__CACHE;
    this.data.addInput(inputData);
    const txIn = c.__TX.ins[c.__TX.ins.length - 1];
    checkTxInputCache(c, txIn);

    const inputIndex = this.data.inputs.length - 1;
    const input = this.data.inputs[inputIndex];
    if (input.nonWitnessUtxo) {
      addNonWitnessTxCache(this.__CACHE, input, inputIndex);
    }
    c.__FEE = undefined;
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  addOutputs(outputDatas: PsbtOutputExtended[]): this {
    outputDatas.forEach(outputData => this.addOutput(outputData));
    return this;
  }

  addOutput(outputData: PsbtOutputExtended): this {
    if (
      arguments.length > 1 ||
      !outputData ||
      outputData.value === undefined ||
      ((outputData as any).address === undefined &&
        (outputData as any).script === undefined)
    ) {
      throw new Error(
        `Invalid arguments for Psbt.addOutput. ` +
          `Requires single object with at least [script or address] and [value]`,
      );
    }
    checkInputsForPartialSig(this.data.inputs, 'addOutput');
    const { address } = outputData as any;
    if (typeof address === 'string') {
      const { network } = this.opts;
      const script = toOutputScript(address, network);
      outputData = Object.assign(outputData, { script });
    }
    checkTaprootOutputFields(outputData, outputData, 'addOutput');

    const c = this.__CACHE;
    this.data.addOutput(outputData);
    c.__FEE = undefined;
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  extractTransaction(disableFeeCheck?: boolean): Transaction {
    if (!this.data.inputs.every(isFinalized)) throw new Error('Not finalized');
    const c = this.__CACHE;
    if (!disableFeeCheck) {
      checkFees(this, c, this.opts);
    }
    if (c.__EXTRACTED_TX) return c.__EXTRACTED_TX;
    const tx = c.__TX.clone();
    inputFinalizeGetAmts(this.data.inputs, tx, c, true);
    return tx;
  }

  getFeeRate(): number {
    return getTxCacheValue(
      '__FEE_RATE',
      'fee rate',
      this.data.inputs,
      this.__CACHE,
    )!;
  }

  getFee(): number {
    return getTxCacheValue('__FEE', 'fee', this.data.inputs, this.__CACHE)!;
  }

  finalizeAllInputs(): this {
    checkForInput(this.data.inputs, 0); // making sure we have at least one
    range(this.data.inputs.length).forEach(idx => this.finalizeInput(idx));
    return this;
  }

  finalizeInput(
    inputIndex: number,
    finalScriptsFunc?: FinalScriptsFunc | FinalTaprootScriptsFunc,
  ): this {
    const input = checkForInput(this.data.inputs, inputIndex);
    if (isTaprootInput(input))
      return this._finalizeTaprootInput(
        inputIndex,
        input,
        undefined,
        finalScriptsFunc as FinalTaprootScriptsFunc,
      );
    return this._finalizeInput(
      inputIndex,
      input,
      finalScriptsFunc as FinalScriptsFunc,
    );
  }

  finalizeTaprootInput(
    inputIndex: number,
    tapLeafHashToFinalize?: Buffer,
    finalScriptsFunc: FinalTaprootScriptsFunc = tapScriptFinalizer,
  ): this {
    const input = checkForInput(this.data.inputs, inputIndex);
    if (isTaprootInput(input))
      return this._finalizeTaprootInput(
        inputIndex,
        input,
        tapLeafHashToFinalize,
        finalScriptsFunc,
      );
    throw new Error(`Cannot finalize input #${inputIndex}. Not Taproot.`);
  }

  private _finalizeInput(
    inputIndex: number,
    input: PsbtInput,
    finalScriptsFunc: FinalScriptsFunc = getFinalScripts,
  ): this {
    const { script, isP2SH, isP2WSH, isSegwit } = getScriptFromInput(
      inputIndex,
      input,
      this.__CACHE,
    );
    if (!script) throw new Error(`No script found for input #${inputIndex}`);

    checkPartialSigSighashes(input);

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

  private _finalizeTaprootInput(
    inputIndex: number,
    input: PsbtInput,
    tapLeafHashToFinalize?: Buffer,
    finalScriptsFunc = tapScriptFinalizer,
  ): this {
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
      const finalScriptWitness = witnessStackToScriptWitness(payment.witness!);
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

  getInputType(inputIndex: number): AllScriptType {
    const input = checkForInput(this.data.inputs, inputIndex);
    const script = getScriptFromUtxo(inputIndex, input, this.__CACHE);
    const result = getMeaningfulScript(
      script,
      inputIndex,
      'input',
      input.redeemScript || redeemFromFinalScriptSig(input.finalScriptSig),
      input.witnessScript ||
        redeemFromFinalWitnessScript(input.finalScriptWitness),
    );
    const type = result.type === 'raw' ? '' : result.type + '-';
    const mainType = classifyScript(result.meaningfulScript);
    return (type + mainType) as AllScriptType;
  }

  inputHasPubkey(inputIndex: number, pubkey: Buffer): boolean {
    const input = checkForInput(this.data.inputs, inputIndex);
    return pubkeyInInput(pubkey, input, inputIndex, this.__CACHE);
  }

  inputHasHDKey(inputIndex: number, root: HDSigner): boolean {
    const input = checkForInput(this.data.inputs, inputIndex);
    const derivationIsMine = bip32DerivationIsMine(root);
    return (
      !!input.bip32Derivation && input.bip32Derivation.some(derivationIsMine)
    );
  }

  outputHasPubkey(outputIndex: number, pubkey: Buffer): boolean {
    const output = checkForOutput(this.data.outputs, outputIndex);
    return pubkeyInOutput(pubkey, output, outputIndex, this.__CACHE);
  }

  outputHasHDKey(outputIndex: number, root: HDSigner): boolean {
    const output = checkForOutput(this.data.outputs, outputIndex);
    const derivationIsMine = bip32DerivationIsMine(root);
    return (
      !!output.bip32Derivation && output.bip32Derivation.some(derivationIsMine)
    );
  }

  validateSignaturesOfAllInputs(validator: ValidateSigFunction): boolean {
    checkForInput(this.data.inputs, 0); // making sure we have at least one
    const results = range(this.data.inputs.length).map(idx =>
      this.validateSignaturesOfInput(idx, validator),
    );
    return results.reduce((final, res) => res === true && final, true);
  }

  validateSignaturesOfInput(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Buffer,
  ): boolean {
    const input = this.data.inputs[inputIndex];
    if (isTaprootInput(input))
      return this.validateSignaturesOfTaprootInput(
        inputIndex,
        validator,
        pubkey,
      );

    return this._validateSignaturesOfInput(inputIndex, validator, pubkey);
  }

  private _validateSignaturesOfInput(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Buffer,
  ): boolean {
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
    const results: boolean[] = [];
    let hashCache: Buffer;
    let scriptCache: Buffer;
    let sighashCache: number;
    for (const pSig of mySigs) {
      const sig = bscript.signature.decode(pSig.signature);
      const { hash, script } =
        sighashCache! !== sig.hashType
          ? getHashForSig(
              inputIndex,
              Object.assign({}, input, { sighashType: sig.hashType }),
              this.__CACHE,
              true,
            )
          : { hash: hashCache!, script: scriptCache! };
      sighashCache = sig.hashType;
      hashCache = hash;
      scriptCache = script;
      checkScriptForPubkey(pSig.pubkey, script, 'verify');
      results.push(validator(pSig.pubkey, hash, sig.signature));
    }
    return results.every(res => res === true);
  }

  private validateSignaturesOfTaprootInput(
    inputIndex: number,
    validator: ValidateSigFunction,
    pubkey?: Buffer,
  ): boolean {
    const input = this.data.inputs[inputIndex];
    const tapKeySig = (input || {}).tapKeySig;
    const tapScriptSig = (input || {}).tapScriptSig;
    if (!input && !tapKeySig && !(tapScriptSig && !tapScriptSig.length))
      throw new Error('No signatures to validate');
    if (typeof validator !== 'function')
      throw new Error('Need validator function to validate signatures');

    pubkey = pubkey && toXOnly(pubkey);
    const allHashses = pubkey
      ? getTaprootHashesForSig(
          inputIndex,
          input,
          this.data.inputs,
          pubkey,
          this.__CACHE,
        )
      : getAllTaprootHashesForSig(
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
    hdKeyPair: HDSigner,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): this {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input');
    }

    const results: boolean[] = [];
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
    hdKeyPair: HDSigner | HDSignerAsync,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): Promise<void> {
    return new Promise((resolve, reject): any => {
      if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
        return reject(new Error('Need HDSigner to sign input'));
      }

      const results: boolean[] = [];
      const promises: Array<Promise<void>> = [];
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
    inputIndex: number,
    hdKeyPair: HDSigner,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): this {
    if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
      throw new Error('Need HDSigner to sign input');
    }
    const signers = getSignersFromHD(
      inputIndex,
      this.data.inputs,
      hdKeyPair,
    ) as Signer[];
    signers.forEach(signer => this.signInput(inputIndex, signer, sighashTypes));
    return this;
  }

  signInputHDAsync(
    inputIndex: number,
    hdKeyPair: HDSigner | HDSignerAsync,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): Promise<void> {
    return new Promise((resolve, reject): any => {
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

  signAllInputs(keyPair: Signer, sighashTypes?: number[]): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');

    // TODO: Add a pubkey/pubkeyhash cache to each input
    // as input information is added, then eventually
    // optimize this method.
    const results: boolean[] = [];
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

  signAllInputsAsync(
    keyPair: Signer | SignerAsync,
    sighashTypes?: number[],
  ): Promise<void> {
    return new Promise((resolve, reject): any => {
      if (!keyPair || !keyPair.publicKey)
        return reject(new Error('Need Signer to sign input'));

      // TODO: Add a pubkey/pubkeyhash cache to each input
      // as input information is added, then eventually
      // optimize this method.
      const results: boolean[] = [];
      const promises: Array<Promise<void>> = [];
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

  signInput(
    inputIndex: number,
    keyPair: Signer,
    sighashTypes?: number[],
  ): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');

    const input = checkForInput(this.data.inputs, inputIndex);

    if (isTaprootInput(input)) {
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

  signTaprootInput(
    inputIndex: number,
    keyPair: Signer,
    tapLeafHashToSign?: Buffer,
    sighashTypes?: number[],
  ): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const input = checkForInput(this.data.inputs, inputIndex);

    if (isTaprootInput(input))
      return this._signTaprootInput(
        inputIndex,
        input,
        keyPair,
        tapLeafHashToSign,
        sighashTypes,
      );
    throw new Error(`Input #${inputIndex} is not of type Taproot.`);
  }

  private _signInput(
    inputIndex: number,
    keyPair: Signer,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): this {
    const { hash, sighashType } = getHashAndSighashType(
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

  private _signTaprootInput(
    inputIndex: number,
    input: PsbtInput,
    keyPair: Signer,
    tapLeafHashToSign?: Buffer,
    allowedSighashTypes: number[] = [Transaction.SIGHASH_DEFAULT],
  ): this {
    const hashesForSig = this.checkTaprootHashesForSig(
      inputIndex,
      input,
      keyPair,
      tapLeafHashToSign,
      allowedSighashTypes,
    );

    const tapKeySig: TapKeySig = hashesForSig
      .filter(h => !h.leafHash)
      .map(h =>
        serializeTaprootSignature(
          keyPair.signSchnorr!(h.hash),
          input.sighashType,
        ),
      )[0];

    const tapScriptSig: TapScriptSig[] = hashesForSig
      .filter(h => !!h.leafHash)
      .map(
        h =>
          ({
            pubkey: toXOnly(keyPair.publicKey),
            signature: serializeTaprootSignature(
              keyPair.signSchnorr!(h.hash),
              input.sighashType,
            ),
            leafHash: h.leafHash,
          } as TapScriptSig),
      );

    if (tapKeySig) {
      this.data.updateInput(inputIndex, { tapKeySig });
    }

    if (tapScriptSig.length) {
      this.data.updateInput(inputIndex, { tapScriptSig });
    }

    return this;
  }

  signInputAsync(
    inputIndex: number,
    keyPair: Signer | SignerAsync,
    sighashTypes?: number[],
  ): Promise<void> {
    return Promise.resolve().then(() => {
      if (!keyPair || !keyPair.publicKey)
        throw new Error('Need Signer to sign input');

      const input = checkForInput(this.data.inputs, inputIndex);
      if (isTaprootInput(input))
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

  signTaprootInputAsync(
    inputIndex: number,
    keyPair: Signer | SignerAsync,
    tapLeafHash?: Buffer,
    sighashTypes?: number[],
  ): Promise<void> {
    return Promise.resolve().then(() => {
      if (!keyPair || !keyPair.publicKey)
        throw new Error('Need Signer to sign input');

      const input = checkForInput(this.data.inputs, inputIndex);
      if (isTaprootInput(input))
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

  private _signInputAsync(
    inputIndex: number,
    keyPair: Signer | SignerAsync,
    sighashTypes: number[] = [Transaction.SIGHASH_ALL],
  ): Promise<void> {
    const { hash, sighashType } = getHashAndSighashType(
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

  private async _signTaprootInputAsync(
    inputIndex: number,
    input: PsbtInput,
    keyPair: Signer | SignerAsync,
    tapLeafHash?: Buffer,
    sighashTypes: number[] = [Transaction.SIGHASH_DEFAULT],
  ): Promise<void> {
    const hashesForSig = this.checkTaprootHashesForSig(
      inputIndex,
      input,
      keyPair,
      tapLeafHash,
      sighashTypes,
    );

    const signaturePromises: Promise<
      { tapKeySig: Buffer } | { tapScriptSig: TapScriptSig[] }
    >[] = [];
    const tapKeyHash = hashesForSig.filter(h => !h.leafHash)[0];
    if (tapKeyHash) {
      const tapKeySigPromise = Promise.resolve(
        keyPair.signSchnorr!(tapKeyHash.hash),
      ).then(sig => {
        return { tapKeySig: serializeTaprootSignature(sig, input.sighashType) };
      });
      signaturePromises.push(tapKeySigPromise);
    }

    const tapScriptHashes = hashesForSig.filter(h => !!h.leafHash);
    if (tapScriptHashes.length) {
      const tapScriptSigPromises = tapScriptHashes.map(tsh => {
        return Promise.resolve(keyPair.signSchnorr!(tsh.hash)).then(
          signature => {
            const tapScriptSig = [
              {
                pubkey: toXOnly(keyPair.publicKey),
                signature: serializeTaprootSignature(
                  signature,
                  input.sighashType,
                ),
                leafHash: tsh.leafHash,
              } as TapScriptSig,
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

  private checkTaprootHashesForSig(
    inputIndex: number,
    input: PsbtInput,
    keyPair: Signer | SignerAsync,
    tapLeafHashToSign?: Buffer,
    allowedSighashTypes?: number[],
  ): { hash: Buffer; leafHash?: Buffer }[] {
    if (typeof keyPair.signSchnorr !== 'function')
      throw new Error(
        `Need Schnorr Signer to sign taproot input #${inputIndex}.`,
      );

    const hashesForSig = getTaprootHashesForSig(
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

  toBuffer(): Buffer {
    checkCache(this.__CACHE);
    return this.data.toBuffer();
  }

  toHex(): string {
    checkCache(this.__CACHE);
    return this.data.toHex();
  }

  toBase64(): string {
    checkCache(this.__CACHE);
    return this.data.toBase64();
  }

  updateGlobal(updateData: PsbtGlobalUpdate): this {
    this.data.updateGlobal(updateData);
    return this;
  }

  updateInput(inputIndex: number, updateData: PsbtInputUpdate): this {
    if (updateData.witnessScript) checkInvalidP2WSH(updateData.witnessScript);
    checkTaprootInputFields(
      this.data.inputs[inputIndex],
      updateData,
      'updateInput',
    );
    this.data.updateInput(inputIndex, updateData);
    if (updateData.nonWitnessUtxo) {
      addNonWitnessTxCache(
        this.__CACHE,
        this.data.inputs[inputIndex],
        inputIndex,
      );
    }
    return this;
  }

  updateOutput(outputIndex: number, updateData: PsbtOutputUpdate): this {
    const outputData = this.data.outputs[outputIndex];
    checkTaprootOutputFields(outputData, updateData, 'updateOutput');

    this.data.updateOutput(outputIndex, updateData);
    return this;
  }

  addUnknownKeyValToGlobal(keyVal: KeyValue): this {
    this.data.addUnknownKeyValToGlobal(keyVal);
    return this;
  }

  addUnknownKeyValToInput(inputIndex: number, keyVal: KeyValue): this {
    this.data.addUnknownKeyValToInput(inputIndex, keyVal);
    return this;
  }

  addUnknownKeyValToOutput(outputIndex: number, keyVal: KeyValue): this {
    this.data.addUnknownKeyValToOutput(outputIndex, keyVal);
    return this;
  }

  clearFinalizedInput(inputIndex: number): this {
    this.data.clearFinalizedInput(inputIndex);
    return this;
  }
}
