/// <reference types="node" />
import { OPS } from './ops';
import { Stack } from './payments';
import * as scriptNumber from './script_number';
import * as scriptSignature from './script_signature';
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
export declare function compile(chunks: Buffer | Stack): Buffer;
export declare function decompile(buffer: Buffer | Array<number | Buffer>): Array<number | Buffer> | null;
/**
 * Converts the given chunks into an ASM (Assembly) string representation.
 * If the chunks parameter is a Buffer, it will be decompiled into a Stack before conversion.
 * @param chunks - The chunks to convert into ASM.
 * @returns The ASM string representation of the chunks.
 */
export declare function toASM(chunks: Buffer | Array<number | Buffer>): string;
/**
 * Converts an ASM string to a Buffer.
 * @param asm The ASM string to convert.
 * @returns The converted Buffer.
 */
export declare function fromASM(asm: string): Buffer;
/**
 * Converts the given chunks into a stack of buffers.
 *
 * @param chunks - The chunks to convert.
 * @returns The stack of buffers.
 */
export declare function toStack(chunks: Buffer | Array<number | Buffer>): Buffer[];
export declare function isCanonicalPubKey(buffer: Buffer): boolean;
export declare function isDefinedHashType(hashType: number): boolean;
export declare function isCanonicalScriptSignature(buffer: Buffer): boolean;
export declare const number: typeof scriptNumber;
export declare const signature: typeof scriptSignature;
