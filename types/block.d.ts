import { Transaction } from './transaction';
export declare class Block {
    static fromBuffer(buffer: Buffer): Block;
    static fromHex(hex: string): Block;
    static calculateTarget(bits: number): Buffer;
    static calculateMerkleRoot(transactions: Transaction[], forWitness?: boolean): Buffer;
    version: number;
    prevHash?: Buffer;
    merkleRoot?: Buffer;
    timestamp: number;
    witnessCommit?: Buffer;
    bits: number;
    nonce: number;
    transactions?: Transaction[];
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
