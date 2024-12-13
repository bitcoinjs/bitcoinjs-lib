import { initEccLib } from 'bitcoinjs-lib';
import { describe, test } from 'mocha';
import * as assert from 'assert';

describe(`initEccLib`, () => {
  beforeEach(() => {
    initEccLib(undefined);
  });

  test('initEccLib should fail when invalid', () => {
    assert.throws(() => {
      initEccLib({ isXOnlyPoint: () => false } as any);
    }, 'Error: ecc library invalid');
  });

  test('initEccLib should not fail when DANGER_DO_NOT_VERIFY_ECCLIB = true', () => {
    initEccLib({ isXOnlyPoint: () => false } as any, {
      DANGER_DO_NOT_VERIFY_ECCLIB: true,
    });
    assert.ok('it does not fail, verification is excluded');
  });
});
