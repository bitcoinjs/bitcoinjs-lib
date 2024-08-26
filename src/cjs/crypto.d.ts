export declare function hash160(buffer: Uint8Array): Uint8Array;
export declare function hash256(buffer: Uint8Array): Uint8Array;
export declare const TAGS: readonly ["BIP0340/challenge", "BIP0340/aux", "BIP0340/nonce", "TapLeaf", "TapBranch", "TapSighash", "TapTweak", "KeyAgg list", "KeyAgg coefficient"];
export type TaggedHashPrefix = (typeof TAGS)[number];
type TaggedHashPrefixes = {
    [key in TaggedHashPrefix]: Uint8Array;
};
/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
/**
 * Defines the tagged hash prefixes used in the crypto module.
 */
export declare const TAGGED_HASH_PREFIXES: TaggedHashPrefixes;
export declare function taggedHash(prefix: TaggedHashPrefix, data: Uint8Array): Uint8Array;
export {};
