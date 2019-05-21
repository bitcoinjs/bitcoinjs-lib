/// <reference types="node" />
import { ECPairInterface } from './ecpair';
import { Network } from './networks';
import { Transaction } from './transaction';
export declare class TransactionBuilder {
    network: Network;
    maximumFeeRate: number;
    static fromTransaction(transaction: Transaction, network?: Network): TransactionBuilder;
    private __PREV_TX_SET;
    private __INPUTS;
    private __TX;
    private __USE_LOW_R;
    constructor(network?: Network, maximumFeeRate?: number);
    setLowR(setting?: boolean): boolean;
    setLockTime(locktime: number): void;
    setVersion(version: number): void;
    addInput(txHash: Buffer | string | Transaction, vout: number, sequence?: number, prevOutScript?: Buffer): number;
    addOutput(scriptPubKey: string | Buffer, value: number): number;
    build(): Transaction;
    buildIncomplete(): Transaction;
    sign(vin: number, keyPair: ECPairInterface, redeemScript?: Buffer, hashType?: number, witnessValue?: number, witnessScript?: Buffer): void;
    private __addInputUnsafe;
    private __build;
    private __canModifyInputs;
    private __needsOutputs;
    private __canModifyOutputs;
    private __overMaximumFees;
}
