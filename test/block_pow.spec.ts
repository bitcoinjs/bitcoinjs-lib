import * as assert from 'assert';
import { describe, it } from 'mocha';
import { Block } from 'bitcoinjs-lib';
import * as tools from 'uint8array-tools';

describe('Block proof of work', () => {
  const invalidTargets = [
    0x00000000, 0x01000000, 0x02000000, 0x03000000, 0x20000000, 0x007fffff,
    0x01003456, 0x020000ff, 0x01810000, 0x02800100, 0x03800001, 0x1d80ffff,
    0x20ffffff, 0x21010000, 0x2101ffff, 0x22000100, 0x220001ff, 0x23000001,
    0x80010203, 0xff123456,
  ];

  invalidTargets.forEach(bits => {
    it('rejects invalid target 0x' + bits.toString(16), () => {
      const block = new Block();
      block.bits = bits;
      // Even a zero hash must not make an invalid target acceptable.
      const hash = new Uint8Array(32);
      block.getHash = () => hash.slice();
      assert.strictEqual(block.checkProofOfWork(), false);
      hash[0] = 1;
      assert.strictEqual(block.checkProofOfWork(), false);
    });
  });

  const validTargets = [
    { bits: 0x01010000, target: '00'.repeat(31) + '01' },
    { bits: 0x01123456, target: '00'.repeat(31) + '12' },
    { bits: 0x02000100, target: '00'.repeat(31) + '01' },
    { bits: 0x02123456, target: '00'.repeat(30) + '1234' },
    { bits: 0x03000001, target: '00'.repeat(31) + '01' },
    { bits: 0x03123456, target: '00'.repeat(29) + '123456' },
    { bits: 0x04001234, target: '00'.repeat(29) + '123400' },
    { bits: 0x1d00ffff, target: '00'.repeat(4) + 'ffff' + '00'.repeat(26) },
    { bits: 0x207fffff, target: '7fffff' + '00'.repeat(29) },
    { bits: 0x2100ffff, target: 'ffff' + '00'.repeat(30) },
    { bits: 0x220000ff, target: 'ff' + '00'.repeat(31) },
  ];

  validTargets.forEach(({ bits, target }) => {
    it('checks the hash boundary for target 0x' + bits.toString(16), () => {
      assert.strictEqual(tools.toHex(Block.calculateTarget(bits)), target);
      const block = new Block();
      block.bits = bits;
      const hash = tools.fromHex(target).reverse();
      block.getHash = () => hash.slice();
      assert.strictEqual(block.checkProofOfWork(), true);
      // These targets all have a low byte below 0xff.
      hash[0] += 1;
      assert.strictEqual(block.checkProofOfWork(), false);
      hash.fill(0);
      assert.strictEqual(block.checkProofOfWork(), true);
    });
  });

  [0x20ffffff, 0x2101ffff, 0x220001ff].forEach(bits => {
    it(
      'rejects a serialized header with invalid target 0x' + bits.toString(16),
      () => {
        const block = new Block();
        block.prevHash = new Uint8Array(32);
        block.merkleRoot = new Uint8Array(32);
        block.bits = bits;
        const parsed = Block.fromHex(block.toHex(true));
        assert.strictEqual(parsed.checkProofOfWork(), false);
      },
    );
  });

  it('accepts the regtest genesis header', () => {
    const block = Block.fromHex(
      '01000000' +
        '00'.repeat(32) +
        '3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a' +
        'dae5494dffff7f2002000000',
    );
    assert.strictEqual(
      block.getId(),
      '0f9188f13cb7b2c71f2a335e3a4fc328bf5beb436012afca590b1a11466e2206',
    );
    assert.strictEqual(block.checkProofOfWork(), true);
  });
});
