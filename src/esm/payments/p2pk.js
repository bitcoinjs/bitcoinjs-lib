import { bitcoin as BITCOIN_NETWORK } from '../networks.js';
import * as bscript from '../script.js';
import { BufferSchema, isPoint } from '../types.js';
import * as lazy from './lazy.js';
import * as tools from 'uint8array-tools';
import * as v from 'valibot';
const OPS = bscript.OPS;
// input: {signature}
// output: {pubKey} OP_CHECKSIG
/**
 * Creates a pay-to-public-key (P2PK) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2PK payment object.
 * @throws {TypeError} If the required data is not provided or if the data is invalid.
 */
export function p2pk(a, opts) {
  if (!a.input && !a.output && !a.pubkey && !a.input && !a.signature)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  v.parse(
    v.partial(
      v.object({
        network: v.object({}),
        output: BufferSchema,
        pubkey: v.custom(isPoint, 'invalid pubkey'),
        signature: v.custom(
          bscript.isCanonicalScriptSignature,
          'Expected signature to be of type isCanonicalScriptSignature',
        ),
        input: BufferSchema,
      }),
    ),
    a,
  );
  const _chunks = lazy.value(() => {
    return bscript.decompile(a.input);
  });
  const network = a.network || BITCOIN_NETWORK;
  const o = { name: 'p2pk', network };
  lazy.prop(o, 'output', () => {
    if (!a.pubkey) return;
    return bscript.compile([a.pubkey, OPS.OP_CHECKSIG]);
  });
  lazy.prop(o, 'pubkey', () => {
    if (!a.output) return;
    return a.output.slice(1, -1);
  });
  lazy.prop(o, 'signature', () => {
    if (!a.input) return;
    return _chunks()[0];
  });
  lazy.prop(o, 'input', () => {
    if (!a.signature) return;
    return bscript.compile([a.signature]);
  });
  lazy.prop(o, 'witness', () => {
    if (!o.input) return;
    return [];
  });
  // extended validation
  if (opts.validate) {
    if (a.output) {
      if (a.output[a.output.length - 1] !== OPS.OP_CHECKSIG)
        throw new TypeError('Output is invalid');
      if (!isPoint(o.pubkey)) throw new TypeError('Output pubkey is invalid');
      if (a.pubkey && tools.compare(a.pubkey, o.pubkey) !== 0)
        throw new TypeError('Pubkey mismatch');
    }
    if (a.signature) {
      if (a.input && tools.compare(a.input, o.input) !== 0)
        throw new TypeError('Signature mismatch');
    }
    if (a.input) {
      if (_chunks().length !== 1) throw new TypeError('Input is invalid');
      if (!bscript.isCanonicalScriptSignature(o.signature))
        throw new TypeError('Input has invalid signature');
    }
  }
  return Object.assign(o, a);
}
