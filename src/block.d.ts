/// <reference types="node" />
import { Transaction } from './transaction';
export declare class Block {
    version: number;
    prevHash?: Buffer;
    merkleRoot?: Buffer;
    timestamp: number;
    bits: number;
    nonce: number;
    transactions?: Array<Transaction>;
    constructor();
    static fromBuffer(buffer: Buffer): Block;
    static fromHex(hex: string): Block;
    static calculateTarget(bits: number): Buffer;
    static calculateMerkleRoot(transactions: Array<Transaction>): Buffer;
    hasWitnessCommit(): boolean;
    byteLength(headersOnly: boolean): number;
    getHash(): Buffer;
    getId(): string;
    getUTCDate(): Date;
    toBuffer(headersOnly: boolean): Buffer;
    toHex(headersOnly: boolean): string;
    checkMerkleRoot(): boolean;
    checkProofOfWork(): boolean;
}
