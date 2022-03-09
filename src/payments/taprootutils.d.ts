/// <reference types="node" />
import { TaprootLeaf } from '../types';
export declare const LEAF_VERSION_TAPSCRIPT = 192;
export declare function rootHashFromPath(controlBlock: Buffer, tapLeafMsg: Buffer): Buffer;
export interface HashTree {
    hash: Buffer;
    left?: HashTree;
    right?: HashTree;
}
/**
 * Build the hash tree from the scripts binary tree.
 * The binary tree can be balanced or not.
 * @param scriptTree - is a list representing a binary tree where an element can be:
 *  - a taproot leaf [(output, version)], or
 *  - a pair of two taproot leafs [(output, version), (output, version)], or
 *  - one taproot leaf and a list of elements
 */
export declare function toHashTree(scriptTree: TaprootLeaf[]): HashTree;
/**
 * Check if the tree is a binary tree with leafs of type TaprootLeaf
 */
export declare function isTapTree(scriptTree: TaprootLeaf[]): boolean;
/**
 * Given a MAST tree, it finds the path of a particular hash.
 * @param node - the root of the tree
 * @param hash - the hash to search for
 * @returns - and array of hashes representing the path, or an empty array if no pat is found
 */
export declare function findScriptPath(node: HashTree, hash: Buffer): Buffer[];
export declare function tapLeafHash(script: Buffer, version?: number): Buffer;
export declare function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer;
