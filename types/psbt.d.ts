/// <reference types="node" />
import { Psbt as PsbtBase } from 'bip174';
import { KeyValue, PsbtGlobalUpdate, PsbtInputUpdate, PsbtOutputUpdate, TransactionInput, TransactionOutput } from 'bip174/src/lib/interfaces';
import { Signer, SignerAsync } from './ecpair';
import { Network } from './networks';
import { Transaction } from './transaction';
export declare class Psbt {
    readonly data: PsbtBase;
    static fromTransaction(txBuf: Buffer, opts?: PsbtOptsOptional): Psbt;
    static fromBase64(data: string, opts?: PsbtOptsOptional): Psbt;
    static fromHex(data: string, opts?: PsbtOptsOptional): Psbt;
    static fromBuffer(buffer: Buffer, opts?: PsbtOptsOptional): Psbt;
    unsignedTx: Buffer;
    private __CACHE;
    private opts;
    constructor(opts?: PsbtOptsOptional, data?: PsbtBase);
    readonly inputCount: number;
    combine(...those: Psbt[]): this;
    clone(): Psbt;
    setMaximumFeeRate(satoshiPerByte: number): void;
    setVersion(version: number): this;
    setLocktime(locktime: number): this;
    setSequence(inputIndex: number, sequence: number): this;
    addInputs(inputDatas: TransactionInput[]): this;
    addInput(inputData: TransactionInput): this;
    addOutputs(outputDatas: TransactionOutput[]): this;
    addOutput(outputData: TransactionOutput): this;
    extractTransaction(disableFeeCheck?: boolean): Transaction;
    getFeeRate(): number;
    finalizeAllInputs(): this;
    finalizeInput(inputIndex: number): this;
    validateAllSignatures(): boolean;
    validateSignatures(inputIndex: number, pubkey?: Buffer): boolean;
    sign(keyPair: Signer, sighashTypes?: number[]): this;
    signAsync(keyPair: SignerAsync, sighashTypes?: number[]): Promise<void>;
    signInput(inputIndex: number, keyPair: Signer, sighashTypes?: number[]): this;
    signInputAsync(inputIndex: number, keyPair: SignerAsync, sighashTypes?: number[]): Promise<void>;
    toBuffer(): Buffer;
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
export {};
