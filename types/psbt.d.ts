import { Psbt as PsbtBase } from 'bip174';
import { Signer } from './ecpair';
import { Network } from './networks';
import { Transaction } from './transaction';
export declare class Psbt extends PsbtBase {
    network?: Network | undefined;
    constructor(network?: Network | undefined);
    extractTransaction(): Transaction;
    finalizeAllInputs(): {
        result: boolean;
        inputResults: boolean[];
    };
    finalizeInput(inputIndex: number): boolean;
    signInput(inputIndex: number, keyPair: Signer): Psbt;
}
