import { bitcoin as BITCOIN_NETWORK } from '../networks';
import * as bscript from '../script';
import { isPoint, typeforce as typef, stacksEqual } from '../types';
import { Payment, PaymentOpts, Stack } from './index';
import * as lazy from './lazy';
const OPS = bscript.OPS;

const OP_INT_BASE = OPS.OP_RESERVED; // OP_1 - 1

// input: OP_0 [signatures ...]
// output: m [pubKeys ...] n OP_CHECKMULTISIG
/**
 * Represents a function that creates a Pay-to-Multisig (P2MS) payment object.
 * @param a - The payment object.
 * @param opts - Optional payment options.
 * @returns The created payment object.
 * @throws {TypeError} If the provided data is not valid.
 */
export function p2ms(a: Payment, opts?: PaymentOpts): Payment {
  if (
    !a.input &&
    !a.output &&
    !(a.pubkeys && a.m !== undefined) &&
    !a.signatures
  )
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  function isAcceptableSignature(x: Buffer | number): boolean {
    return (
      bscript.isCanonicalScriptSignature(x as Buffer) ||
      (opts!.allowIncomplete && (x as number) === OPS.OP_0) !== undefined
    );
  }

  typef(
    {
      network: typef.maybe(typef.Object),
      m: typef.maybe(typef.Number),
      n: typef.maybe(typef.Number),
      output: typef.maybe(typef.Buffer),
      pubkeys: typef.maybe(typef.arrayOf(isPoint)),

      signatures: typef.maybe(typef.arrayOf(isAcceptableSignature)),
      input: typef.maybe(typef.Buffer),
    },
    a,
  );

  const network = a.network || BITCOIN_NETWORK;
  const o: Payment = { network };

  let chunks: Stack = [];
  let decoded = false;
  function decode(output: Buffer | Stack): void {
    if (decoded) return;
    decoded = true;
    chunks = bscript.decompile(output) as Stack;
    o.m = (chunks[0] as number) - OP_INT_BASE;
    o.n = (chunks[chunks.length - 2] as number) - OP_INT_BASE;
    o.pubkeys = chunks.slice(1, -2) as Buffer[];
  }

  lazy.prop(o, 'output', () => {
    if (!a.m) return;
    if (!o.n) return;
    if (!a.pubkeys) return;
    return bscript.compile(
      ([] as Stack).concat(
        OP_INT_BASE + a.m,
        a.pubkeys,
        OP_INT_BASE + o.n,
        OPS.OP_CHECKMULTISIG,
      ),
    );
  });
  lazy.prop(o, 'm', () => {
    if (!o.output) return;
    decode(o.output);
    return o.m;
  });
  lazy.prop(o, 'n', () => {
    if (!o.pubkeys) return;
    return o.pubkeys.length;
  });
  lazy.prop(o, 'pubkeys', () => {
    if (!a.output) return;
    decode(a.output);
    return o.pubkeys;
  });
  lazy.prop(o, 'signatures', () => {
    if (!a.input) return;
    return bscript.decompile(a.input)!.slice(1);
  });
  lazy.prop(o, 'input', () => {
    if (!a.signatures) return;
    return bscript.compile(([OPS.OP_0] as Stack).concat(a.signatures));
  });
  lazy.prop(o, 'witness', () => {
    if (!o.input) return;
    return [];
  });
  lazy.prop(o, 'name', () => {
    if (!o.m || !o.n) return;
    return `p2ms(${o.m} of ${o.n})`;
  });

  // extended validation
  if (opts.validate) {
    if (a.output) {
      decode(a.output);
      if (!typef.Number(chunks[0])) throw new TypeError('Output is invalid');
      if (!typef.Number(chunks[chunks.length - 2]))
        throw new TypeError('Output is invalid');
      if (chunks[chunks.length - 1] !== OPS.OP_CHECKMULTISIG)
        throw new TypeError('Output is invalid');

      if (o.m! <= 0 || o.n! > 16 || o.m! > o.n! || o.n !== chunks.length - 3)
        throw new TypeError('Output is invalid');
      if (!o.pubkeys!.every(x => isPoint(x)))
        throw new TypeError('Output is invalid');

      if (a.m !== undefined && a.m !== o.m) throw new TypeError('m mismatch');
      if (a.n !== undefined && a.n !== o.n) throw new TypeError('n mismatch');
      if (a.pubkeys && !stacksEqual(a.pubkeys, o.pubkeys!))
        throw new TypeError('Pubkeys mismatch');
    }

    if (a.pubkeys) {
      if (a.n !== undefined && a.n !== a.pubkeys.length)
        throw new TypeError('Pubkey count mismatch');
      o.n = a.pubkeys.length;

      if (o.n < o.m!) throw new TypeError('Pubkey count cannot be less than m');
    }

    if (a.signatures) {
      if (a.signatures.length < o.m!)
        throw new TypeError('Not enough signatures provided');
      if (a.signatures.length > o.m!)
        throw new TypeError('Too many signatures provided');
    }

    if (a.input) {
      if (a.input[0] !== OPS.OP_0) throw new TypeError('Input is invalid');
      if (
        o.signatures!.length === 0 ||
        !o.signatures!.every(isAcceptableSignature)
      )
        throw new TypeError('Input has invalid signature(s)');

      if (a.signatures && !stacksEqual(a.signatures, o.signatures!))
        throw new TypeError('Signature mismatch');
      if (a.m !== undefined && a.m !== a.signatures!.length)
        throw new TypeError('Signature count mismatch');
    }
  }

  return Object.assign(o, a);
}
