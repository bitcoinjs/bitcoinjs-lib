/// <reference types="node" />
export interface Output<TNumber extends number | bigint = number> {
    script: Buffer;
    value: TNumber;
}
export interface Input {
    hash: Buffer;
    index: number;
    script: Buffer;
    sequence: number;
    witness: Buffer[];
}
export declare class Transaction<TNumber extends number | bigint = number> {
    static readonly DEFAULT_SEQUENCE = 4294967295;
    static readonly SIGHASH_DEFAULT = 0;
    static readonly SIGHASH_ALL = 1;
    static readonly SIGHASH_NONE = 2;
    static readonly SIGHASH_SINGLE = 3;
    static readonly SIGHASH_ANYONECANPAY = 128;
    static readonly SIGHASH_OUTPUT_MASK = 3;
    static readonly SIGHASH_INPUT_MASK = 128;
    static readonly ADVANCED_TRANSACTION_MARKER = 0;
    static readonly ADVANCED_TRANSACTION_FLAG = 1;
    static fromBuffer<TNumber extends number | bigint = number>(buffer: Buffer, _NO_STRICT?: boolean, amountType?: 'number' | 'bigint'): Transaction<TNumber>;
    static fromHex<TNumber extends number | bigint = number>(hex: string, amountType?: 'number' | 'bigint'): Transaction<TNumber>;
    static isCoinbaseHash(buffer: Buffer): boolean;
    version: number;
    locktime: number;
    ins: Input[];
    outs: Array<Output<TNumber>>;
    isCoinbase(): boolean;
    addInput(hash: Buffer, index: number, sequence?: number, scriptSig?: Buffer): number;
    addOutput(scriptPubKey: Buffer, value: TNumber): number;
    hasWitnesses(): boolean;
    weight(): number;
    virtualSize(): number;
    byteLength(_ALLOW_WITNESS?: boolean): number;
    clone(): Transaction<TNumber>;
    /**
     * Hash transaction for signing a specific input.
     *
     * Bitcoin uses a different hash for each signed transaction input.
     * This method copies the transaction, makes the necessary changes based on the
     * hashType, and then hashes the result.
     * This hash can then be used to sign the provided transaction input.
     */
    hashForSignature(inIndex: number, prevOutScript: Buffer, hashType: number, prevOutValue?: TNumber): Buffer;
    hashForWitnessV1(inIndex: number, prevOutScripts: Buffer[], values: TNumber[], hashType: number, leafHash?: Buffer, annex?: Buffer): Buffer;
    hashForWitnessV0(inIndex: number, prevOutScript: Buffer, value: TNumber, hashType: number): Buffer;
    getHash(forWitness?: boolean): Buffer;
    getId(): string;
    toBuffer(buffer?: Buffer, initialOffset?: number): Buffer;
    toHex(): string;
    setInputScript(index: number, scriptSig: Buffer): void;
    setWitness(index: number, witness: Buffer[]): void;
    private __toBuffer;
}
