// https://github.com/BTCGPU/BTCGPU/blob/c919e0774806601f8b192378d078f63f7804b721/src/pow.cpp#L74
import BN = require('bn.js');

import { BlockGold as Block } from './block_gold';

export interface LwmaConfig {
  enableHeight: number;
  testnet: boolean;
  regtest: boolean;
  powTargetSpacing: number;
  averagingWindow: number;
  adjustWeight: number;
  minDenominator: number;
  solveTimeLimitation: boolean;
  powLimit: string;
}

interface BlockMap {
  [height: number]: Block;
}
const b0: BN = new BN(0);

export function calcNextBits(
  currentBlock: Block,
  previousBlocks: Block[],
  lwmaConfig: LwmaConfig,
): number {
  if (!previousBlocks || previousBlocks.length <= lwmaConfig.averagingWindow) {
    throw new Error(
      'LWMA need the last ' +
        (lwmaConfig.averagingWindow + 1) +
        ' blocks to determine the next target',
    );
  }

  const prevBlocks: BlockMap = {};
  previousBlocks.forEach(b => {
    prevBlocks[b.height] = b;
  });

  for (
    let i = currentBlock.height - lwmaConfig.averagingWindow - 1;
    i < currentBlock.height;
    i++
  ) {
    if (!prevBlocks[i]) {
      throw new Error(
        'Block with height ' + i + ' is missing, cannot calculate next target',
      );
    }
  }

  // loss of precision when converting target to bits, comparing target to target
  // (from bits) will result in different uint256
  const nextTarget = getLwmaTarget(currentBlock, prevBlocks, lwmaConfig);
  const bits = targetToBits(nextTarget);

  return bits;
}

function getLwmaTarget(
  cur: Block,
  prevBlocks: BlockMap,
  lwmaConfig: LwmaConfig,
): BN {
  const weight = lwmaConfig.adjustWeight;
  const height = cur.height;
  let prev = prevBlocks[height - 1];

  // Special testnet handling
  if (lwmaConfig.regtest) {
    return bitsToTarget(prev.bits);
  }

  const limitBig = new BN(lwmaConfig.powLimit.toString());
  if (
    lwmaConfig.testnet &&
    cur.timestamp > prev.timestamp + lwmaConfig.powTargetSpacing * 2
  ) {
    return limitBig;
  }

  let totalBig = b0;
  let t = 0;
  let j = 0;
  const ts = 6 * lwmaConfig.powTargetSpacing;
  const dividerBig = new BN(
    weight * lwmaConfig.averagingWindow * lwmaConfig.averagingWindow,
  );

  // Loop through N most recent blocks.  "< height", not "<="
  for (let i = height - lwmaConfig.averagingWindow; i < height; i++) {
    cur = prevBlocks[i];
    prev = prevBlocks[i - 1];

    let solvetime = cur.timestamp - prev.timestamp;
    if (lwmaConfig.solveTimeLimitation && solvetime > ts) {
      solvetime = ts;
    }

    j += 1;
    t += solvetime * j;
    const targetBig = bitsToTarget(cur.bits);
    totalBig = totalBig.add(targetBig.div(dividerBig));
  }

  // Keep t reasonable in case strange solvetimes occurred.
  if (
    t <
    Math.trunc(
      (lwmaConfig.averagingWindow * weight) / lwmaConfig.minDenominator,
    )
  ) {
    t = Math.trunc(
      (lwmaConfig.averagingWindow * weight) / lwmaConfig.minDenominator,
    );
  }

  let newTargetBig = totalBig.mul(new BN(t));
  if (newTargetBig.cmp(limitBig) >= 0) {
    newTargetBig = limitBig;
  }

  return newTargetBig;
}

function bitsToTarget(bits: number): BN {
  const bitsBig = new BN(bits);
  const size = bitsBig.shrn(24).toNumber();
  const word = bits & 0x007fffff;

  const wordBig = new BN(word);
  if (size <= 3) {
    return wordBig.shrn(8 * (3 - size));
  }

  return wordBig.shln(8 * (size - 3));
}

function targetToBits(target: BN): number {
  let nsize = Math.trunc((target.bitLength() + 7) / 8);
  let cBig;

  if (nsize <= 3) {
    cBig = target.shln(8 * (3 - nsize));
  } else {
    cBig = target.shrn(8 * (nsize - 3));
  }

  let c = cBig.toNumber();
  if (c & 0x00800000) {
    c >>= 8;
    nsize += 1;
  }

  c |= nsize << 24;
  return c;
}
