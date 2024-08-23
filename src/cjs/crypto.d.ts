/// <reference types="node" />
export declare function ripemd160(buffer: Buffer): Buffer;
export declare function sha1(buffer: Buffer): Buffer;
export declare function sha256(buffer: Buffer): Buffer;
export declare function hash160(buffer: Buffer): Buffer;
export declare function hash256(buffer: Buffer): Buffer;
export declare const TAGS: readonly ["BIP0340/challenge", "BIP0340/aux", "BIP0340/nonce", "TapLeaf", "TapBranch", "TapSighash", "TapTweak", "KeyAgg list", "KeyAgg coefficient"];
export type TaggedHashPrefix = typeof TAGS[number];
type TaggedHashPrefixes = {
    [key in TaggedHashPrefix]: Buffer;
};
/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
/**
 * Defines the tagged hash prefixes used in the crypto module.
 */
export declare const TAGGED_HASH_PREFIXES: TaggedHashPrefixes;
export declare function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer;
export {};
