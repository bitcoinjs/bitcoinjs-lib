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
