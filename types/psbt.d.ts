/// <reference types="node" />
import { Psbt as PsbtBase } from 'bip174';
import { TransactionOutput } from 'bip174/src/lib/interfaces';
import { Signer, SignerAsync } from './ecpair';
import { Network } from './networks';
import { Transaction } from './transaction';
export declare class Psbt extends PsbtBase {
    private opts;
    constructor(opts?: PsbtOptsOptional);
    addOutput(outputData: TransactionOutput, allowNoInput?: boolean): this;
    addOutput<T>(outputData: T, allowNoInput?: boolean, transactionOutputAdder?: (output: T, txBuffer: Buffer) => Buffer): this;
    extractTransaction(): Transaction;
    finalizeAllInputs(): {
        result: boolean;
        inputResults: boolean[];
    };
    finalizeInput(inputIndex: number): boolean;
    signInput(inputIndex: number, keyPair: Signer): Psbt;
    signInputAsync(inputIndex: number, keyPair: SignerAsync): Promise<void>;
}
interface PsbtOptsOptional {
    network?: Network;
}
export {};
