/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
export declare const isP2MS: (script: Buffer) => boolean;
export declare const isP2PK: (script: Buffer) => boolean;
export declare const isP2PKH: (script: Buffer) => boolean;
export declare const isP2WPKH: (script: Buffer) => boolean;
export declare const isP2WSHScript: (script: Buffer) => boolean;
export declare const isP2SHScript: (script: Buffer) => boolean;
export declare const isP2TR: (script: Buffer) => boolean;
export declare function witnessStackToScriptWitness(witness: Buffer[]): Buffer;
export declare function pubkeyPositionInScript(pubkey: Buffer, script: Buffer): number;
export declare function pubkeyInScript(pubkey: Buffer, script: Buffer): boolean;
export declare function checkInputForSig(input: PsbtInput, action: string): boolean;
type SignatureDecodeFunc = (buffer: Buffer) => {
    signature: Buffer;
    hashType: number;
};
export declare function signatureBlocksAction(signature: Buffer, signatureDecodeFn: SignatureDecodeFunc, action: string): boolean;
export {};
