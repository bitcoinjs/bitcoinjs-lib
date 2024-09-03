import * as varuint from 'varuint-bitcoin';
export { varuint };
/**
 * Reverses the order of bytes in a buffer.
 * @param buffer - The buffer to reverse.
 * @returns A new buffer with the bytes reversed.
 */
export declare function reverseBuffer(buffer: Uint8Array): Uint8Array;
export declare function cloneBuffer(buffer: Uint8Array): Uint8Array;
/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
export declare class BufferWriter {
    buffer: Uint8Array;
    offset: number;
    static withCapacity(size: number): BufferWriter;
    constructor(buffer: Uint8Array, offset?: number);
    writeUInt8(i: number): void;
    writeInt32(i: number): void;
    writeInt64(i: number | bigint): void;
    writeUInt32(i: number): void;
    writeUInt64(i: number | bigint): void;
    writeVarInt(i: number): void;
    writeSlice(slice: Uint8Array): void;
    writeVarSlice(slice: Uint8Array): void;
    writeVector(vector: Uint8Array[]): void;
    end(): Uint8Array;
}
/**
 * Helper class for reading of bitcoin data types from a buffer.
 */
export declare class BufferReader {
    buffer: Uint8Array;
    offset: number;
    constructor(buffer: Uint8Array, offset?: number);
    readUInt8(): number;
    readInt32(): number;
    readUInt32(): number;
    readInt64(): bigint;
    readVarInt(): bigint;
    readSlice(n: number | bigint): Uint8Array;
    readVarSlice(): Uint8Array;
    readVector(): Uint8Array[];
}
