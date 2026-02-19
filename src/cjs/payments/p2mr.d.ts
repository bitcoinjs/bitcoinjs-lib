import { Payment, PaymentOpts } from './index.js';
/**
 * Creates a Pay-to-Merkle-Root (P2MR) payment object (BIP 360).
 *
 * P2MR is a SegWit version 2 output type that commits directly to the
 * Merkle root of a script tree without an internal public key.
 * It supports only script-path spending (no key-path spend),
 * providing resistance to long exposure quantum attacks.
 *
 * @param a - The payment object containing the necessary data for P2MR.
 * @param opts - Optional payment options.
 * @returns The P2MR payment object.
 * @throws {TypeError} If the provided data is invalid or insufficient.
 */
export declare function p2mr(a: Payment, opts?: PaymentOpts): Payment;
