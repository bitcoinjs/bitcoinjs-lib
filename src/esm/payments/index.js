import { p2data as embed } from './embed.js';
import { p2ms } from './p2ms.js';
import { p2pk } from './p2pk.js';
import { p2pkh } from './p2pkh.js';
import { p2sh } from './p2sh.js';
import { p2wpkh } from './p2wpkh.js';
import { p2wsh } from './p2wsh.js';
import { p2tr } from './p2tr.js';
import { p2sp, scanForSilentPayments, deriveOutput } from './p2sp.js';
export {
  embed,
  p2ms,
  p2pk,
  p2pkh,
  p2sh,
  p2wpkh,
  p2wsh,
  p2tr,
  p2sp,
  // TODO how should we expose the two functions below?
  scanForSilentPayments,
  deriveOutput,
};
// TODO
// witness commitment
