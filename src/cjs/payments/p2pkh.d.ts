import { Payment, PaymentOpts } from './index.js';
/**
 * Creates a Pay-to-Public-Key-Hash (P2PKH) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2PKH payment object.
 * @throws {TypeError} If the required data is not provided or if the data is invalid.
 */
export declare function p2pkh(a: Payment, opts?: PaymentOpts): Payment;
