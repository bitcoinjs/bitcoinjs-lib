import { Psbt as PsbtBase } from 'bip174';
import * as varuint from 'varuint-bitcoin';
import {
  Bip32Derivation,
  KeyValue,
  PartialSig,
  PsbtGlobalUpdate,
  PsbtInput,
  PsbtInputUpdate,
  PsbtOutput,
  PsbtOutputUpdate,
  Transaction as ITransaction,
  TransactionFromBuffer,
  TapKeySig,
  TapScriptSig,
  TapLeafScript,
} from 'bip174';
import { checkForInput, checkForOutput } from 'bip174';
import { fromOutputScript, toOutputScript } from './address.js';
import { cloneBuffer, reverseBuffer } from './bufferutils.js';
import { bitcoin as btcNetwork, Network } from './networks.js';
import * as payments from './payments/index.js';
import { tapleafHash } from './payments/bip341.js';
import * as bscript from './script.js';
import { Output, Transaction } from './transaction.js';
import {
  toXOnly,
  tapScriptFinalizer,
  serializeTaprootSignature,
  isTaprootInput,
  checkTaprootInputFields,
  checkTaprootOutputFields,
  checkTaprootInputForSigs,
} from './psbt/bip371.js';
import {
  witnessStackToScriptWitness,
  checkInputForSig,
  pubkeyInScript,
  isP2MS,
  isP2PK,
  isP2PKH,
  isP2WPKH,
  isP2WSHScript,
  isP2SHScript,
  isP2TR,
} from './psbt/psbtutils.js';
import * as tools from 'uint8array-tools';

export { toXOnly };

export interface TransactionInput {
  hash: string | Uint8Array;
  index: number;
  sequence?: number;
}

export interface PsbtTxInput extends TransactionInput {
  hash: Uint8Array;
}

export interface TransactionOutput {
  script: Uint8Array;
  value: bigint;
}

export interface PsbtTxOutput extends TransactionOutput {
  address: string | undefined;
}

