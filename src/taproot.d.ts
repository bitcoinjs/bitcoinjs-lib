/// <reference types="node" />
import { TapTree as PsbtTapTree } from 'bip174/src/lib/interfaces';
import { TinySecp256k1Interface, XOnlyPointAddTweakResult } from './types';
/**
 * The 0x02 prefix indicating an even Y coordinate which is implicitly assumed
 * on all 32 byte x-only pub keys as defined in BIP340.
 */
export declare const EVEN_Y_COORD_PREFIX: Buffer;
export declare const INITIAL_TAPSCRIPT_VERSION = 192;
/**
 * Aggregates a list of public keys into a single MuSig2* public key
 * according to the MuSig2 paper.
 * @param ecc Elliptic curve implementation
 * @param pubkeys The list of pub keys to aggregate
 * @returns a 32 byte Buffer representing the aggregate key
 */
export declare function aggregateMuSigPubkeys(ecc: TinySecp256k1Interface, pubkeys: Buffer[]): Uint8Array;
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
export declare function hashTapLeaf(script: Buffer, leafVersion?: number): Buffer;
/**
 * Creates a lexicographically sorted tapbranch from two child taptree nodes
 * and returns its tagged hash.
 * @param child1
 * @param child2
 * @returns the tagged tapbranch hash
 */
export declare function hashTapBranch(child1: Buffer, child2: Buffer): Buffer;
/**
 * Tweaks a privkey, using the tagged hash of its pubkey, and (optionally) a taptree root
 * @param ecc Elliptic curve implementation
 * @param pubkey public key, used to calculate the tweak
 * @param privkey the privkey to tweak
 * @param taptreeRoot the taptree root tagged hash
 * @returns {Buffer} the tweaked privkey
 */
export declare function tapTweakPrivkey(ecc: TinySecp256k1Interface, pubkey: Uint8Array, privkey: Uint8Array, taptreeRoot?: Uint8Array): Uint8Array;
/**
 * Tweaks an internal pubkey, using the tagged hash of itself, and (optionally) a taptree root
 * @param ecc Elliptic curve implementation
 * @param pubkey the internal pubkey to tweak
 * @param taptreeRoot the taptree root tagged hash
 * @returns {TweakedPubkey} the tweaked pubkey
 */
export declare function tapTweakPubkey(ecc: TinySecp256k1Interface, pubkey: Uint8Array, taptreeRoot?: Buffer): XOnlyPointAddTweakResult;
export interface Taptree {
    root: Buffer;
    paths: Buffer[][];
}
/**
 * Gets the root hash and hash-paths of a taptree from the depth-first
 * construction used in BIP-0371 PSBTs
 * @param tree
 * @returns {Taptree} the tree, represented by its root hash, and the paths to
 * that root from each of the input scripts
 */
export declare function getDepthFirstTaptree(tree: PsbtTapTree): Taptree;
/**
 * Gets the root hash of a taptree using a weighted Huffman construction from a
 * list of scripts and corresponding weights.
 * @param scripts
 * @param weights
 * @returns {Taptree} the tree, represented by its root hash, and the paths to that root from each of the input scripts
 */
export declare function getHuffmanTaptree(scripts: Buffer[], weights: Array<number | undefined>): Taptree;
export declare function getControlBlock(parity: 0 | 1, pubkey: Uint8Array, path: Buffer[], leafVersion?: number): Buffer;
export interface KeyPathWitness {
    spendType: 'Key';
    signature: Buffer;
    annex?: Buffer;
}
export interface ScriptPathWitness {
    spendType: 'Script';
    scriptSig: Buffer[];
    tapscript: Buffer;
    controlBlock: Buffer;
    annex?: Buffer;
}
export interface ControlBlock {
    parity: number;
    internalPubkey: Buffer;
    leafVersion: number;
    path: Buffer[];
}
/**
 * Parses a taproot witness stack and extracts key data elements.
 * @param witnessStack
 * @returns {ScriptPathWitness|KeyPathWitness} an object representing the
 * parsed witness for a script path or key path spend.
 * @throws {Error} if the witness stack does not conform to the BIP 341 script validation rules
 */
export declare function parseTaprootWitness(witnessStack: Buffer[]): ScriptPathWitness | KeyPathWitness;
/**
 * Parses a taproot control block.
 * @param ecc Elliptic curve implementation
 * @param controlBlock the control block to parse
 * @returns {ControlBlock} the parsed control block
 * @throws {Error} if the witness stack does not conform to the BIP 341 script validation rules
 */
export declare function parseControlBlock(ecc: TinySecp256k1Interface, controlBlock: Buffer): ControlBlock;
/**
 * Calculates the tapleaf hash from a control block and script.
 * @param ecc Elliptic curve implementation
 * @param controlBlock the control block, either raw or parsed
 * @param tapscript the leaf script corresdponding to the control block
 * @returns {Buffer} the tapleaf hash
 */
export declare function getTapleafHash(ecc: TinySecp256k1Interface, controlBlock: Buffer | ControlBlock, tapscript: Buffer): Buffer;
/**
 * Calculates the taptree root hash from a control block and script.
 * @param ecc Elliptic curve implementation
 * @param controlBlock the control block, either raw or parsed
 * @param tapscript the leaf script corresdponding to the control block
 * @param tapleafHash the leaf hash if already calculated
 * @returns {Buffer} the taptree root hash
 */
export declare function getTaptreeRoot(ecc: TinySecp256k1Interface, controlBlock: Buffer | ControlBlock, tapscript: Buffer, tapleafHash?: Buffer): Buffer;
