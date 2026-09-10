import * as assert from 'assert';
import { beforeEach, describe, it } from 'mocha';
import { Block } from 'bitcoinjs-lib';
import * as tools from 'uint8array-tools';

import fixtures from './fixtures/block.json';
import coreBlocks from './fixtures/core/blocks.json';

describe('Block', () => {
  describe('version', () => {
    it('should be interpreted as an int32le', () => {
      const blockHex =
        'ffffffff000000000000000000000000000000000000000000000000000000000000' +
        '00004141414141414141414141414141414141414141414141414141414141414141' +
        '01000000020000000300000000';
      const block = Block.fromHex(blockHex);
      assert.strictEqual(-1, block.version);
      assert.strictEqual(1, block.timestamp);
    });
  });

  describe('calculateTarget', () => {
    fixtures.targets.forEach(f => {
      it('returns ' + f.expected + ' for 0x' + f.bits, () => {
        const bits = parseInt(f.bits, 16);

        assert.strictEqual(
          tools.toHex(Block.calculateTarget(bits)),
          f.expected,
        );
      });
    });
  });

  describe('fromBuffer/fromHex', () => {
    fixtures.valid.forEach(f => {
      it('imports ' + f.description, () => {
        const block = Block.fromHex(f.hex);

        assert.strictEqual(block.version, f.version);
        assert.strictEqual(tools.toHex(block.prevHash!), f.prevHash);
        assert.strictEqual(tools.toHex(block.merkleRoot!), f.merkleRoot);
        if (block.witnessCommit) {
          assert.strictEqual(tools.toHex(block.witnessCommit), f.witnessCommit);
        }
        assert.strictEqual(block.timestamp, f.timestamp);
        assert.strictEqual(block.bits, f.bits);
        assert.strictEqual(block.nonce, f.nonce);
        assert.strictEqual(!block.transactions, f.hex.length === 160);
        if (f.size && f.strippedSize && f.weight) {
          assert.strictEqual(block.byteLength(false, true), f.size);
          assert.strictEqual(block.byteLength(false, false), f.strippedSize);
          assert.strictEqual(block.weight(), f.weight);
        }
      });
    });

    fixtures.invalid.forEach(f => {
      it('throws on ' + f.exception, () => {
        assert.throws(() => {
          Block.fromHex(f.hex);
        }, new RegExp(f.exception));
      });
    });

    it('does not copy the remaining block for every transaction', () => {
      let copiedBytes = 0;
      class CountingUint8Array extends Uint8Array {
        slice(start?: number, end?: number): Uint8Array {
          if (end === undefined) copiedBytes += this.length - (start ?? 0);
          return super.slice(start, end);
        }
      }
      const buffer = new CountingUint8Array(tools.fromHex(coreBlocks[0].hex));

      Block.fromBuffer(buffer);

      assert.strictEqual(copiedBytes, 0);
    });
  });

  describe('toBuffer/toHex', () => {
    fixtures.valid.forEach(f => {
      let block: Block;

      beforeEach(() => {
        block = Block.fromHex(f.hex);
      });

      it('exports ' + f.description, () => {
        assert.strictEqual(block.toHex(true), f.hex.slice(0, 160));
        assert.strictEqual(block.toHex(), f.hex);
      });
    });
  });

  describe('getHash/getId', () => {
    fixtures.valid.forEach(f => {
      let block: Block;

      beforeEach(() => {
        block = Block.fromHex(f.hex);
      });

      it('returns ' + f.id + ' for ' + f.description, () => {
        assert.strictEqual(tools.toHex(block.getHash()), f.hash);
        assert.strictEqual(block.getId(), f.id);
      });
    });
  });

  describe('getUTCDate', () => {
    fixtures.valid.forEach(f => {
      let block: Block;

      beforeEach(() => {
        block = Block.fromHex(f.hex);
      });

      it('returns UTC date of ' + f.id, () => {
        const utcDate = block.getUTCDate().getTime();

        assert.strictEqual(utcDate, f.timestamp * 1e3);
      });
    });
  });

  describe('calculateMerkleRoot', () => {
    it('should throw on zero-length transaction array', () => {
      assert.throws(() => {
        Block.calculateMerkleRoot([]);
      }, /Cannot compute merkle root for zero transactions/);
    });

    fixtures.valid.forEach(f => {
      if (f.hex.length === 160) return;

      let block: Block;

      beforeEach(() => {
        block = Block.fromHex(f.hex);
      });

      it('returns ' + f.merkleRoot + ' for ' + f.id, () => {
        assert.strictEqual(
          tools.toHex(Block.calculateMerkleRoot(block.transactions!)),
          f.merkleRoot,
        );
      });

      if (f.witnessCommit) {
        it('returns witness commit ' + f.witnessCommit + ' for ' + f.id, () => {
          assert.strictEqual(
            tools.toHex(Block.calculateMerkleRoot(block.transactions!, true)),
            f.witnessCommit,
          );
        });
      }
    });
  });

  describe('checkTxRoots', () => {
    fixtures.valid.forEach(f => {
      if (f.hex.length === 160) return;

      let block: Block;

      beforeEach(() => {
        block = Block.fromHex(f.hex);
      });

      it('returns ' + f.valid + ' for ' + f.id, () => {
        assert.strictEqual(block.checkTxRoots(), true);
      });
    });

    it('rejects a duplicated transaction that preserves the merkle root', () => {
      const original = Block.fromHex(coreBlocks[0].hex);
      const forged = Block.fromHex(coreBlocks[0].hex);
      const transactions = forged.transactions!;
      transactions.push(transactions[transactions.length - 1]);
      const parsed = Block.fromHex(forged.toHex());
      const mutation = { value: false };

      assert.deepStrictEqual(
        Block.calculateMerkleRoot(parsed.transactions!, false, mutation),
        original.merkleRoot,
      );
      assert.strictEqual(mutation.value, true);
      assert.strictEqual(parsed.getId(), original.getId());
      assert.strictEqual(original.checkTxRoots(), true);
      assert.strictEqual(parsed.checkTxRoots(), false);
    });
  });

  describe('checkProofOfWork', () => {
    fixtures.valid.forEach(f => {
      let block: Block;

      beforeEach(() => {
        block = Block.fromHex(f.hex);
      });

      it('returns ' + f.valid + ' for ' + f.id, () => {
        assert.strictEqual(block.checkProofOfWork(), f.valid);
      });
    });
  });
});
