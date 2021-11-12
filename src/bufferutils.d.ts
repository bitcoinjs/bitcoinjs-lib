/// <reference types="node" />
import * as varuint from 'varuint-bitcoin';
export { varuint };
export declare function readUInt64LE(buffer: Buffer, offset: number): number;
export declare function writeUInt64LE(buffer: Buffer, value: number, offset: number): number;
export declare function reverseBuffer(buffer: Buffer): Buffer;
export declare function cloneBuffer(buffer: Buffer): Buffer;
/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
export declare class BufferWriter {
    buffer: Buffer;
    offset: number;
    static withCapacity(size: number): BufferWriter;
    constructor(buffer: Buffer, offset?: number);
    writeUInt8(i: number): void;
    writeInt32(i: number): void;
    writeUInt32(i: number): void;
    writeUInt64(i: number): void;
    writeVarInt(i: number): void;
    writeSlice(slice: Buffer): void;
    writeVarSlice(slice: Buffer): void;
    writeVector(vector: Buffer[]): void;
    end(): Buffer;
}
/**
 * Helper class for reading of bitcoin data types from a buffer.
 */
export declare class BufferReader {
    buffer: Buffer;
    offset: number;
    constructor(buffer: Buffer, offset?: number);
    readUInt8(): number;
    readInt32(): number;
    readUInt32(): number;
    readUInt64(): number;
    readVarInt(): number;
    readSlice(n: number): Buffer;
    readVarSlice(): Buffer;
    readVector(): Buffer[];
}
