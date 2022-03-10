/// <reference types="node" />
export declare function ripemd160(buffer: Buffer): Buffer;
export declare function sha1(buffer: Buffer): Buffer;
export declare function sha256(buffer: Buffer): Buffer;
export declare function hash160(buffer: Buffer): Buffer;
export declare function hash256(buffer: Buffer): Buffer;
declare const TAGS: readonly ["BIP0340/challenge", "BIP0340/aux", "BIP0340/nonce", "TapLeaf", "TapBranch", "TapSighash", "TapTweak", "KeyAgg list", "KeyAgg coefficient"];
export declare type TaggedHashPrefix = typeof TAGS[number];
export declare function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer;
export {};
