import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import { Payment, PaymentOpts, Stack } from './index';
import * as lazy from './lazy';

const typef = require('typeforce');
const OPS = bscript.OPS;

function stacksEqual(a: Buffer[], b: Buffer[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((x, i) => {
    return x.equals(b[i]);
  });
}

// output: OP_RETURN ...
export function p2data(a: Payment, opts?: PaymentOpts): Payment {
  if (!a.data && !a.output) throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  typef(
    {
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.Buffer),
      data: typef.maybe(typef.arrayOf(typef.Buffer)),
    },
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
      if (!chunks!.slice(1).every(typef.Buffer))
        throw new TypeError('Output is invalid');

      if (a.data && !stacksEqual(a.data, o.data as Buffer[]))
        throw new TypeError('Data mismatch');
    }
  }

  return Object.assign(o, a);
}
