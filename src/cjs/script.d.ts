import { OPS } from './ops.js';
import { Stack } from './payments/index.js';
import * as scriptNumber from './script_number.js';
import * as scriptSignature from './script_signature.js';
export { OPS };
export declare function isPushOnly(value: Stack): boolean;
export declare function countNonPushOnlyOPs(value: Stack): number;
/**
 * Compiles an array of chunks into a Buffer.
 *
 * @param chunks - The array of chunks to compile.
 * @returns The compiled Buffer.
 * @throws Error if the compilation fails.
 */
export declare function compile(chunks: Uint8Array | Stack): Uint8Array;
export declare function decompile(buffer: Uint8Array | Array<number | Uint8Array>): Array<number | Uint8Array> | null;
/**
 * Converts the given chunks into an ASM (Assembly) string representation.
 * If the chunks parameter is a Buffer, it will be decompiled into a Stack before conversion.
 * @param chunks - The chunks to convert into ASM.
 * @returns The ASM string representation of the chunks.
 */
export declare function toASM(chunks: Uint8Array | Array<number | Uint8Array>): string;
/**
 * Converts an ASM string to a Buffer.
 * @param asm The ASM string to convert.
 * @returns The converted Buffer.
 */
export declare function fromASM(asm: string): Uint8Array;
/**
 * Converts the given chunks into a stack of buffers.
 *
 * @param chunks - The chunks to convert.
 * @returns The stack of buffers.
 */
export declare function toStack(chunks: Uint8Array | Array<number | Uint8Array>): Uint8Array[];
export declare function isCanonicalPubKey(buffer: Uint8Array): boolean;
export declare function isDefinedHashType(hashType: number): boolean;
export declare function isCanonicalScriptSignature(buffer: Uint8Array): boolean;
export declare const number: typeof scriptNumber;
export declare const signature: typeof scriptSignature;
