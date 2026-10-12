import * as assert from 'assert';
import { describe, it } from 'mocha';
import { tapleafHash, toHashTree } from '../src/esm/payments/bip341.js';

describe('bip341', () => {
  describe('tapleafHash', () => {
    // BIP341: tagged_hash("TapLeaf", leaf_version || compact_size(script) || script).
    const output = Uint8Array.from([0x51]); // OP_TRUE
    const vectors = [
      {
        version: 0x00,
        hash: '8fe98416aeedc4ff4bdd55d79dd3e5399c9c2b1d2d2beea8c300c2ba262c5bbc',
      },
      {
        version: 0xc0,
        hash: 'a85b2107f791b26a84e7586c28cec7cb61202ed3d01944d832500f363782d675',
      },
      {
        version: 0xc2,
        hash: '7f2e1235044710205aaec280e6d3075ca84a1b2f239bdcb3fe1db04234142f90',
      },
    ];

    vectors.forEach(({ version, hash }) => {
      it(`preserves explicit leaf version ${version}`, () => {
        assert.strictEqual(
          Buffer.from(tapleafHash({ output, version })).toString('hex'),
          hash,
        );
        assert.strictEqual(
          Buffer.from(toHashTree({ output, version }).hash).toString('hex'),
          hash,
        );
      });
    });

    it('defaults to tapscript only when the version is omitted', () => {
      assert.strictEqual(
        Buffer.from(tapleafHash({ output })).toString('hex'),
        vectors[1].hash,
      );
    });
  });
});
