import * as assert from 'assert';
import { BlockGold, networks, lwma } from '..';

import * as fixtures from './fixtures/lwma.json';

const networkMap: { [name: string]: networks.Network } = {
  bitcoingoldtestnet: networks.bitcoingoldtestnet,
};

describe('lwma', function() {
  describe('calcNextBits', function() {
    fixtures.valid.forEach(function(f) {
      it('imports ' + f.description, function() {
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

    fixtures.invalid.forEach(function(f) {
      it('imports ' + f.description, function() {
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