// msghash is 32 byte hash of preimage, signature is 64 byte compact signature (r,s 32 bytes each)
export type ValidateSigFunction = (
  pubkey: Uint8Array,
  msghash: Uint8Array,
  signature: Uint8Array,
) => boolean;

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
    const buffer = tools.fromBase64(data);
    return this.fromBuffer(buffer, opts);
  }

  static fromHex(data: string, opts: PsbtOptsOptional = {}): Psbt {
    const buffer = tools.fromHex(data);
    return this.fromBuffer(buffer, opts);
  }

  static fromBuffer(buffer: Uint8Array, opts: PsbtOptsOptional = {}): Psbt {
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
      outputData = Object.assign({}, outputData, { script });
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
    )! as number;
  }

  getFee(): bigint {
    return getTxCacheValue(
      '__FEE',
      'fee',
      this.data.inputs,
      this.__CACHE,
    )! as bigint;
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
    tapLeafHashToFinalize?: Uint8Array,
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
    tapLeafHashToFinalize?: Uint8Array,
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

  inputHasPubkey(inputIndex: number, pubkey: Uint8Array): boolean {
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

  outputHasPubkey(outputIndex: number, pubkey: Uint8Array): boolean {
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
    pubkey?: Uint8Array,
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
    pubkey?: Uint8Array,
  ): boolean {
    const input = this.data.inputs[inputIndex];
    const partialSig = (input || {}).partialSig as PartialSig[];
    if (!input || !partialSig || partialSig.length < 1)
      throw new Error('No signatures to validate');
    if (typeof validator !== 'function')
      throw new Error('Need validator function to validate signatures');
    const mySigs = pubkey
      ? partialSig.filter(sig => tools.compare(sig.pubkey, pubkey) === 0)
      : partialSig;
    if (mySigs.length < 1) throw new Error('No signatures for this pubkey');
    const results: boolean[] = [];
    let hashCache: Uint8Array;
    let scriptCache: Uint8Array;
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
    pubkey?: Uint8Array,
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
        const tapSigHash = allHashses.find(
          h => tools.compare(h.pubkey, tapSig.pubkey) === 0,
        );
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
    tapLeafHashToSign?: Uint8Array,
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
    tapLeafHashToSign?: Uint8Array,
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
          }) as TapScriptSig,
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
    tapLeafHash?: Uint8Array,
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
    tapLeafHash?: Uint8Array,
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
      { tapKeySig: Uint8Array } | { tapScriptSig: TapScriptSig[] }
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
    tapLeafHashToSign?: Uint8Array,
    allowedSighashTypes?: number[],
  ): { hash: Uint8Array; leafHash?: Uint8Array }[] {
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
        `Can not sign for input #${inputIndex} with the key ${tools.toHex(
          keyPair.publicKey,
        )}`,
      );

    return hashesForSig;
  }

  toBuffer(): Uint8Array {
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

interface PsbtCache {
  __NON_WITNESS_UTXO_TX_CACHE: Transaction[];
  __NON_WITNESS_UTXO_BUF_CACHE: Uint8Array[];
  __TX_IN_CACHE: { [index: string]: number };
  __TX: Transaction;
  __FEE_RATE?: number;
  __FEE?: bigint;
  __EXTRACTED_TX?: Transaction;
  __UNSAFE_SIGN_NONSEGWIT: boolean;
}

interface PsbtOptsOptional {
  network?: Network;
  maximumFeeRate?: number;
}

interface PsbtOpts {
  network: Network;
  maximumFeeRate: number;
}

interface PsbtInputExtended extends PsbtInput, TransactionInput {}

type PsbtOutputExtended = PsbtOutputExtendedAddress | PsbtOutputExtendedScript;

interface PsbtOutputExtendedAddress extends PsbtOutput {
  address: string;
  value: bigint;
}

interface PsbtOutputExtendedScript extends PsbtOutput {
  script: Uint8Array;
  value: bigint;
}

interface HDSignerBase {
  /**
   * DER format compressed publicKey buffer
   */
  publicKey: Uint8Array;
  /**
   * The first 4 bytes of the sha256-ripemd160 of the publicKey
   */
  fingerprint: Uint8Array;
}

export interface HDSigner extends HDSignerBase {
  /**
   * The path string must match /^m(\/\d+'?)+$/
   * ex. m/44'/0'/0'/1/23 levels with ' must be hard derivations
   */
  derivePath(path: string): HDSigner;
  /**
   * Input hash (the "message digest") for the signature algorithm
   * Return a 64 byte signature (32 byte r and 32 byte s in that order)
   */
  sign(hash: Uint8Array): Uint8Array;
}

/**
 * Same as above but with async sign method
 */
export interface HDSignerAsync extends HDSignerBase {
  derivePath(path: string): HDSignerAsync;
  sign(hash: Uint8Array): Promise<Uint8Array>;
}

export interface Signer {
  publicKey: Uint8Array;
  network?: any;
  sign(hash: Uint8Array, lowR?: boolean): Uint8Array;
  signSchnorr?(hash: Uint8Array): Uint8Array;
  getPublicKey?(): Uint8Array;
}

export interface SignerAsync {
  publicKey: Uint8Array;
  network?: any;
  sign(hash: Uint8Array, lowR?: boolean): Promise<Uint8Array>;
  signSchnorr?(hash: Uint8Array): Promise<Uint8Array>;
  getPublicKey?(): Uint8Array;
}

/**
 * This function is needed to pass to the bip174 base class's fromBuffer.
 * It takes the "transaction buffer" portion of the psbt buffer and returns a
 * Transaction (From the bip174 library) interface.
 */
const transactionFromBuffer: TransactionFromBuffer = (
  buffer: Uint8Array,
): ITransaction => new PsbtTransaction(buffer);

/**
 * This class implements the Transaction interface from bip174 library.
 * It contains a bitcoinjs-lib Transaction object.
 */
class PsbtTransaction implements ITransaction {
  tx: Transaction;
  constructor(
    buffer: Uint8Array = Uint8Array.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  ) {
    this.tx = Transaction.fromBuffer(buffer);
    checkTxEmpty(this.tx);
    Object.defineProperty(this, 'tx', {
      enumerable: false,
      writable: true,
    });
  }

  getInputOutputCounts(): {
    inputCount: number;
    outputCount: number;
  } {
    return {
      inputCount: this.tx.ins.length,
      outputCount: this.tx.outs.length,
    };
  }

  addInput(input: any): void {
    if (
      (input as any).hash === undefined ||
      (input as any).index === undefined ||
      (!((input as any).hash instanceof Uint8Array) &&
        typeof (input as any).hash !== 'string') ||
      typeof (input as any).index !== 'number'
    ) {
      throw new Error('Error adding input.');
    }
    const hash =
      typeof input.hash === 'string'
        ? reverseBuffer(tools.fromHex(input.hash))
        : input.hash;
    this.tx.addInput(hash, input.index, input.sequence);
  }

  addOutput(output: any): void {
    if (
      (output as any).script === undefined ||
      (output as any).value === undefined ||
      !((output as any).script instanceof Uint8Array) ||
      typeof (output as any).value !== 'bigint'
    ) {
      throw new Error('Error adding output.');
    }
    this.tx.addOutput(output.script, output.value);
  }

  toBuffer(): Uint8Array {
    return this.tx.toBuffer();
  }
}

function canFinalize(
  input: PsbtInput,
  script: Uint8Array,
  scriptType: string,
): boolean {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
    case 'witnesspubkeyhash':
      return hasSigs(1, input.partialSig);
    case 'multisig':
      const p2ms = payments.p2ms({ output: script });
      return hasSigs(p2ms.m!, input.partialSig, p2ms.pubkeys);
    default:
      return false;
  }
}

