/// <reference types="node" />
declare const TAGS: readonly ["BIP0340/challenge", "BIP0340/aux", "BIP0340/nonce", "TapLeaf", "TapBranch", "TapTweak", "KeyAgg list", "KeyAgg coefficient"];
declare type TaggedHashPrefix = typeof TAGS[number];
export declare function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer;
export {};
