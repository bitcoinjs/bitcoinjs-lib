/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
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
export declare function checkTaprootInputFields(inputData: PsbtInput, newInputData: PsbtInput, action: string): void;
export declare function tweakInternalPubKey(inputIndex: number, input: PsbtInput): Buffer;