function checkCache(cache: PsbtCache): void {
  if (cache.__UNSAFE_SIGN_NONSEGWIT !== false) {
    throw new Error('Not BIP174 compliant, can not export');
  }
}

function hasSigs(
  neededSigs: number,
  partialSig?: any[],
  pubkeys?: Uint8Array[],
): boolean {
  if (!partialSig) return false;
  let sigs: any;
  if (pubkeys) {
    sigs = pubkeys
      .map(pkey => {
        const pubkey = compressPubkey(pkey);
        return partialSig.find(
          pSig => tools.compare(pSig.pubkey, pubkey) === 0,
        );
      })
      .filter(v => !!v);
  } else {
    sigs = partialSig;
  }
  if (sigs.length > neededSigs) throw new Error('Too many signatures');
  return sigs.length === neededSigs;
}

function isFinalized(input: PsbtInput): boolean {
  return !!input.finalScriptSig || !!input.finalScriptWitness;
}

function bip32DerivationIsMine(
  root: HDSigner,
): (d: Bip32Derivation) => boolean {
  return (d: Bip32Derivation): boolean => {
    if (tools.compare(root.fingerprint, d.masterFingerprint)) return false;
    if (tools.compare(root.derivePath(d.path).publicKey, d.pubkey))
      return false;
    return true;
  };
}

function check32Bit(num: number): void {
  if (
    typeof num !== 'number' ||
    num !== Math.floor(num) ||
    num > 0xffffffff ||
    num < 0
  ) {
    throw new Error('Invalid 32 bit integer');
  }
}

