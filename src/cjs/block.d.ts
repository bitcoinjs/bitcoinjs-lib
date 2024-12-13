import { Transaction } from './transaction.js';
export declare class Block {
    static fromBuffer(buffer: Uint8Array): Block;
    static fromHex(hex: string): Block;
    static calculateTarget(bits: number): Uint8Array;
    static calculateMerkleRoot(transactions: Transaction[], forWitness?: boolean): Uint8Array;
    version: number;
    prevHash?: Uint8Array;
    merkleRoot?: Uint8Array;
    timestamp: number;
    witnessCommit?: Uint8Array;
    bits: number;
    nonce: number;
    transactions?: Transaction[];
    getWitnessCommit(): Uint8Array | null;
    hasWitnessCommit(): boolean;
    hasWitness(): boolean;
    weight(): number;
    byteLength(headersOnly?: boolean, allowWitness?: boolean): number;
    getHash(): Uint8Array;
    getId(): string;
    getUTCDate(): Date;
    toBuffer(headersOnly?: boolean): Uint8Array;
    toHex(headersOnly?: boolean): string;
    checkTxRoots(): boolean;
    checkProofOfWork(): boolean;
    private __checkMerkleRoot;
    private __checkWitnessCommit;
}
