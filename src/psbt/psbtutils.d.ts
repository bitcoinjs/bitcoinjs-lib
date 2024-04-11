/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { HDSigner, HDSignerAsync, PsbtCache, PsbtOpts, Signer, SignerAsync } from './interfaces';
import { Psbt } from '../psbt';
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
export declare function check32Bit(num: number): void;
export declare function checkFees(psbt: Psbt, cache: PsbtCache, opts: PsbtOpts): void;
export declare function getSignersFromHD(inputIndex: number, inputs: PsbtInput[], hdKeyPair: HDSigner | HDSignerAsync): Array<Signer | SignerAsync>;
export declare function range(n: number): number[];
export declare function isPubkeyLike(buf: Buffer): boolean;
export {};