function checkFees(psbt: Psbt, cache: PsbtCache, opts: PsbtOpts): void {
  const feeRate = cache.__FEE_RATE || psbt.getFeeRate();
  const vsize = cache.__EXTRACTED_TX!.virtualSize();
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

function checkInputsForPartialSig(inputs: PsbtInput[], action: string): void {
  inputs.forEach(input => {
    const throws = isTaprootInput(input)
      ? checkTaprootInputForSigs(input, action)
      : checkInputForSig(input, action);
    if (throws)
      throw new Error('Can not modify transaction, signatures exist.');
  });
}

function checkPartialSigSighashes(input: PsbtInput): void {
  if (!input.sighashType || !input.partialSig) return;
  const { partialSig, sighashType } = input;
  partialSig.forEach((pSig: PartialSig) => {
    const { hashType } = bscript.signature.decode(pSig.signature);
    if (sighashType !== hashType) {
      throw new Error('Signature sighash does not match input sighash type');
    }
  });
}

function checkScriptForPubkey(
  pubkey: Uint8Array,
  script: Uint8Array,
  action: string,
): void {
  if (!pubkeyInScript(pubkey, script)) {
    throw new Error(
      `Can not ${action} for this input with the key ${tools.toHex(pubkey)}`,
    );
  }
}

function checkTxEmpty(tx: Transaction): void {
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

function checkTxForDupeIns(tx: Transaction, cache: PsbtCache): void {
  tx.ins.forEach(input => {
    checkTxInputCache(cache, input);
  });
}

function checkTxInputCache(
  cache: PsbtCache,
  input: { hash: Uint8Array; index: number },
): void {
  const key =
    tools.toHex(reverseBuffer(Uint8Array.from(input.hash))) + ':' + input.index;
  if (cache.__TX_IN_CACHE[key]) throw new Error('Duplicate input detected.');
  cache.__TX_IN_CACHE[key] = 1;
}

function scriptCheckerFactory(
  payment: any,
  paymentScriptName: string,
): (
  idx: number,
  spk: Uint8Array,
  rs: Uint8Array,
  ioType: 'input' | 'output',
) => void {
  return (
    inputIndex: number,
    scriptPubKey: Uint8Array,
    redeemScript: Uint8Array,
    ioType: 'input' | 'output',
  ): void => {
    const redeemScriptOutput = payment({
      redeem: { output: redeemScript },
    }).output as Uint8Array;

    if (tools.compare(scriptPubKey, redeemScriptOutput)) {
      throw new Error(
        `${paymentScriptName} for ${ioType} #${inputIndex} doesn't match the scriptPubKey in the prevout`,
      );
    }
  };
}
const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script');
const checkWitnessScript = scriptCheckerFactory(
  payments.p2wsh,
  'Witness script',
);

type TxCacheNumberKey = '__FEE_RATE' | '__FEE';
function getTxCacheValue<T extends TxCacheNumberKey>(
  key: T,
  name: string,
  inputs: PsbtInput[],
  c: PsbtCache,
): bigint | number | undefined {
  if (!inputs.every(isFinalized))
    throw new Error(`PSBT must be finalized to calculate ${name}`);
  if (key === '__FEE_RATE' && c.__FEE_RATE) return c.__FEE_RATE;
  if (key === '__FEE' && c.__FEE) return c.__FEE;
  let tx: Transaction;
  let mustFinalize = true;
  if (c.__EXTRACTED_TX) {
    tx = c.__EXTRACTED_TX;
    mustFinalize = false;
  } else {
    tx = c.__TX.clone();
  }
  inputFinalizeGetAmts(inputs, tx, c, mustFinalize);
  if (key === '__FEE_RATE') return c.__FEE_RATE!;
  else if (key === '__FEE') return c.__FEE!;
}

/**
 * This function must do two things:
 * 1. Check if the `input` can be finalized. If it can not be finalized, throw.
 *   ie. `Can not finalize input #${inputIndex}`
 * 2. Create the finalScriptSig and finalScriptWitness Buffers.
 */
type FinalScriptsFunc = (
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  script: Uint8Array, // The "meaningful" locking script Buffer (redeemScript for P2SH etc.)
  isSegwit: boolean, // Is it segwit?
  isP2SH: boolean, // Is it P2SH?
  isP2WSH: boolean, // Is it P2WSH?
) => {
  finalScriptSig: Uint8Array | undefined;
  finalScriptWitness: Uint8Array | undefined;
};
type FinalTaprootScriptsFunc = (
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  tapLeafHashToFinalize?: Uint8Array, // Only finalize this specific leaf
) => {
  finalScriptWitness: Uint8Array | undefined;
};

function getFinalScripts(
  inputIndex: number,
  input: PsbtInput,
  script: Uint8Array,
  isSegwit: boolean,
  isP2SH: boolean,
  isP2WSH: boolean,
): {
  finalScriptSig: Uint8Array | undefined;
  finalScriptWitness: Uint8Array | undefined;
} {
  const scriptType = classifyScript(script);
  if (!canFinalize(input, script, scriptType))
    throw new Error(`Can not finalize input #${inputIndex}`);
  return prepareFinalScripts(
    script,
    scriptType,
    input.partialSig!,
    isSegwit,
    isP2SH,
    isP2WSH,
  );
}

function prepareFinalScripts(
  script: Uint8Array,
  scriptType: string,
  partialSig: PartialSig[],
  isSegwit: boolean,
  isP2SH: boolean,
  isP2WSH: boolean,
): {
  finalScriptSig: Uint8Array | undefined;
  finalScriptWitness: Uint8Array | undefined;
} {
  let finalScriptSig: Uint8Array | undefined;
  let finalScriptWitness: Uint8Array | undefined;

  // Wow, the payments API is very handy
  const payment: payments.Payment = getPayment(script, scriptType, partialSig);
  const p2wsh = !isP2WSH ? null : payments.p2wsh({ redeem: payment });
  const p2sh = !isP2SH ? null : payments.p2sh({ redeem: p2wsh || payment });

  if (isSegwit) {
    if (p2wsh) {
      finalScriptWitness = witnessStackToScriptWitness(p2wsh.witness!);
    } else {
      finalScriptWitness = witnessStackToScriptWitness(payment.witness!);
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

function getHashAndSighashType(
  inputs: PsbtInput[],
  inputIndex: number,
  pubkey: Uint8Array,
  cache: PsbtCache,
  sighashTypes: number[],
): {
  hash: Uint8Array;
  sighashType: number;
} {
  const input = checkForInput(inputs, inputIndex);
  const { hash, sighashType, script } = getHashForSig(
    inputIndex,
    input,
    cache,
    false,
    sighashTypes,
  );
  checkScriptForPubkey(pubkey, script, 'sign');
  return {
    hash,
    sighashType,
  };
}

function getHashForSig(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
  forValidate: boolean,
  sighashTypes?: number[],
): {
  script: Uint8Array;
  hash: Uint8Array;
  sighashType: number;
} {
  const unsignedTx = cache.__TX;
  const sighashType = input.sighashType || Transaction.SIGHASH_ALL;
  checkSighashTypeAllowed(sighashType, sighashTypes);

  let hash: Uint8Array;
  let prevout: Output;

  if (input.nonWitnessUtxo) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
      cache,
      input,
      inputIndex,
    );

    const prevoutHash = unsignedTx.ins[inputIndex].hash;
    const utxoHash = nonWitnessUtxoTx.getHash();

    // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
    if (tools.compare(prevoutHash, utxoHash) !== 0) {
      throw new Error(
        `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`,
      );
    }

    const prevoutIndex = unsignedTx.ins[inputIndex].index;
    prevout = nonWitnessUtxoTx.outs[prevoutIndex] as Output;
  } else if (input.witnessUtxo) {
    prevout = input.witnessUtxo;
  } else {
    throw new Error('Need a Utxo input item for signing');
  }

  const { meaningfulScript, type } = getMeaningfulScript(
    prevout.script,
    inputIndex,
    'input',
    input.redeemScript,
    input.witnessScript,
  );

  if (['p2sh-p2wsh', 'p2wsh'].indexOf(type) >= 0) {
    hash = unsignedTx.hashForWitnessV0(
      inputIndex,
      meaningfulScript,
      prevout.value,
      sighashType,
    );
  } else if (isP2WPKH(meaningfulScript)) {
    // P2WPKH uses the P2PKH template for prevoutScript when signing
    const signingScript = payments.p2pkh({
      hash: meaningfulScript.slice(2),
    }).output!;
    hash = unsignedTx.hashForWitnessV0(
      inputIndex,
      signingScript,
      prevout.value,
      sighashType,
    );
  } else {
    // non-segwit
    if (
      input.nonWitnessUtxo === undefined &&
      cache.__UNSAFE_SIGN_NONSEGWIT === false
    )
      throw new Error(
        `Input #${inputIndex} has witnessUtxo but non-segwit script: ` +
          `${tools.toHex(meaningfulScript)}`,
      );
    if (!forValidate && cache.__UNSAFE_SIGN_NONSEGWIT !== false)
      console.warn(
        'Warning: Signing non-segwit inputs without the full parent transaction ' +
          'means there is a chance that a miner could feed you incorrect information ' +
          "to trick you into paying large fees. This behavior is the same as Psbt's predecessor " +
          '(TransactionBuilder - now removed) when signing non-segwit scripts. You are not ' +
          'able to export this Psbt with toBuffer|toBase64|toHex since it is not ' +
          'BIP174 compliant.\n*********************\nPROCEED WITH CAUTION!\n' +
          '*********************',
      );
    hash = unsignedTx.hashForSignature(
      inputIndex,
      meaningfulScript,
      sighashType,
    );
  }

  return {
    script: meaningfulScript,
    sighashType,
    hash,
  };
}

function getAllTaprootHashesForSig(
  inputIndex: number,
  input: PsbtInput,
  inputs: PsbtInput[],
  cache: PsbtCache,
): { pubkey: Uint8Array; hash: Uint8Array; leafHash?: Uint8Array }[] {
  const allPublicKeys = [];
  if (input.tapInternalKey) {
    const key = getPrevoutTaprootKey(inputIndex, input, cache);
    if (key) {
      allPublicKeys.push(key);
    }
  }

  if (input.tapScriptSig) {
    const tapScriptPubkeys = input.tapScriptSig.map(
      (tss: TapScriptSig) => tss.pubkey,
    );
    allPublicKeys.push(...tapScriptPubkeys);
  }

  const allHashes = allPublicKeys.map(publicKey =>
    getTaprootHashesForSig(inputIndex, input, inputs, publicKey, cache),
  );

  return allHashes.flat();
}

function getPrevoutTaprootKey(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): Uint8Array | null {
  const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
  return isP2TR(script) ? script.subarray(2, 34) : null;
}

function trimTaprootSig(signature: Uint8Array): Uint8Array {
  return signature.length === 64 ? signature : signature.subarray(0, 64);
}

function getTaprootHashesForSig(
  inputIndex: number,
  input: PsbtInput,
  inputs: PsbtInput[],
  pubkey: Uint8Array,
  cache: PsbtCache,
  tapLeafHashToSign?: Uint8Array,
  allowedSighashTypes?: number[],
): { pubkey: Uint8Array; hash: Uint8Array; leafHash?: Uint8Array }[] {
  const unsignedTx = cache.__TX;

  const sighashType = input.sighashType || Transaction.SIGHASH_DEFAULT;
  checkSighashTypeAllowed(sighashType, allowedSighashTypes);

  const prevOuts: Output[] = inputs.map((i, index) =>
    getScriptAndAmountFromUtxo(index, i, cache),
  );
  const signingScripts = prevOuts.map(o => o.script);
  const values = prevOuts.map(o => o.value);

  const hashes = [];
  if (input.tapInternalKey && !tapLeafHashToSign) {
    const outputKey =
      getPrevoutTaprootKey(inputIndex, input, cache) || Uint8Array.from([]);
    if (tools.compare(toXOnly(pubkey), outputKey) === 0) {
      const tapKeyHash = unsignedTx.hashForWitnessV1(
        inputIndex,
        signingScripts,
        values,
        sighashType,
      );
      hashes.push({ pubkey, hash: tapKeyHash });
    }
  }

  const tapLeafHashes = (input.tapLeafScript || [])
    .filter((tapLeaf: TapLeafScript) => pubkeyInScript(pubkey, tapLeaf.script))
    .map((tapLeaf: TapLeafScript) => {
      const hash = tapleafHash({
        output: tapLeaf.script,
        version: tapLeaf.leafVersion,
      });
      return Object.assign({ hash }, tapLeaf);
    })
    .filter(
      tapLeaf =>
        !tapLeafHashToSign ||
        tools.compare(tapLeafHashToSign, tapLeaf.hash) === 0,
    )
    .map(tapLeaf => {
      const tapScriptHash = unsignedTx.hashForWitnessV1(
        inputIndex,
        signingScripts,
        values,
        sighashType,
        tapLeaf.hash,
      );

      return {
        pubkey,
        hash: tapScriptHash,
        leafHash: tapLeaf.hash,
      };
    });

  return hashes.concat(tapLeafHashes);
}

function checkSighashTypeAllowed(
  sighashType: number,
  sighashTypes?: number[],
): void {
  if (sighashTypes && sighashTypes.indexOf(sighashType) < 0) {
    const str = sighashTypeToString(sighashType);
    throw new Error(
      `Sighash type is not allowed. Retry the sign method passing the ` +
        `sighashTypes array of whitelisted types. Sighash type: ${str}`,
    );
  }
}

function getPayment(
  script: Uint8Array,
  scriptType: string,
  partialSig: PartialSig[],
): payments.Payment {
  let payment: payments.Payment;
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
  return payment!;
}

interface GetScriptReturn {
  script: Uint8Array | null;
  isSegwit: boolean;
  isP2SH: boolean;
  isP2WSH: boolean;
}
function getScriptFromInput(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): GetScriptReturn {
  const unsignedTx = cache.__TX;
  const res: GetScriptReturn = {
    script: null,
    isSegwit: false,
    isP2SH: false,
    isP2WSH: false,
  };
  res.isP2SH = !!input.redeemScript;
  res.isP2WSH = !!input.witnessScript;
  if (input.witnessScript) {
    res.script = input.witnessScript;
  } else if (input.redeemScript) {
    res.script = input.redeemScript;
  } else {
    if (input.nonWitnessUtxo) {
      const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
        cache,
        input,
        inputIndex,
      );
      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      res.script = nonWitnessUtxoTx.outs[prevoutIndex].script;
    } else if (input.witnessUtxo) {
      res.script = input.witnessUtxo.script;
    }
  }
  if (input.witnessScript || isP2WPKH(res.script!)) {
    res.isSegwit = true;
  }
  return res;
}

function getSignersFromHD(
  inputIndex: number,
  inputs: PsbtInput[],
  hdKeyPair: HDSigner | HDSignerAsync,
): Array<Signer | SignerAsync> {
  const input = checkForInput(inputs, inputIndex);
  if (!input.bip32Derivation || input.bip32Derivation.length === 0) {
    throw new Error('Need bip32Derivation to sign with HD');
  }
  const myDerivations = input.bip32Derivation
    .map((bipDv: Bip32Derivation) => {
      if (tools.compare(bipDv.masterFingerprint, hdKeyPair.fingerprint) === 0) {
        return bipDv;
      } else {
        return;
      }
    })
    .filter((v: Bip32Derivation | undefined) => !!v) as Bip32Derivation[];
  if (myDerivations.length === 0) {
    throw new Error(
      'Need one bip32Derivation masterFingerprint to match the HDSigner fingerprint',
    );
  }
  const signers: Array<Signer | SignerAsync> = myDerivations.map(bipDv => {
    const node = hdKeyPair.derivePath(bipDv!.path);
    if (tools.compare(bipDv!.pubkey, node.publicKey) !== 0) {
      throw new Error('pubkey did not match bip32Derivation');
    }
    return node;
  });
  return signers;
}

function getSortedSigs(
  script: Uint8Array,
  partialSig: PartialSig[],
): Uint8Array[] {
  const p2ms = payments.p2ms({ output: script });
  // for each pubkey in order of p2ms script
  return p2ms
    .pubkeys!.map(pk => {
      // filter partialSig array by pubkey being equal
      return (
        partialSig.filter(ps => {
          return tools.compare(ps.pubkey, pk) === 0;
        })[0] || {}
      ).signature;
      // Any pubkey without a match will return undefined
      // this last filter removes all the undefined items in the array.
    })
    .filter(v => !!v);
}

function scriptWitnessToWitnessStack(buffer: Uint8Array): Uint8Array[] {
  let offset = 0;

  function readSlice(n: number): Uint8Array {
    offset += n;
    return buffer.slice(offset - n, offset);
  }

  function readVarInt(): number {
    const vi = varuint.decode(buffer, offset);
    offset += varuint.encodingLength(vi.bigintValue);
    return vi.numberValue!;
  }

  function readVarSlice(): Uint8Array {
    return readSlice(readVarInt());
  }

  function readVector(): Uint8Array[] {
    const count = readVarInt();
    const vector: Uint8Array[] = [];
    for (let i = 0; i < count; i++) vector.push(readVarSlice());
    return vector;
  }

  return readVector();
}

function sighashTypeToString(sighashType: number): string {
  let text =
    sighashType & Transaction.SIGHASH_ANYONECANPAY
      ? 'SIGHASH_ANYONECANPAY | '
      : '';
  const sigMod = sighashType & 0x1f;
  switch (sigMod) {
    case Transaction.SIGHASH_ALL:
      text += 'SIGHASH_ALL';
      break;
    case Transaction.SIGHASH_SINGLE:
      text += 'SIGHASH_SINGLE';
      break;
    case Transaction.SIGHASH_NONE:
      text += 'SIGHASH_NONE';
      break;
  }
  return text;
}

function addNonWitnessTxCache(
  cache: PsbtCache,
  input: PsbtInput,
  inputIndex: number,
): void {
  cache.__NON_WITNESS_UTXO_BUF_CACHE[inputIndex] = input.nonWitnessUtxo!;

  const tx = Transaction.fromBuffer(input.nonWitnessUtxo!);
  cache.__NON_WITNESS_UTXO_TX_CACHE[inputIndex] = tx;

  const self = cache;
  const selfIndex = inputIndex;
  delete input.nonWitnessUtxo;
  Object.defineProperty(input, 'nonWitnessUtxo', {
    enumerable: true,
    get(): Uint8Array {
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
    set(data: Uint8Array): void {
      self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = data;
    },
  });
}

function inputFinalizeGetAmts(
  inputs: PsbtInput[],
  tx: Transaction,
  cache: PsbtCache,
  mustFinalize: boolean,
): void {
  let inputAmount = 0n;
  inputs.forEach((input, idx) => {
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
      const nwTx = nonWitnessUtxoTxFromCache(cache, input, idx);
      const vout = tx.ins[idx].index;
      const out = nwTx.outs[vout] as Output;
      inputAmount += out.value;
    }
  });
  const outputAmount = (tx.outs as Output[]).reduce(
    (total, o) => total + o.value,
    0n,
  );
  const fee = inputAmount - outputAmount;
  if (fee < 0) {
    throw new Error('Outputs are spending more than Inputs');
  }
  const bytes = tx.virtualSize();
  cache.__FEE = fee;
  cache.__EXTRACTED_TX = tx;
  cache.__FEE_RATE = Math.floor(Number(fee / BigInt(bytes)));
}

function nonWitnessUtxoTxFromCache(
  cache: PsbtCache,
  input: PsbtInput,
  inputIndex: number,
): Transaction {
  const c = cache.__NON_WITNESS_UTXO_TX_CACHE;
  if (!c[inputIndex]) {
    addNonWitnessTxCache(cache, input, inputIndex);
  }
  return c[inputIndex];
}

function getScriptFromUtxo(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): Uint8Array {
  const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
  return script;
}

function getScriptAndAmountFromUtxo(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): { script: Uint8Array; value: bigint } {
  if (input.witnessUtxo !== undefined) {
    return {
      script: input.witnessUtxo.script,
      value: input.witnessUtxo.value,
    };
  } else if (input.nonWitnessUtxo !== undefined) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
      cache,
      input,
      inputIndex,
    );
    const o = nonWitnessUtxoTx.outs[cache.__TX.ins[inputIndex].index];
    return { script: o.script, value: o.value };
  } else {
    throw new Error("Can't find pubkey in input without Utxo data");
  }
}

