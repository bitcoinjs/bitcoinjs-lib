/// <reference types="node" />
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
