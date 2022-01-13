/// <reference types="node" />
import { TaprootLeaf } from './types';
export declare function rootHashFromPath(controlBlock: Buffer, tapLeafMsg: Buffer): Buffer;
export interface HashTree {
    hash: Buffer;
    left?: HashTree;
    right?: HashTree;
}
export declare function toHashTree(scripts: TaprootLeaf[]): HashTree;
export declare function findScriptPath(node: HashTree, hash: Buffer): Buffer[];
export declare function tapLeafHash(script: Buffer, version?: number): Buffer;
export declare function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer;
