/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
export declare const isP2MS: (script: Buffer) => boolean;
export declare const isP2PK: (script: Buffer) => boolean;
export declare const isP2PKH: (script: Buffer) => boolean;
export declare const isP2WPKH: (script: Buffer) => boolean;
export declare const isP2WSHScript: (script: Buffer) => boolean;
export declare const isP2SHScript: (script: Buffer) => boolean;
export declare const isP2TR: (script: Buffer) => boolean;
/**
 * Converts a witness stack to a script witness.
 * @param witness The witness stack to convert.
 * @returns The script witness as a Buffer.
 */
/**
 * Converts a witness stack to a script witness.
 * @param witness The witness stack to convert.
 * @returns The converted script witness.
 */
export declare function witnessStackToScriptWitness(witness: Buffer[]): Buffer;
/**
 * Finds the position of a public key in a script.
 * @param pubkey The public key to search for.
 * @param script The script to search in.
 * @returns The index of the public key in the script, or -1 if not found.
 * @throws {Error} If there is an unknown script error.
 */
export declare function pubkeyPositionInScript(pubkey: Buffer, script: Buffer): number;
/**
 * Checks if a public key is present in a script.
 * @param pubkey The public key to check.
 * @param script The script to search in.
 * @returns A boolean indicating whether the public key is present in the script.
 */
export declare function pubkeyInScript(pubkey: Buffer, script: Buffer): boolean;
/**
 * Checks if an input contains a signature for a specific action.
 * @param input - The input to check.
 * @param action - The action to check for.
 * @returns A boolean indicating whether the input contains a signature for the specified action.
 */
export declare function checkInputForSig(input: PsbtInput, action: string): boolean;
type SignatureDecodeFunc = (buffer: Buffer) => {
    signature: Buffer;
    hashType: number;
};
/**
 * Determines if a given action is allowed for a signature block.
 * @param signature - The signature block.
 * @param signatureDecodeFn - The function used to decode the signature.
 * @param action - The action to be checked.
 * @returns True if the action is allowed, false otherwise.
 */
export declare function signatureBlocksAction(signature: Buffer, signatureDecodeFn: SignatureDecodeFunc, action: string): boolean;
export {};
