import * as tools from 'uint8array-tools';
/**
 * Calculates the Merkle root of an array of buffers using a specified digest function.
 *
 * @param values - The array of buffers.
 * @param digestFn - The digest function used to calculate the hash of the concatenated buffers.
 * @returns The Merkle root as a buffer.
 * @throws {TypeError} If the values parameter is not an array or the digestFn parameter is not a function.
 */
export function fastMerkleRoot(values, digestFn) {
  if (!Array.isArray(values)) throw TypeError('Expected values Array');
  if (typeof digestFn !== 'function')
    throw TypeError('Expected digest Function');
  let length = values.length;
  const results = values.concat();
  while (length > 1) {
    let j = 0;
    for (let i = 0; i < length; i += 2, ++j) {
      const left = results[i];
      const right = i + 1 === length ? left : results[i + 1];
      const data = tools.concat([left, right]);
      results[j] = digestFn(data);
    }
    length = j;
  }
  return results[0];
}
