import { Payment, PaymentOpts } from './index';
/**
 * Represents a function that creates a Pay-to-Multisig (P2MS) payment object.
 * @param a - The payment object.
 * @param opts - Optional payment options.
 * @returns The created payment object.
 * @throws {TypeError} If the provided data is not valid.
 */
export declare function p2ms(a: Payment, opts?: PaymentOpts): Payment;
