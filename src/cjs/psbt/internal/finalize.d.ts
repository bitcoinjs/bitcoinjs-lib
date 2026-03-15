import { PsbtInput } from 'bip174';
export declare function getFinalScripts(inputIndex: number, input: PsbtInput, script: Uint8Array, isSegwit: boolean, isP2SH: boolean, isP2WSH: boolean): {
    finalScriptSig: Uint8Array | undefined;
    finalScriptWitness: Uint8Array | undefined;
};
