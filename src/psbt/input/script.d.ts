/// <reference types="node" />
import { PsbtInput } from "bip174/src/lib/interfaces";
import { GetScriptReturn, PsbtCache, ScriptType } from "../interfaces";
export declare function getMeaningfulScript(script: Buffer, index: number, ioType: 'input' | 'output', redeemScript?: Buffer, witnessScript?: Buffer): {
    meaningfulScript: Buffer;
    type: 'p2sh' | 'p2wsh' | 'p2sh-p2wsh' | 'raw';
};
export declare function checkInvalidP2WSH(script: Buffer): void;
export declare function classifyScript(script: Buffer): ScriptType;
export declare function scriptWitnessToWitnessStack(buffer: Buffer): Buffer[];
export declare function checkScriptForPubkey(pubkey: Buffer, script: Buffer, action: string): void;
export declare function getScriptFromUtxo(inputIndex: number, input: PsbtInput, cache: PsbtCache): Buffer;
export declare function getScriptAndAmountFromUtxo(inputIndex: number, input: PsbtInput, cache: PsbtCache): {
    script: Buffer;
    value: number;
};
export declare function getScriptFromInput(inputIndex: number, input: PsbtInput, cache: PsbtCache): GetScriptReturn;
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
export declare function redeemFromFinalScriptSig(finalScript: Buffer | undefined): Buffer | undefined;
export declare function redeemFromFinalWitnessScript(finalScript: Buffer | undefined): Buffer | undefined;
