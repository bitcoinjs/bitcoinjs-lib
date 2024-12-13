import { Payment, PaymentOpts } from './index.js';
/**
 * Creates a pay-to-witness-public-key-hash (p2wpkh) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The p2wpkh payment object.
 * @throws {TypeError} If the required data is missing or invalid.
 */
export declare function p2wpkh(a: Payment, opts?: PaymentOpts): Payment;
