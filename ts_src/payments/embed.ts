import { bitcoin as BITCOIN_NETWORK } from '../networks.js';
import * as bscript from '../script.js';
import { stacksEqual, BufferSchema } from '../types.js';
import { Payment, PaymentOpts, Stack } from './index.js';
import * as lazy from './lazy.js';
import * as v from 'valibot';

const OPS = bscript.OPS;

// output: OP_RETURN ...
/**
 * Embeds data in a Bitcoin payment.
 * @param a - The payment object.
 * @param opts - Optional payment options.
 * @returns The modified payment object.
 * @throws {TypeError} If there is not enough data or if the output is invalid.
 */
export function p2data(a: Payment, opts?: PaymentOpts): Payment {
  if (!a.data && !a.output) throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  v.parse(
    v.partial(
      v.object({
        network: v.object({}),
        output: BufferSchema,
        data: v.array(BufferSchema),
      }),
    ),
    a,
  );

  const network = a.network || BITCOIN_NETWORK;
  const o = { name: 'embed', network } as Payment;

  lazy.prop(o, 'output', () => {
    if (!a.data) return;
    return bscript.compile(([OPS.OP_RETURN] as Stack).concat(a.data));
  });
  lazy.prop(o, 'data', () => {
    if (!a.output) return;
    return bscript.decompile(a.output)!.slice(1);
  });

  // extended validation
  if (opts.validate) {
    if (a.output) {
      const chunks = bscript.decompile(a.output);
      if (chunks![0] !== OPS.OP_RETURN)
        throw new TypeError('Output is invalid');
      if (!chunks!.slice(1).every(chunk => v.is(BufferSchema, chunk)))
        throw new TypeError('Output is invalid');
      if (a.data && !stacksEqual(a.data, o.data as Uint8Array[]))
        throw new TypeError('Data mismatch');
    }
  }

  return Object.assign(o, a);
}