function pubkeyInInput(
  pubkey: Uint8Array,
  input: PsbtInput,
  inputIndex: number,
  cache: PsbtCache,
): boolean {
  const script = getScriptFromUtxo(inputIndex, input, cache);
  const { meaningfulScript } = getMeaningfulScript(
    script,
    inputIndex,
    'input',
    input.redeemScript,
    input.witnessScript,
  );
  return pubkeyInScript(pubkey, meaningfulScript);
}

function pubkeyInOutput(
  pubkey: Uint8Array,
  output: PsbtOutput,
  outputIndex: number,
  cache: PsbtCache,
): boolean {
  const script = cache.__TX.outs[outputIndex].script;
  const { meaningfulScript } = getMeaningfulScript(
    script,
    outputIndex,
    'output',
    output.redeemScript,
    output.witnessScript,
  );
  return pubkeyInScript(pubkey, meaningfulScript);
}

function redeemFromFinalScriptSig(
  finalScript: Uint8Array | undefined,
): Uint8Array | undefined {
  if (!finalScript) return;
  const decomp = bscript.decompile(finalScript);
  if (!decomp) return;
  const lastItem = decomp[decomp.length - 1];
  if (
    !(lastItem instanceof Uint8Array) ||
    isPubkeyLike(lastItem) ||
    isSigLike(lastItem)
  )
    return;
  const sDecomp = bscript.decompile(lastItem);
  if (!sDecomp) return;
  return lastItem;
}

