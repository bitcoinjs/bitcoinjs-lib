import { Network } from '../networks';
import { p2data as embed } from './embed';
import { p2ms } from './p2ms';
import { p2pk } from './p2pk';
import { p2pkh } from './p2pkh';
import { p2sh } from './p2sh';
import { p2wpkh } from './p2wpkh';
import { p2wsh } from './p2wsh';

export interface Payment {
  network?: Network;
  output?: Buffer;
  data?: Array<Buffer>;
  m?: number;
  n?: number;
  pubkeys?: Array<Buffer>;
  input?: Buffer;
  signatures?: Array<Buffer>;
  pubkey?: Buffer;
  signature?: Buffer;
  address?: string;
  hash?: Buffer;
  redeem?: Payment;
  witness?: Array<Buffer>;
}

export interface PaymentOpts {
  validate?: boolean;
  allowIncomplete?: boolean;
}

export { embed, p2ms, p2pk, p2pkh, p2sh, p2wpkh, p2wsh };

// TODO
// witness commitment
