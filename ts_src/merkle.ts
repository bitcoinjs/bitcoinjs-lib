export function fastMerkleRoot(
  values: Buffer[],
  digestFn: (b: Buffer) => Buffer,
): Buffer {
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
      const data = Buffer.concat([left, right]);

      results[j] = digestFn(data);
    }

    length = j;
  }

  return results[0];
}
