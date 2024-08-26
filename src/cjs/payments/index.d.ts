/**
 * Represents a payment object, which is used to create a payment.
 *
 * Supports P2PKH、P2SH、P2WPKH、P2WSH、P2TR and so on
 *
 * @packageDocumentation
 */
import { Network } from '../networks.js';
import { Taptree } from '../types.js';
import { p2data as embed } from './embed.js';
import { p2ms } from './p2ms.js';
import { p2pk } from './p2pk.js';
import { p2pkh } from './p2pkh.js';
import { p2sh } from './p2sh.js';
import { p2wpkh } from './p2wpkh.js';
import { p2wsh } from './p2wsh.js';
import { p2tr } from './p2tr.js';
export interface Payment {
    name?: string;
    network?: Network;
    output?: Uint8Array;
    data?: Uint8Array[];
    m?: number;
    n?: number;
    pubkeys?: Uint8Array[];
    input?: Uint8Array;
    signatures?: Uint8Array[];
    internalPubkey?: Uint8Array;
    pubkey?: Uint8Array;
    signature?: Uint8Array;
    address?: string;
    hash?: Uint8Array;
    redeem?: Payment;
    redeemVersion?: number;
    scriptTree?: Taptree;
    witness?: Uint8Array[];
}
export type PaymentCreator = (a: Payment, opts?: PaymentOpts) => Payment;
export type PaymentFunction = () => Payment;
export interface PaymentOpts {
    validate?: boolean;
    allowIncomplete?: boolean;
}
export type StackElement = Uint8Array | number;
export type Stack = StackElement[];
export type StackFunction = () => Stack;
export { embed, p2ms, p2pk, p2pkh, p2sh, p2wpkh, p2wsh, p2tr };
