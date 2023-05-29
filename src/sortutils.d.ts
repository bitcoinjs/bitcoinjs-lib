/**
 * Inserts an element into a sorted array.
 * @template T
 * @param {Array<T>} array - The sorted array to insert into.
 * @param {T} element - The element to insert.
 * @param {(a: T, b: T) => number} compare - The comparison function used to sort the array.
 * @returns {number} The index at which the element was inserted.
 */
export declare function insertIntoSortedArray<T>(array: Array<T>, element: T, compare: (a: T, b: T) => number): number;
