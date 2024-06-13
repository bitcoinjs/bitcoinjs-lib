/// <reference types="node" />
export declare const typeforce: any;
/**
 * Checks if two arrays of Buffers are equal.
 * @param a - The first array of Buffers.
 * @param b - The second array of Buffers.
 * @returns True if the arrays are equal, false otherwise.
 */
export declare function stacksEqual(a: Buffer[], b: Buffer[]): boolean;
/**
 * Checks if the given value is a valid elliptic curve point.
 * @param p - The value to check.
 * @returns True if the value is a valid elliptic curve point, false otherwise.
 */
export declare function isPoint(p: Buffer | number | undefined | null): boolean;
export declare function Satoshi(value: number): boolean;
export interface XOnlyPointAddTweakResult {
    parity: 1 | 0;
    xOnlyPubkey: Uint8Array;
}
export interface Tapleaf {
    output: Buffer;
    version?: number;
}
export declare const TAPLEAF_VERSION_MASK = 254;
export declare function isTapleaf(o: any): o is Tapleaf;
/**
 * Binary tree repsenting script path spends for a Taproot input.
 * Each node is either a single Tapleaf, or a pair of Tapleaf | Taptree.
 * The tree has no balancing requirements.
 */
export type Taptree = [Taptree | Tapleaf, Taptree | Tapleaf] | Tapleaf;
export declare function isTaptree(scriptTree: any): scriptTree is Taptree;
export interface TinySecp256k1Interface {
    isXOnlyPoint(p: Uint8Array): boolean;
    xOnlyPointAddTweak(p: Uint8Array, tweak: Uint8Array): XOnlyPointAddTweakResult | null;
}
export declare const Buffer256bit: any;
export declare const Hash160bit: any;
export declare const Hash256bit: any;
export declare const Number: any;
export declare const Array: any;
export declare const Boolean: any;
export declare const String: any;
export declare const Buffer: any;
export declare const Hex: any;
export declare const maybe: any;
export declare const tuple: any;
export declare const UInt8: any;
export declare const UInt32: any;
export declare const Function: any;
export declare const BufferN: any;
export declare const Null: any;
export declare const oneOf: any;
