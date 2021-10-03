/// <reference types="node" />
/**
 * Trims the leading 02/03 byte from an ECDSA pub key to get a 32 byte schnorr
 * pub key with x-only coordinates.
 * @param pubkey A 33 byte pubkey representing an EC point
 * @returns a 32 byte x-only coordinate
 */
export declare function trimFirstByte(pubkey: Buffer): Buffer;
/**
 * Aggregates a list of public keys into a single MuSig2* public key
 * according to the MuSig2 paper.
 * @param pubkeys The list of pub keys to aggregate
 * @returns a 32 byte Buffer representing the aggregate key
 */
export declare function aggregateMuSigPubkeys(pubkeys: Buffer[]): Buffer;
/**
 * Encodes the length of a script as a bitcoin variable length integer.
 * @param script
 * @returns
 */
export declare function serializeScriptSize(script: Buffer): Buffer;
/**
 * Gets a tapleaf tagged hash from a script.
 * @param script
 * @returns
 */
export declare function hashTapLeaf(script: Buffer): Buffer;
/**
 * Creates a lexicographically sorted tapbranch from two child taptree nodes
 * and returns its tagged hash.
 * @param child1
 * @param child2
 * @returns the tagged tapbranch hash
 */
export declare function hashTapBranch(child1: Buffer, child2: Buffer): Buffer;
/**
 * Tweaks an internal pubkey using the tagged hash of a taptree root.
 * @param pubkey the internal pubkey to tweak
 * @param tapTreeRoot the taptree root tagged hash
 * @returns the tweaked pubkey
 */
export declare function tapTweakPubkey(pubkey: Buffer, tapTreeRoot?: Buffer): Buffer;
/**
 * Gets the root hash of a taptree using a weighted Huffman construction from a
 * list of scripts and corresponding weights.
 * @param scripts
 * @param weights
 * @returns the tagged hash of the taptree root
 */
export declare function getHuffmanTaptreeRoot(scripts: Buffer[], weights?: number[]): Buffer;
