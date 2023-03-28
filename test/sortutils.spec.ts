import * as assert from 'assert';
import { describe, it } from 'mocha';
import { insertIntoSortedArray } from '../src/sortutils';

describe('insertIntoSortedArray', () => {
  it('insert 1 into []', testList([], 1, [1]));

  it('insert 2 into [1]', testList([1], 2, [1, 2]));

  it('insert 1 into [2]', testList([2], 1, [1, 2]));

  it('insert 3 into [1, 2]', testList([1, 2], 3, [1, 2, 3]));

  it('insert 2 into [1, 3]', testList([1, 3], 2, [1, 2, 3]));

  it('insert 1 into [2, 3]', testList([2, 3], 1, [1, 2, 3]));

  it('insert 2 into [1, 2, 3]', testList([1, 2, 3], 2, [1, 2, 2, 3]));
});

function testList(input: number[], insert: number, expected: number[]) {
  return () => {
    const compare = (a: number, b: number) => a - b;
    insertIntoSortedArray(input, insert, compare);
    assert.deepEqual(input, expected);
  };
}
