import { Payment, PaymentOpts } from './index';
/**
 * Creates a Pay-to-Script-Hash (P2SH) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2SH payment object.
 * @throws {TypeError} If the required data is not provided or if the data is invalid.
 */
export declare function p2sh(a: Payment, opts?: PaymentOpts): Payment;
