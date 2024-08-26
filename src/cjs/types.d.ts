import * as v from 'valibot';
export declare const NBufferSchemaFactory: (size: number) => v.SchemaWithPipe<[v.InstanceSchema<Uint8ArrayConstructor, undefined>, v.LengthAction<Uint8Array, number, undefined>]>;
/**
 * Checks if two arrays of Buffers are equal.
 * @param a - The first array of Buffers.
 * @param b - The second array of Buffers.
 * @returns True if the arrays are equal, false otherwise.
 */
export declare function stacksEqual(a: Uint8Array[], b: Uint8Array[]): boolean;
/**
 * Checks if the given value is a valid elliptic curve point.
 * @param p - The value to check.
 * @returns True if the value is a valid elliptic curve point, false otherwise.
 */
export declare function isPoint(p: Uint8Array | number | undefined | null): boolean;
export interface XOnlyPointAddTweakResult {
    parity: 1 | 0;
    xOnlyPubkey: Uint8Array;
}
export interface Tapleaf {
    output: Uint8Array;
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
export declare const Buffer256bitSchema: v.SchemaWithPipe<[v.InstanceSchema<Uint8ArrayConstructor, undefined>, v.LengthAction<Uint8Array, number, undefined>]>;
export declare const Hash160bitSchema: v.SchemaWithPipe<[v.InstanceSchema<Uint8ArrayConstructor, undefined>, v.LengthAction<Uint8Array, number, undefined>]>;
export declare const Hash256bitSchema: v.SchemaWithPipe<[v.InstanceSchema<Uint8ArrayConstructor, undefined>, v.LengthAction<Uint8Array, number, undefined>]>;
export declare const BufferSchema: v.InstanceSchema<Uint8ArrayConstructor, undefined>;
export declare const HexSchema: v.SchemaWithPipe<[v.StringSchema<undefined>, v.RegexAction<string, undefined>]>;
export declare const UInt8Schema: v.SchemaWithPipe<[v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 255, undefined>]>;
export declare const UInt32Schema: v.SchemaWithPipe<[v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4294967295, undefined>]>;
export declare const SatoshiSchema: v.SchemaWithPipe<[v.BigintSchema<undefined>, v.MinValueAction<bigint, 0n, undefined>, v.MaxValueAction<bigint, 9223372036854775807n, undefined>]>;
export declare const NullablePartial: (a: Record<string, any>) => v.ObjectSchema<{}, undefined>;
