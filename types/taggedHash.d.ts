/// <reference types="node" />
declare const TAGS: readonly ["TapLeaf", "TapBranch", "TapTweak", "KeyAgg list", "KeyAgg coefficient"];
declare type TaggedHashPrefix = typeof TAGS[number];
export declare function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer;
export {};
