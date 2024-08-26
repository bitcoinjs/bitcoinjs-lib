import { Psbt as PsbtBase } from 'bip174';
import { KeyValue, PsbtGlobalUpdate, PsbtInput, PsbtInputUpdate, PsbtOutput, PsbtOutputUpdate } from 'bip174';
import { Network } from './networks.js';
import { Transaction } from './transaction.js';
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
export type ValidateSigFunction = (pubkey: Uint8Array, msghash: Uint8Array, signature: Uint8Array) => boolean;
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
export declare class Psbt {
    readonly data: PsbtBase;
    static fromBase64(data: string, opts?: PsbtOptsOptional): Psbt;
    static fromHex(data: string, opts?: PsbtOptsOptional): Psbt;
    static fromBuffer(buffer: Uint8Array, opts?: PsbtOptsOptional): Psbt;
    private __CACHE;
    private opts;
    constructor(opts?: PsbtOptsOptional, data?: PsbtBase);
    get inputCount(): number;
    get version(): number;
    set version(version: number);
    get locktime(): number;
    set locktime(locktime: number);
    get txInputs(): PsbtTxInput[];
    get txOutputs(): PsbtTxOutput[];
    combine(...those: Psbt[]): this;
    clone(): Psbt;
    setMaximumFeeRate(satoshiPerByte: number): void;
    setVersion(version: number): this;
    setLocktime(locktime: number): this;
    setInputSequence(inputIndex: number, sequence: number): this;
    addInputs(inputDatas: PsbtInputExtended[]): this;
    addInput(inputData: PsbtInputExtended): this;
    addOutputs(outputDatas: PsbtOutputExtended[]): this;
    addOutput(outputData: PsbtOutputExtended): this;
    extractTransaction(disableFeeCheck?: boolean): Transaction;
    getFeeRate(): number;
    getFee(): bigint;
    finalizeAllInputs(): this;
    finalizeInput(inputIndex: number, finalScriptsFunc?: FinalScriptsFunc | FinalTaprootScriptsFunc): this;
    finalizeTaprootInput(inputIndex: number, tapLeafHashToFinalize?: Uint8Array, finalScriptsFunc?: FinalTaprootScriptsFunc): this;
    private _finalizeInput;
    private _finalizeTaprootInput;
    getInputType(inputIndex: number): AllScriptType;
    inputHasPubkey(inputIndex: number, pubkey: Uint8Array): boolean;
    inputHasHDKey(inputIndex: number, root: HDSigner): boolean;
    outputHasPubkey(outputIndex: number, pubkey: Uint8Array): boolean;
    outputHasHDKey(outputIndex: number, root: HDSigner): boolean;
    validateSignaturesOfAllInputs(validator: ValidateSigFunction): boolean;
    validateSignaturesOfInput(inputIndex: number, validator: ValidateSigFunction, pubkey?: Uint8Array): boolean;
    private _validateSignaturesOfInput;
    private validateSignaturesOfTaprootInput;
    signAllInputsHD(hdKeyPair: HDSigner, sighashTypes?: number[]): this;
    signAllInputsHDAsync(hdKeyPair: HDSigner | HDSignerAsync, sighashTypes?: number[]): Promise<void>;
    signInputHD(inputIndex: number, hdKeyPair: HDSigner, sighashTypes?: number[]): this;
    signInputHDAsync(inputIndex: number, hdKeyPair: HDSigner | HDSignerAsync, sighashTypes?: number[]): Promise<void>;
    signAllInputs(keyPair: Signer, sighashTypes?: number[]): this;
    signAllInputsAsync(keyPair: Signer | SignerAsync, sighashTypes?: number[]): Promise<void>;
    signInput(inputIndex: number, keyPair: Signer, sighashTypes?: number[]): this;
    signTaprootInput(inputIndex: number, keyPair: Signer, tapLeafHashToSign?: Uint8Array, sighashTypes?: number[]): this;
    private _signInput;
    private _signTaprootInput;
    signInputAsync(inputIndex: number, keyPair: Signer | SignerAsync, sighashTypes?: number[]): Promise<void>;
    signTaprootInputAsync(inputIndex: number, keyPair: Signer | SignerAsync, tapLeafHash?: Uint8Array, sighashTypes?: number[]): Promise<void>;
    private _signInputAsync;
    private _signTaprootInputAsync;
    private checkTaprootHashesForSig;
    toBuffer(): Uint8Array;
    toHex(): string;
    toBase64(): string;
    updateGlobal(updateData: PsbtGlobalUpdate): this;
    updateInput(inputIndex: number, updateData: PsbtInputUpdate): this;
    updateOutput(outputIndex: number, updateData: PsbtOutputUpdate): this;
    addUnknownKeyValToGlobal(keyVal: KeyValue): this;
    addUnknownKeyValToInput(inputIndex: number, keyVal: KeyValue): this;
    addUnknownKeyValToOutput(outputIndex: number, keyVal: KeyValue): this;
    clearFinalizedInput(inputIndex: number): this;
}
interface PsbtOptsOptional {
    network?: Network;
    maximumFeeRate?: number;
}
interface PsbtInputExtended extends PsbtInput, TransactionInput {
}
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
 * This function must do two things:
 * 1. Check if the `input` can be finalized. If it can not be finalized, throw.
 *   ie. `Can not finalize input #${inputIndex}`
 * 2. Create the finalScriptSig and finalScriptWitness Buffers.
 */
type FinalScriptsFunc = (inputIndex: number, // Which input is it?
input: PsbtInput, // The PSBT input contents
script: Uint8Array, // The "meaningful" locking script Buffer (redeemScript for P2SH etc.)
isSegwit: boolean, // Is it segwit?
isP2SH: boolean, // Is it P2SH?
isP2WSH: boolean) => {
    finalScriptSig: Uint8Array | undefined;
    finalScriptWitness: Uint8Array | undefined;
};
type FinalTaprootScriptsFunc = (inputIndex: number, // Which input is it?
input: PsbtInput, // The PSBT input contents
tapLeafHashToFinalize?: Uint8Array) => {
    finalScriptWitness: Uint8Array | undefined;
};
type AllScriptType = 'witnesspubkeyhash' | 'pubkeyhash' | 'multisig' | 'pubkey' | 'nonstandard' | 'p2sh-witnesspubkeyhash' | 'p2sh-pubkeyhash' | 'p2sh-multisig' | 'p2sh-pubkey' | 'p2sh-nonstandard' | 'p2wsh-pubkeyhash' | 'p2wsh-multisig' | 'p2wsh-pubkey' | 'p2wsh-nonstandard' | 'p2sh-p2wsh-pubkeyhash' | 'p2sh-p2wsh-multisig' | 'p2sh-p2wsh-pubkey' | 'p2sh-p2wsh-nonstandard';
export {};
