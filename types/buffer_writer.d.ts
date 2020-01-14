/**
 * Helper class for serialization of bitcoin data types into a pre-allocated buffer.
 */
export declare class BufferWriter {
    buffer: Buffer;
    offset: number;
    constructor(buffer: Buffer, offset?: number);
    writeUInt8(i: number): void;
    writeInt32(i: number): void;
    writeUInt32(i: number): void;
    writeUInt64(i: number): void;
    writeVarInt(i: number): void;
    writeSlice(slice: Buffer): void;
    writeVarSlice(slice: Buffer): void;
    writeVector(vector: Buffer[]): void;
}
