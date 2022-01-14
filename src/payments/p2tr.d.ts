import { TinySecp256k1Interface } from '../types';
import { Payment, PaymentOpts } from './index';
export declare function p2tr(a: Payment, opts?: PaymentOpts, eccLib?: TinySecp256k1Interface): Payment;
