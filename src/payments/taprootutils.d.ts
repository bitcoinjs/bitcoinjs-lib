/// <reference types="node" />
import { Tapleaf, Taptree } from '../types';
export declare const LEAF_VERSION_TAPSCRIPT = 192;
export declare function rootHashFromPath(controlBlock: Buffer, leafHash: Buffer): Buffer;
interface HashLeaf {
    hash: Buffer;
}
interface HashBranch {
    hash: Buffer;
    left: HashTree;
    right: HashTree;
}
/**
 * Binary tree representing leaf, branch, and root node hashes of a Taptree.
 * Each node contains a hash, and potentially left and right branch hashes.
 * This tree is used for 2 purposes: Providing the root hash for tweaking,
 * and calculating merkle inclusion proofs when constructing a control block.
 */
export declare type HashTree = HashLeaf | HashBranch;
/**
 * Build a hash tree of merkle nodes from the scripts binary tree.
 * @param scriptTree - the tree of scripts to pairwise hash.
 */
export declare function toHashTree(scriptTree: Taptree): HashTree;
/**
 * Given a HashTree, finds the path from a particular hash to the root.
 * @param node - the root of the tree
 * @param hash - the hash to search for
 * @returns - array of sibling hashes, from leaf (inclusive) to root
 * (exclusive) needed to prove inclusion of the specified hash. undefined if no
 * path is found
 */
export declare function findScriptPath(node: HashTree, hash: Buffer): Buffer[] | undefined;
export declare function tapleafHash(leaf: Tapleaf): Buffer;
export declare function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer;
export {};
