/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { SignatureDecodeFunc } from '../interfaces';
export declare function hasSigs(neededSigs: number, partialSig?: any[], pubkeys?: Buffer[]): boolean;
export declare function checkPartialSigSighashes(input: PsbtInput): void;
export declare function trimTaprootSig(signature: Buffer): Buffer;
export declare function isSigLike(buf: Buffer): boolean;
/**
 * Checks if an input contains a signature for a specific action.
 * @param input - The input to check.
 * @param action - The action to check for.
 * @returns A boolean indicating whether the input contains a signature for the specified action.
 */
export declare function checkInputForSig(input: PsbtInput, action: string): boolean;
/**
 * Determines if a given action is allowed for a signature block.
 * @param signature - The signature block.
 * @param signatureDecodeFn - The function used to decode the signature.
 * @param action - The action to be checked.
 * @returns True if the action is allowed, false otherwise.
 */
export declare function signatureBlocksAction(signature: Buffer, signatureDecodeFn: SignatureDecodeFunc, action: string): boolean;
