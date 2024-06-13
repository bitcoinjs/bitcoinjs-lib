import { Payment, PaymentOpts } from './index';
/**
 * Creates a pay-to-public-key (P2PK) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2PK payment object.
 * @throws {TypeError} If the required data is not provided or if the data is invalid.
 */
export declare function p2pk(a: Payment, opts?: PaymentOpts): Payment;
