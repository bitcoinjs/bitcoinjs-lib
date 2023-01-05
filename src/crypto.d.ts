/// <reference types="node" />
import { TAGS } from './tags';
export declare function ripemd160(buffer: Buffer): Buffer;
export declare function sha1(buffer: Buffer): Buffer;
export declare function sha256(buffer: Buffer): Buffer;
export declare function hash160(buffer: Buffer): Buffer;
export declare function hash256(buffer: Buffer): Buffer;
export type TaggedHashPrefix = typeof TAGS[number];
export declare function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer;
