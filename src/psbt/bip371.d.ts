/// <reference types="node" />
import { Taptree } from '../types';
import { PsbtInput, PsbtOutput, TapLeaf } from 'bip174/src/lib/interfaces';
export declare const toXOnly: (pubKey: Buffer) => Buffer;
/**
 * Default tapscript finalizer. It searches for the `tapLeafHashToFinalize` if provided.
 * Otherwise it will search for the tapleaf that has at least one signature and has the shortest path.
 * @param inputIndex the position of the PSBT input.
 * @param input the PSBT input.
 * @param tapLeafHashToFinalize optional, if provided the finalizer will search for a tapleaf that has this hash
 *                              and will try to build the finalScriptWitness.
 * @returns the finalScriptWitness or throws an exception if no tapleaf found.
 */
export declare function tapScriptFinalizer(inputIndex: number, input: PsbtInput, tapLeafHashToFinalize?: Buffer): {
    finalScriptWitness: Buffer | undefined;
};
export declare function serializeTaprootSignature(sig: Buffer, sighashType?: number): Buffer;
export declare function isTaprootInput(input: PsbtInput): boolean;
export declare function isTaprootOutput(output: PsbtOutput, script?: Buffer): boolean;
export declare function checkTaprootInputFields(inputData: PsbtInput, newInputData: PsbtInput, action: string): void;
export declare function checkTaprootOutputFields(outputData: PsbtOutput, newOutputData: PsbtOutput, action: string): void;
export declare function tweakInternalPubKey(inputIndex: number, input: PsbtInput): Buffer;
/**
 * Convert a binary tree to a BIP371 type list. Each element of the list is (according to BIP371):
 * One or more tuples representing the depth, leaf version, and script for a leaf in the Taproot tree,
 * allowing the entire tree to be reconstructed. The tuples must be in depth first search order so that
 * the tree is correctly reconstructed.
 * @param tree the binary tap tree
 * @returns a list of BIP 371 tapleaves
 */
export declare function tapTreeToList(tree: Taptree): TapLeaf[];
/**
 * Convert a BIP371 TapLeaf list to a TapTree (binary).
 * @param leaves a list of tapleaves where each element of the list is (according to BIP371):
 * One or more tuples representing the depth, leaf version, and script for a leaf in the Taproot tree,
 * allowing the entire tree to be reconstructed. The tuples must be in depth first search order so that
 * the tree is correctly reconstructed.
 * @returns the corresponding taptree, or throws an exception if the tree cannot be reconstructed
 */
export declare function tapTreeFromList(leaves?: TapLeaf[]): Taptree;
export declare function checkTaprootInputForSigs(input: PsbtInput, action: string): boolean;
