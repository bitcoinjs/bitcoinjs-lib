import { Payment, PaymentOpts } from './index.js';
/**
 * Creates a Pay-to-Taproot (P2TR) payment object.
 *
 * @param a - The payment object containing the necessary data for P2TR.
 * @param opts - Optional payment options.
 * @returns The P2TR payment object.
 * @throws {TypeError} If the provided data is invalid or insufficient.
 */
export declare function p2tr(a: Payment, opts?: PaymentOpts): Payment;
