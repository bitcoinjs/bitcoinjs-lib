/**
 * Computes the HASH160 (RIPEMD-160 after SHA-256) of the given buffer.
 *
 * @param buffer - The input data to be hashed.
 * @returns The HASH160 of the input buffer.
 */
export declare function hash160(buffer: Uint8Array): Uint8Array;
/**
 * Computes the double SHA-256 hash of the given buffer.
 *
 * @param buffer - The input data to be hashed.
 * @returns The double SHA-256 hash of the input buffer.
 */
export declare function hash256(buffer: Uint8Array): Uint8Array;
export declare const TAGS: readonly ["BIP0340/challenge", "BIP0340/aux", "BIP0340/nonce", "TapLeaf", "TapBranch", "TapSighash", "TapTweak", "KeyAgg list", "KeyAgg coefficient"];
export type TaggedHashPrefix = (typeof TAGS)[number];
type TaggedHashPrefixes = {
    [key in TaggedHashPrefix]: Uint8Array;
};
/**
 * A collection of tagged hash prefixes used in various BIP (Bitcoin Improvement Proposals)
 * and Taproot-related operations. Each prefix is represented as a `Uint8Array`.
 *
 * @constant
 * @type {TaggedHashPrefixes}
 *
 * @property {'BIP0340/challenge'} - Prefix for BIP0340 challenge.
 * @property {'BIP0340/aux'} - Prefix for BIP0340 auxiliary data.
 * @property {'BIP0340/nonce'} - Prefix for BIP0340 nonce.
 * @property {TapLeaf} - Prefix for Taproot leaf.
 * @property {TapBranch} - Prefix for Taproot branch.
 * @property {TapSighash} - Prefix for Taproot sighash.
 * @property {TapTweak} - Prefix for Taproot tweak.
 * @property {'KeyAgg list'} - Prefix for key aggregation list.
 * @property {'KeyAgg coefficient'} - Prefix for key aggregation coefficient.
 */
export declare const TAGGED_HASH_PREFIXES: TaggedHashPrefixes;
/**
 * Computes a tagged hash using the specified prefix and data.
 *
 * @param prefix - The prefix to use for the tagged hash. This should be one of the values from the `TaggedHashPrefix` enum.
 * @param data - The data to hash, provided as a `Uint8Array`.
 * @returns The resulting tagged hash as a `Uint8Array`.
 */
export declare function taggedHash(prefix: TaggedHashPrefix, data: Uint8Array): Uint8Array;
export {};
