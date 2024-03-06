/// <reference types="node" />
/**
 * Decodes a script number from a buffer.
 *
 * @param buffer - The buffer containing the script number.
 * @param maxLength - The maximum length of the script number. Defaults to 4.
 * @param minimal - Whether the script number should be minimal. Defaults to true.
 * @returns The decoded script number.
 * @throws {TypeError} If the script number overflows the maximum length.
 * @throws {Error} If the script number is not minimally encoded when minimal is true.
 */
export declare function decode(buffer: Buffer, maxLength?: number, minimal?: boolean): number;
/**
 * Encodes a number into a Buffer using a specific format.
 *
 * @param _number - The number to encode.
 * @returns The encoded number as a Buffer.
 */
export declare function encode(_number: number): Buffer;
