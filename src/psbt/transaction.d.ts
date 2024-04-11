/// <reference types="node" />
import { Transaction } from '../transaction';
import { Transaction as ITransaction, TransactionFromBuffer } from 'bip174/src/lib/interfaces';
/**
 * This class implements the Transaction interface from bip174 library.
 * It contains a bitcoinjs-lib Transaction object.
 */
export declare class PsbtTransaction implements ITransaction {
    tx: Transaction;
    constructor(buffer?: Buffer);
    getInputOutputCounts(): {
        inputCount: number;
        outputCount: number;
    };
    addInput(input: any): void;
    addOutput(output: any): void;
    toBuffer(): Buffer;
    checkTxEmpty(tx: Transaction): void;
}
/**
 * This function is needed to pass to the bip174 base class's fromBuffer.
 * It takes the "transaction buffer" portion of the psbt buffer and returns a
 * Transaction (From the bip174 library) interface.
 */
export declare const transactionFromBuffer: TransactionFromBuffer;
