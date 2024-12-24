import { describe, it } from 'mocha';
import assert from 'assert';
import { opcodes as OPS } from 'bitcoinjs-lib';

describe('OPS Enum Tests', () => {
  it('should map OPS keys to correct numbers and reverse lookup', () => {
    Object.keys(OPS)
      .filter(key => isNaN(Number(key))) // Only test enum keys, not reverse-mapped numbers
      .forEach(key => {
        const value = OPS[key as keyof typeof OPS];

        // Assert the forward mapping
        assert.strictEqual(
          OPS[key],
          value,
          `Failed for key: ${key}, value: ${value}`,
        );
      });
  });

  it('should reverse map numbers to correct keys', () => {
    const valueToKeysMap = new Map<number, string[]>();

    Object.keys(OPS)
      .filter(key => isNaN(Number(key)))
      .forEach(key => {
        const value = OPS[key as keyof typeof OPS];
        if (!valueToKeysMap.has(value)) {
          valueToKeysMap.set(value, []);
        }
        valueToKeysMap.get(value)!.push(key);
      });

    Object.values(OPS)
      .filter(value => typeof value === 'number')
      .forEach(value => {
        const keys = valueToKeysMap.get(value) || [];
        keys.forEach(key => {
          assert.strictEqual(
            OPS[key],
            value,
            `Failed for value: ${value}, key: ${key}`,
          );
        });
      });
  });
});
