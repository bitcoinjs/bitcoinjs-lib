import { Payment, PaymentOpts } from './index.js';
/**
 * Embeds data in a Bitcoin payment.
 * @param a - The payment object.
 * @param opts - Optional payment options.
 * @returns The modified payment object.
 * @throws {TypeError} If there is not enough data or if the output is invalid.
 */
export declare function p2data(a: Payment, opts?: PaymentOpts): Payment;
