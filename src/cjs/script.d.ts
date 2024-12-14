/**
 * Script tools module for working with Bitcoin scripts.
 * Provides utilities such as decompiling, compiling, converting to/from ASM, stack manipulation,
 * and script validation functions.
 *
 * @packageDocumentation
 */
import { OPS } from './ops.js';
import { Stack } from './payments/index.js';
import * as scriptNumber from './script_number.js';
import * as scriptSignature from './script_signature.js';
export { OPS };
/**
 * Determines if a stack consists of only push operations.
 *
 * @param value - The stack to check.
 * @returns True if all elements in the stack are push-only, false otherwise.
 */
export declare function isPushOnly(value: Stack): boolean;
/**
 * Counts the number of non-push-only opcodes in a stack.
 *
 * @param value - The stack to analyze.
 * @returns The count of non-push-only opcodes.
 */
export declare function countNonPushOnlyOPs(value: Stack): number;
/**
 * Compiles an array of script chunks into a Uint8Array.
 *
 * @param chunks - The chunks to compile.
 * @returns The compiled script as a Uint8Array.
 * @throws Error if compilation fails.
 */
export declare function compile(chunks: Uint8Array | Stack): Uint8Array;
/**
 * Decompiles a script buffer into an array of chunks.
 *
 * @param buffer - The script buffer to decompile.
 * @returns The decompiled chunks or null if decompilation fails.
 */
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
/**
 * Checks if the provided buffer is a canonical public key.
 *
 * @param buffer - The buffer to check, expected to be a Uint8Array.
 * @returns A boolean indicating whether the buffer is a canonical public key.
 */
export declare function isCanonicalPubKey(buffer: Uint8Array): boolean;
/**
 * Checks if the provided hash type is defined.
 *
 * A hash type is considered defined if its modified value (after masking with ~0x80)
 * is greater than 0x00 and less than 0x04.
 *
 * @param hashType - The hash type to check.
 * @returns True if the hash type is defined, false otherwise.
 */
export declare function isDefinedHashType(hashType: number): boolean;
/**
 * Checks if the provided buffer is a canonical script signature.
 *
 * A canonical script signature is a valid DER-encoded signature followed by a valid hash type byte.
 *
 * @param buffer - The buffer to check.
 * @returns `true` if the buffer is a canonical script signature, `false` otherwise.
 */
export declare function isCanonicalScriptSignature(buffer: Uint8Array): boolean;
export declare const number: typeof scriptNumber;
export declare const signature: typeof scriptSignature;
