/// <reference types="node" />
export declare type BlankOutput = {
    script: Buffer;
    valueBuffer: Buffer;
};
export declare type Output = {
    script: Buffer;
    value: number;
};
export declare type Input = {
    hash: Buffer;
    index: number;
    script: Buffer;
    sequence: number;
    witness: Array<Buffer>;
};
export declare class Transaction {
    version: number;
    locktime: number;
    ins: Array<Input>;
    outs: Array<Output | BlankOutput>;
    static readonly DEFAULT_SEQUENCE = 4294967295;
    static readonly SIGHASH_ALL = 1;
    static readonly SIGHASH_NONE = 2;
    static readonly SIGHASH_SINGLE = 3;
    static readonly SIGHASH_ANYONECANPAY = 128;
    static readonly ADVANCED_TRANSACTION_MARKER = 0;
    static readonly ADVANCED_TRANSACTION_FLAG = 1;
    constructor();
    static fromBuffer(buffer: Buffer, __noStrict?: boolean): Transaction;
    static fromHex(hex: string): Transaction;
    static isCoinbaseHash(buffer: Buffer): boolean;
    isCoinbase(): boolean;
    addInput(hash: Buffer, index: number, sequence?: number, scriptSig?: Buffer): number;
    addOutput(scriptPubKey: Buffer, value: number): number;
    hasWitnesses(): boolean;
    weight(): number;
    virtualSize(): number;
    byteLength(): number;
    private __byteLength;
    clone(): Transaction;
    /**
     * Hash transaction for signing a specific input.
     *
     * Bitcoin uses a different hash for each signed transaction input.
     * This method copies the transaction, makes the necessary changes based on the
     * hashType, and then hashes the result.
     * This hash can then be used to sign the provided transaction input.
     */
    hashForSignature(inIndex: number, prevOutScript: Buffer, hashType: number): Buffer;
    hashForWitnessV0(inIndex: number, prevOutScript: Buffer, value: number, hashType: number): Buffer;
    getHash(): Buffer;
    getId(): string;
    toBuffer(buffer?: Buffer, initialOffset?: number): Buffer;
    private __toBuffer;
    toHex(): string;
    setInputScript(index: number, scriptSig: Buffer): void;
    setWitness(index: number, witness: Array<Buffer>): void;
}
