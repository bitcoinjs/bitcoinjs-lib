/**
 * Checks if the given buffer is a valid BIP66-encoded signature.
 *
 * @param buffer - The buffer to check.
 * @returns A boolean indicating whether the buffer is a valid BIP66-encoded signature.
 */
export declare function check(buffer: Uint8Array): boolean;
/**
 * Decodes a DER-encoded signature buffer and returns the R and S values.
 * @param buffer - The DER-encoded signature buffer.
 * @returns An object containing the R and S values.
 * @throws {Error} If the DER sequence length is too short, too long, or invalid.
 * @throws {Error} If the R or S length is zero or invalid.
 * @throws {Error} If the R or S value is negative or excessively padded.
 */
export declare function decode(buffer: Uint8Array): {
    r: Uint8Array;
    s: Uint8Array;
};
export declare function encode(r: Uint8Array, s: Uint8Array): Uint8Array;
