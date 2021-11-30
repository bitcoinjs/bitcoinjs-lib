import { Stack } from './payments';
import * as scriptNumber from './script_number';
import * as scriptSignature from './script_signature';
export declare type OpCode = number;
export declare const OPS: {
    [index: string]: number;
};
export declare function isPushOnly(value: Stack): boolean;
export declare function compile(chunks: Buffer | Stack): Buffer;
export declare function decompile(buffer: Buffer | Array<number | Buffer>): Array<number | Buffer> | null;
export declare function toASM(chunks: Buffer | Array<number | Buffer>): string;
export declare function fromASM(asm: string): Buffer;
export declare function toStack(chunks: Buffer | Array<number | Buffer>): Buffer[];
export declare function isCanonicalPubKey(buffer: Buffer): boolean;
export declare function isDefinedHashType(hashType: number): boolean;
export declare function isCanonicalScriptSignature(buffer: Buffer): boolean;
export declare const number: typeof scriptNumber;
export declare const signature: typeof scriptSignature;
