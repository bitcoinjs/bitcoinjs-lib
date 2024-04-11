/// <reference types="node" />
import { Bip32Derivation, PsbtInput } from 'bip174/src/lib/interfaces';
import { HDSigner } from '../interfaces';
export declare function getFinalScripts(inputIndex: number, input: PsbtInput, script: Buffer, isSegwit: boolean, isP2SH: boolean, isP2WSH: boolean): {
    finalScriptSig: Buffer | undefined;
    finalScriptWitness: Buffer | undefined;
};
export declare function bip32DerivationIsMine(root: HDSigner): (d: Bip32Derivation) => boolean;
export declare function canFinalize(input: PsbtInput, script: Buffer, scriptType: string): boolean;
export declare function isFinalized(input: PsbtInput): boolean;
