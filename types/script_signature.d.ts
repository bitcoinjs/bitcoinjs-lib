interface ScriptSignature {
    signature: Buffer;
    hashType: number;
}
export declare function decode(buffer: Buffer): ScriptSignature;
export declare function encode(signature: Buffer, hashType: number): Buffer;
export {};
