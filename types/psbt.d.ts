import { Psbt as PsbtBase } from 'bip174';
import { TransactionInput, TransactionOutput } from 'bip174/src/lib/interfaces';
import { Signer, SignerAsync } from './ecpair';
import { Network } from './networks';
import { Transaction } from './transaction';
export declare class Psbt extends PsbtBase {
    private __TX;
    private __TX_BUF_CACHE?;
    private opts;
    constructor(opts?: PsbtOptsOptional);
    addInput(inputData: TransactionInput): this;
    addOutput(outputData: TransactionOutput): this;
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