function redeemFromFinalWitnessScript(
  finalScript: Uint8Array | undefined,
): Uint8Array | undefined {
  if (!finalScript) return;
  const decomp = scriptWitnessToWitnessStack(finalScript);
  const lastItem = decomp[decomp.length - 1];
  if (isPubkeyLike(lastItem)) return;
  const sDecomp = bscript.decompile(lastItem);
  if (!sDecomp) return;
  return lastItem;
}

function compressPubkey(pubkey: Uint8Array): Uint8Array {
  if (pubkey.length === 65) {
    const parity = pubkey[64] & 1;
    const newKey = pubkey.slice(0, 33);
    newKey[0] = 2 | parity;
    return newKey;
  }
  return pubkey.slice();
}

function isPubkeyLike(buf: Uint8Array): boolean {
  return buf.length === 33 && bscript.isCanonicalPubKey(buf);
}

function isSigLike(buf: Uint8Array): boolean {
  return bscript.isCanonicalScriptSignature(buf);
}

function getMeaningfulScript(
  script: Uint8Array,
  index: number,
  ioType: 'input' | 'output',
  redeemScript?: Uint8Array,
  witnessScript?: Uint8Array,
): {
  meaningfulScript: Uint8Array;
  type: 'p2sh' | 'p2wsh' | 'p2sh-p2wsh' | 'raw';
} {
  const isP2SH = isP2SHScript(script);
  const isP2SHP2WSH = isP2SH && redeemScript && isP2WSHScript(redeemScript);
  const isP2WSH = isP2WSHScript(script);

  if (isP2SH && redeemScript === undefined)
    throw new Error('scriptPubkey is P2SH but redeemScript missing');
  if ((isP2WSH || isP2SHP2WSH) && witnessScript === undefined)
    throw new Error(
      'scriptPubkey or redeemScript is P2WSH but witnessScript missing',
    );

  let meaningfulScript: Uint8Array;

  if (isP2SHP2WSH) {
    meaningfulScript = witnessScript!;
    checkRedeemScript(index, script, redeemScript!, ioType);
    checkWitnessScript(index, redeemScript!, witnessScript!, ioType);
    checkInvalidP2WSH(meaningfulScript);
  } else if (isP2WSH) {
    meaningfulScript = witnessScript!;
    checkWitnessScript(index, script, witnessScript!, ioType);
    checkInvalidP2WSH(meaningfulScript);
  } else if (isP2SH) {
    meaningfulScript = redeemScript!;
    checkRedeemScript(index, script, redeemScript!, ioType);
  } else {
    meaningfulScript = script;
  }
  return {
    meaningfulScript,
    type: isP2SHP2WSH
      ? 'p2sh-p2wsh'
      : isP2SH
        ? 'p2sh'
        : isP2WSH
          ? 'p2wsh'
          : 'raw',
  };
}

