/// <reference types="node" />
import { Transaction } from './transaction';
export declare class Block<TNumber extends number | bigint = number> {
    static fromBuffer<TNumber extends number | bigint = number>(buffer: Buffer, amountType?: 'number' | 'bigint'): Block<TNumber>;
    static fromHex<TNumber extends number | bigint = number>(hex: string, amountType?: 'number' | 'bigint'): Block<TNumber>;
    static calculateTarget(bits: number): Buffer;
    static calculateMerkleRoot<TNumber extends number | bigint = number>(transactions: Array<Transaction<TNumber>>, forWitness?: boolean): Buffer;
    version: number;
    prevHash?: Buffer;
    merkleRoot?: Buffer;
    timestamp: number;
    witnessCommit?: Buffer;
    bits: number;
    nonce: number;
    transactions?: Array<Transaction<TNumber>>;
    getWitnessCommit(): Buffer | null;
    hasWitnessCommit(): boolean;
    hasWitness(): boolean;
    weight(): number;
    byteLength(headersOnly?: boolean, allowWitness?: boolean): number;
    getHash(): Buffer;
    getId(): string;
    getUTCDate(): Date;
    toBuffer(headersOnly?: boolean): Buffer;
    toHex(headersOnly?: boolean): string;
    checkTxRoots(): boolean;
    checkProofOfWork(): boolean;
    private __checkMerkleRoot;
    private __checkWitnessCommit;
}
