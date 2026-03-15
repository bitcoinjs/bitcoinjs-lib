export type ScriptType = 'witnesspubkeyhash' | 'pubkeyhash' | 'multisig' | 'pubkey' | 'nonstandard';
export interface ScriptTypeDeps {
    isP2WPKH(script: Uint8Array): boolean;
    isP2PKH(script: Uint8Array): boolean;
    isP2MS(script: Uint8Array): boolean;
    isP2PK(script: Uint8Array): boolean;
    isP2SHScript(script: Uint8Array): boolean;
    isP2WSHScript(script: Uint8Array): boolean;
    checkRedeemScript(index: number, script: Uint8Array, redeemScript: Uint8Array, ioType: 'input' | 'output'): void;
    checkWitnessScript(index: number, script: Uint8Array, witnessScript: Uint8Array, ioType: 'input' | 'output'): void;
}
export declare function classifyScript(script: Uint8Array, deps: Pick<ScriptTypeDeps, 'isP2WPKH' | 'isP2PKH' | 'isP2MS' | 'isP2PK'>): ScriptType;
export declare function getMeaningfulScript(script: Uint8Array, index: number, ioType: 'input' | 'output', redeemScript: Uint8Array | undefined, witnessScript: Uint8Array | undefined, deps: Pick<ScriptTypeDeps, 'isP2SHScript' | 'isP2WSHScript' | 'isP2WPKH' | 'checkRedeemScript' | 'checkWitnessScript'>): {
    meaningfulScript: Uint8Array;
    type: 'p2sh' | 'p2wsh' | 'p2sh-p2wsh' | 'raw';
};
export declare function checkInvalidP2WSH(script: Uint8Array, isP2WPKH: (script: Uint8Array) => boolean, isP2SHScript: (script: Uint8Array) => boolean): void;
