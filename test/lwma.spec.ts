import * as assert from 'assert';
import { BlockGold, lwma, networks } from '..';

import * as fixtures from './fixtures/lwma.json';

const networkMap: { [name: string]: networks.Network } = {
  bitcoingoldtestnet: networks.bitcoingoldtestnet,
};

describe('lwma', () => {
  describe('calcNextBits', () => {
    fixtures.valid.forEach(f => {
      it('imports ' + f.description, () => {
        const block = BlockGold.fromHex(f.hex);
        const prevBlocks: BlockGold[] = [];
        const network = networkMap[f.network];
        f.prevBlocksHex.forEach(b => {
          const blockGold = BlockGold.fromHex(b);
          prevBlocks.push(blockGold);
        });

        const bits = lwma.calcNextBits(block, prevBlocks, network.lwma!);
        assert.strictEqual(block.bits, bits);
      });
    });

    fixtures.invalid.forEach(f => {
      it('imports ' + f.description, () => {
        const block = BlockGold.fromHex(f.hex);
        const prevBlocks: BlockGold[] = [];
        const network = networkMap[f.network];
        f.prevBlocksHex.forEach(b => {
          const blockGold = BlockGold.fromHex(b);
          prevBlocks.push(blockGold);
        });

        try {
          lwma.calcNextBits(block, prevBlocks, network.lwma!);
          throw new Error('caclNextBits did not throw exception');
        } catch (ex) {
          assert.strictEqual(ex.message, f.message);
        }
      });
    });
  });
});
