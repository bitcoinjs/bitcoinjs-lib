import { Network } from '../networks';
import { p2data as embed } from './embed';
import { p2ms } from './p2ms';
import { p2pk } from './p2pk';
import { p2pkh } from './p2pkh';
import { p2sh } from './p2sh';
import { p2tr } from './p2tr';
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
  pubkey?: Buffer;
  signature?: Buffer;
  address?: string;
  hash?: Buffer;
  redeem?: Payment;
  witness?: Buffer[];
  scripts?: Buffer[];
  weights?: number[];
}

export type PaymentCreator = (a: Payment, opts?: PaymentOpts) => Payment;

export type PaymentFunction = () => Payment;

export interface PaymentOpts {
  validate?: boolean;
  allowIncomplete?: boolean;
}

export type StackElement = Buffer | number;
export type Stack = StackElement[];
export type StackFunction = () => Stack;

export { embed, p2ms, p2pk, p2pkh, p2sh, p2tr, p2wpkh, p2wsh };

// TODO
// witness commitment
