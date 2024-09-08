import { Taptree } from '../types.js';
import { PsbtInput, PsbtOutput, TapLeaf } from 'bip174';
/**
 * Converts a public key to an X-only public key.
 * @param pubKey The public key to convert.
 * @returns The X-only public key.
 */
export declare const toXOnly: (pubKey: Uint8Array) => Uint8Array;
/**
 * Default tapscript finalizer. It searches for the `tapLeafHashToFinalize` if provided.
 * Otherwise it will search for the tapleaf that has at least one signature and has the shortest path.
 * @param inputIndex the position of the PSBT input.
 * @param input the PSBT input.
 * @param tapLeafHashToFinalize optional, if provided the finalizer will search for a tapleaf that has this hash
 *                              and will try to build the finalScriptWitness.
 * @returns the finalScriptWitness or throws an exception if no tapleaf found.
 */
export declare function tapScriptFinalizer(inputIndex: number, input: PsbtInput, tapLeafHashToFinalize?: Uint8Array): {
    finalScriptWitness: Uint8Array | undefined;
};
/**
 * Serializes a taproot signature.
 * @param sig The signature to serialize.
 * @param sighashType The sighash type. Optional.
 * @returns The serialized taproot signature.
 */
export declare function serializeTaprootSignature(sig: Uint8Array, sighashType?: number): Uint8Array;
/**
 * Checks if a PSBT input is a taproot input.
 * @param input The PSBT input to check.
 * @returns True if the input is a taproot input, false otherwise.
 */
export declare function isTaprootInput(input: PsbtInput): boolean;
/**
 * Checks if a PSBT output is a taproot output.
 * @param output The PSBT output to check.
 * @param script The script to check. Optional.
 * @returns True if the output is a taproot output, false otherwise.
 */
export declare function isTaprootOutput(output: PsbtOutput, script?: Uint8Array): boolean;
/**
 * Checks the taproot input fields for consistency.
 * @param inputData The original input data.
 * @param newInputData The new input data.
 * @param action The action being performed.
 * @throws Throws an error if the input fields are inconsistent.
 */
export declare function checkTaprootInputFields(inputData: PsbtInput, newInputData: PsbtInput, action: string): void;
/**
 * Checks the taproot output fields for consistency.
 * @param outputData The original output data.
 * @param newOutputData The new output data.
 * @param action The action being performed.
 * @throws Throws an error if the output fields are inconsistent.
 */
export declare function checkTaprootOutputFields(outputData: PsbtOutput, newOutputData: PsbtOutput, action: string): void;
/**
 * Tweak the internal public key for a specific input.
 * @param inputIndex - The index of the input.
 * @param input - The PsbtInput object representing the input.
 * @returns The tweaked internal public key.
 * @throws Error if the tap internal key cannot be tweaked.
 */
export declare function tweakInternalPubKey(inputIndex: number, input: PsbtInput): Uint8Array;
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
/**
 * Checks the taproot input for signatures.
 * @param input The PSBT input to check.
 * @param action The action being performed.
 * @returns True if the input has taproot signatures, false otherwise.
 */
export declare function checkTaprootInputForSigs(input: PsbtInput, action: string): boolean;
