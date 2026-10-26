import * as tools from 'uint8array-tools';
/**
 * Calculates the Merkle root of an array of buffers using a specified digest function.
 *
 * @param values - The array of buffers.
 * @param digestFn - The digest function used to calculate the hash of the concatenated buffers.
 * @param mutated - Receives whether an actual pair of equal hashes was found.
 * @returns The Merkle root as a buffer.
 * @throws {TypeError} If the values parameter is not an array or the digestFn parameter is not a function.
 */
export function fastMerkleRoot(values, digestFn, mutated) {
  if (!Array.isArray(values)) throw TypeError('Expected values Array');
  if (typeof digestFn !== 'function')
    throw TypeError('Expected digest Function');
  let length = values.length;
  const results = values.concat();
  if (mutated) mutated.value = false;
  while (length > 1) {
    let j = 0;
    for (let i = 0; i < length; i += 2, ++j) {
      const left = results[i];
      const right = i + 1 === length ? left : results[i + 1];
      // Odd-node padding is not a mutation; only compare pairs from this level.
      if (mutated && i + 1 < length && tools.compare(left, right) === 0)
        mutated.value = true;
      const data = tools.concat([left, right]);
      results[j] = digestFn(data);
    }
    length = j;
  }
  return results[0];
}
