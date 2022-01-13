/// <reference types="node" />
import { Network } from '../networks';
import { TaprootLeaf, TinySecp256k1Interface } from '../types';
import { p2data as embed } from './embed';
import { p2ms } from './p2ms';
import { p2pk } from './p2pk';
import { p2pkh } from './p2pkh';
import { p2sh } from './p2sh';
import { p2wpkh } from './p2wpkh';
import { p2wsh } from './p2wsh';
export interface Payment {
    name?: string;
    network?: Network;
    output?: Buffer;
    data?: Buffer[];
    m?: number;
    n?: number;
    pubkeys?: Buffer[];
    input?: Buffer;
    signatures?: Buffer[];
    internalPubkey?: Buffer;
    pubkey?: Buffer;
    signature?: Buffer;
    address?: string;
    hash?: Buffer;
    redeem?: Payment;
    scriptsTree?: any;
    scriptLeaf?: TaprootLeaf;
    witness?: Buffer[];
}
export declare type PaymentCreator = (a: Payment, opts?: PaymentOpts) => Payment;
export declare type PaymentFunction = () => Payment;
export interface PaymentOpts {
    validate?: boolean;
    allowIncomplete?: boolean;
}
export interface PaymentAPI {
    embed: PaymentCreator;
    p2ms: PaymentCreator;
    p2pk: PaymentCreator;
    p2pkh: PaymentCreator;
    p2sh: PaymentCreator;
    p2wpkh: PaymentCreator;
    p2wsh: PaymentCreator;
    p2tr: PaymentCreator;
}
export declare type StackElement = Buffer | number;
export declare type Stack = StackElement[];
export declare type StackFunction = () => Stack;
export { embed, p2ms, p2pk, p2pkh, p2sh, p2wpkh, p2wsh, PaymentFactory };
export default function PaymentFactory(ecc: TinySecp256k1Interface): PaymentAPI;
