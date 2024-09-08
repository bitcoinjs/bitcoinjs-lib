interface ScriptSignature {
    signature: Uint8Array;
    hashType: number;
}
/**
 * Decodes a buffer into a ScriptSignature object.
 * @param buffer - The buffer to decode.
 * @returns The decoded ScriptSignature object.
 * @throws Error if the hashType is invalid.
 */
export declare function decode(buffer: Uint8Array): ScriptSignature;
/**
 * Encodes a signature and hash type into a buffer.
 * @param signature - The signature to encode.
 * @param hashType - The hash type to encode.
 * @returns The encoded buffer.
 * @throws Error if the hashType is invalid.
 */
export declare function encode(signature: Uint8Array, hashType: number): Uint8Array;
export {};
