/// <reference types="node" />
import { Psbt as PsbtBase } from 'bip174';
import { NonWitnessUtxo, TransactionInput, TransactionOutput } from 'bip174/src/lib/interfaces';
import { Signer, SignerAsync } from './ecpair';
import { Network } from './networks';
import { Transaction } from './transaction';
export declare class Psbt extends PsbtBase {
    static fromTransaction<T extends typeof PsbtBase>(this: T, txBuf: Buffer): InstanceType<T>;
    static fromBuffer<T extends typeof PsbtBase>(this: T, buffer: Buffer): InstanceType<T>;
    private __CACHE;
    private opts;
    constructor(opts?: PsbtOptsOptional);
    readonly inputCount: number;
    clone(): Psbt;
    setMaximumFeeRate(satoshiPerByte: number): void;
    setVersion(version: number): this;
    setLocktime(locktime: number): this;
    setSequence(inputIndex: number, sequence: number): this;
    addInputs(inputDatas: TransactionInput[]): this;
    addInput(inputData: TransactionInput): this;
    addOutputs(outputDatas: TransactionOutput[]): this;
    addOutput(outputData: TransactionOutput): this;
    addNonWitnessUtxoToInput(inputIndex: number, nonWitnessUtxo: NonWitnessUtxo): this;
    extractTransaction(disableFeeCheck?: boolean): Transaction;
    getFeeRate(): number;
    finalizeAllInputs(): this;
    finalizeInput(inputIndex: number): this;
    validateAllSignatures(): boolean;
    validateSignatures(inputIndex: number, pubkey?: Buffer): boolean;
    sign(keyPair: Signer): this;
    signAsync(keyPair: SignerAsync): Promise<void>;
    signInput(inputIndex: number, keyPair: Signer): this;
    signInputAsync(inputIndex: number, keyPair: SignerAsync): Promise<void>;
}
interface PsbtOptsOptional {
    network?: Network;
    maximumFeeRate?: number;
}
export {};
