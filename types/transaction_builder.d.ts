/// <reference types="node" />
import { Network } from './networks';
import { Transaction } from './transaction';
import { ECPairInterface } from './ecpair';
export declare class TransactionBuilder {
    network: Network;
    maximumFeeRate: number;
    private __prevTxSet;
    private __inputs;
    private __tx;
    constructor(network?: Network, maximumFeeRate?: number);
    static fromTransaction(transaction: Transaction, network?: Network): TransactionBuilder;
    setLockTime(locktime: number): void;
    setVersion(version: number): void;
    addInput(txHash: Buffer | string | Transaction, vout: number, sequence: number, prevOutScript: Buffer): number;
    private __addInputUnsafe;
    addOutput(scriptPubKey: string | Buffer, value: number): number;
    build(): Transaction;
    buildIncomplete(): Transaction;
    private __build;
    sign(vin: number, keyPair: ECPairInterface, redeemScript: Buffer, hashType: number, witnessValue: number, witnessScript: Buffer): void;
    private __canModifyInputs;
    private __needsOutputs;
    private __canModifyOutputs;
    private __overMaximumFees;
}
