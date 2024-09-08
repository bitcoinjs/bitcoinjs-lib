import { Tapleaf, Taptree } from '../types.js';
export declare const LEAF_VERSION_TAPSCRIPT = 192;
export declare const MAX_TAPTREE_DEPTH = 128;
interface HashLeaf {
    hash: Uint8Array;
}
interface HashBranch {
    hash: Uint8Array;
    left: HashTree;
    right: HashTree;
}
interface TweakedPublicKey {
    parity: number;
    x: Uint8Array;
}
/**
 * Binary tree representing leaf, branch, and root node hashes of a Taptree.
 * Each node contains a hash, and potentially left and right branch hashes.
 * This tree is used for 2 purposes: Providing the root hash for tweaking,
 * and calculating merkle inclusion proofs when constructing a control block.
 */
export type HashTree = HashLeaf | HashBranch;
/**
 * Calculates the root hash from a given control block and leaf hash.
 * @param controlBlock - The control block buffer.
 * @param leafHash - The leaf hash buffer.
 * @returns The root hash buffer.
 * @throws {TypeError} If the control block length is less than 33.
 */
export declare function rootHashFromPath(controlBlock: Uint8Array, leafHash: Uint8Array): Uint8Array;
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
export declare function findScriptPath(node: HashTree, hash: Uint8Array): Uint8Array[] | undefined;
/**
 * Calculates the tapleaf hash for a given Tapleaf object.
 * @param leaf - The Tapleaf object to calculate the hash for.
 * @returns The tapleaf hash as a Buffer.
 */
export declare function tapleafHash(leaf: Tapleaf): Uint8Array;
/**
 * Computes the taproot tweak hash for a given public key and optional hash.
 * If a hash is provided, the public key and hash are concatenated before computing the hash.
 * If no hash is provided, only the public key is used to compute the hash.
 *
 * @param pubKey - The public key buffer.
 * @param h - The optional hash buffer.
 * @returns The taproot tweak hash.
 */
export declare function tapTweakHash(pubKey: Uint8Array, h: Uint8Array | undefined): Uint8Array;
/**
 * Tweak a public key with a given tweak hash.
 * @param pubKey - The public key to be tweaked.
 * @param h - The tweak hash.
 * @returns The tweaked public key or null if the input is invalid.
 */
export declare function tweakKey(pubKey: Uint8Array, h: Uint8Array | undefined): TweakedPublicKey | null;
export {};
