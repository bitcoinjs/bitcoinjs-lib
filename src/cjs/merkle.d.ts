/**
 * Calculates the Merkle root of an array of buffers using a specified digest function.
 *
 * @param values - The array of buffers.
 * @param digestFn - The digest function used to calculate the hash of the concatenated buffers.
 * @param mutated - Receives whether an actual pair of equal hashes was found.
 * @returns The Merkle root as a buffer.
 * @throws {TypeError} If the values parameter is not an array or the digestFn parameter is not a function.
 */
export declare function fastMerkleRoot(values: Uint8Array[], digestFn: (b: Uint8Array) => Uint8Array, mutated?: {
    value: boolean;
}): Uint8Array;
