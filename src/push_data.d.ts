/// <reference types="node" />
export declare function encodingLength(i: number): number;
export declare function encode(buffer: Buffer, num: number, offset: number): number;
export declare function decode(buffer: Buffer, offset: number): {
    opcode: number;
    number: number;
    size: number;
} | null;