function checkInvalidP2WSH(script: Uint8Array): void {
  if (isP2WPKH(script) || isP2SHScript(script)) {
    throw new Error('P2WPKH or P2SH can not be contained within P2WSH');
  }
}

type AllScriptType =
  | 'witnesspubkeyhash'
  | 'pubkeyhash'
  | 'multisig'
  | 'pubkey'
  | 'nonstandard'
  | 'p2sh-witnesspubkeyhash'
  | 'p2sh-pubkeyhash'
  | 'p2sh-multisig'
  | 'p2sh-pubkey'
  | 'p2sh-nonstandard'
  | 'p2wsh-pubkeyhash'
  | 'p2wsh-multisig'
  | 'p2wsh-pubkey'
  | 'p2wsh-nonstandard'
  | 'p2sh-p2wsh-pubkeyhash'
  | 'p2sh-p2wsh-multisig'
  | 'p2sh-p2wsh-pubkey'
  | 'p2sh-p2wsh-nonstandard';
type ScriptType =
  | 'witnesspubkeyhash'
  | 'pubkeyhash'
  | 'multisig'
  | 'pubkey'
  | 'nonstandard';
function classifyScript(script: Uint8Array): ScriptType {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}

function range(n: number): number[] {
  return [...Array(n).keys()];
}
