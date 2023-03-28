import * as assert from 'assert';
import { describe, it } from 'mocha';
import { HuffmanTapTreeNode, Taptree } from '../src/types';
import { createTapTreeUsingHuffmanConstructor } from '../src/psbt/bip371';

describe('Taptree using Huffman Constructor', () => {
  const scriptBuff = Buffer.from('');

  it('test empty array', () => {
    assert.throws(() => createTapTreeUsingHuffmanConstructor([]), {
      message: 'Cannot create taptree from empty list.',
    });
  });

  it(
    'should return only one node for a single leaf',
    testLeafDistances([{ weight: 1, node: { output: scriptBuff } }], [0]),
  );

  it(
    'should return a balanced tree for a list of scripts with equal weights',
    testLeafDistances(
      [
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
      ],
      [2, 2, 2, 2],
    ),
  );

  it(
    'should return an optimal binary tree for a list of scripts with weights [1, 2, 3, 4, 5]',
    testLeafDistances(
      [
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 2,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 3,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 4,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 5,
          node: {
            output: scriptBuff,
          },
        },
      ],
      [3, 3, 2, 2, 2],
    ),
  );

  it(
    'should return an optimal binary tree for a list of scripts with weights [1, 2, 3, 3]',
    testLeafDistances(
      [
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 2,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 3,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 3,
          node: {
            output: scriptBuff,
          },
        },
      ],
      [3, 3, 2, 1],
    ),
  );

  it(
    'should return an optimal binary tree for a list of scripts with some negative weights: [1, 2, 3, -3]',
    testLeafDistances(
      [
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 2,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 3,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: -3,
          node: {
            output: scriptBuff,
          },
        },
      ],
      [3, 2, 1, 3],
    ),
  );

  it(
    'should return an optimal binary tree for a list of scripts with some weights specified as infinity',
    testLeafDistances(
      [
        {
          weight: 1,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: Number.POSITIVE_INFINITY,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: 3,
          node: {
            output: scriptBuff,
          },
        },
        {
          weight: Number.NEGATIVE_INFINITY,
          node: {
            output: scriptBuff,
          },
        },
      ],
      [3, 1, 2, 3],
    ),
  );
});

function testLeafDistances(
  input: HuffmanTapTreeNode[],
  expectedDistances: number[],
) {
  return () => {
    const tree = createTapTreeUsingHuffmanConstructor(input);

    if (!Array.isArray(tree)) {
      // tree is just one node
      assert.deepEqual([0], expectedDistances);
      return;
    }

    const leaves = input.map(value => value.node);

    const map = new Map<Taptree, number>(); // Map of leaf to actual distance
    let currentDistance = 1;
    let currentArray: Array<Taptree[] | Taptree> = tree as any;
    let nextArray: Array<Taptree[] | Taptree> = [];
    while (currentArray.length > 0) {
      currentArray.forEach(value => {
        if (Array.isArray(value)) {
          nextArray = nextArray.concat(value);
          return;
        }
        map.set(value, currentDistance);
      });

      currentDistance += 1; // New level
      currentArray = nextArray;
      nextArray = [];
    }

    const actualDistances = leaves.map(value => map.get(value));
    assert.deepEqual(actualDistances, expectedDistances);
  };
}
