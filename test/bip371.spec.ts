import { toXOnly } from '../ts_src/psbt/bip371';
import * as assert from 'assert';

describe('toXOnly', () => {
  it('should return the input if the pubKey length is 32', () => {
    const pubKey = new Uint8Array(32).fill(1); // Example 32-byte public key
    const result = toXOnly(pubKey);
    assert.deepStrictEqual(result, pubKey); // Expect the same content
    assert.notStrictEqual(result, pubKey); // Expect a new instance (copy)
  });

  it('should return the sliced key if the pubKey length is greater than 32', () => {
    const pubKey = new Uint8Array(33).fill(1);
    pubKey[0] = 0; // Add a leading byte
    const result = toXOnly(pubKey);
    assert.deepStrictEqual(result, pubKey.slice(1, 33)); // Expect the sliced array
  });

  it('should return the key if the pubKey length is less than 32', () => {
    const pubKey = new Uint8Array(31).fill(1); // Example invalid public key
    const result = toXOnly(pubKey);
    assert.deepStrictEqual(result, pubKey.slice(1, 33)); // Expect the sliced array
  });
});
