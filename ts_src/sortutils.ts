/**
 * Inserts an element into a sorted array.
 * @template T
 * @param {Array<T>} array - The sorted array to insert into.
 * @param {T} element - The element to insert.
 * @param {(a: T, b: T) => number} compare - The comparison function used to sort the array.
 * @returns {number} The index at which the element was inserted.
 */
export function insertIntoSortedArray<T>(
  array: Array<T>,
  element: T,
  compare: (a: T, b: T) => number,
) {
  let high = array.length - 1;
  let low = 0;
  let mid;
  let highElement, lowElement, midElement;
  let compareHigh, compareLow, compareMid;
  let targetIndex;
  while (targetIndex === undefined) {
    if (high < low) {
      targetIndex = low;
      continue;
    }

    mid = Math.floor((low + high) / 2);

    highElement = array[high];
    lowElement = array[low];
    midElement = array[mid];

    compareHigh = compare(element, highElement);
    compareLow = compare(element, lowElement);
    compareMid = compare(element, midElement);

    if (low === high) {
      // Target index is either to the left or right of element at low
      if (compareLow <= 0) targetIndex = low;
      else targetIndex = low + 1;
      continue;
    }

    if (compareHigh >= 0) {
      // Target index is to the right of high
      low = high;
      continue;
    }
    if (compareLow <= 0) {
      // Target index is to the left of low
      high = low;
      continue;
    }

    if (compareMid <= 0) {
      // Target index is to the left of mid
      high = mid;
      continue;
    }

    // Target index is to the right of mid
    low = mid + 1;
  }

  array.splice(targetIndex, 0, element);
  return targetIndex;
}
