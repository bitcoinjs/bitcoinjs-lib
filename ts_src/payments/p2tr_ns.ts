import { bitcoin as BITCOIN_NETWORK } from '../networks';
import { isXOnlyPoint } from '../schnorrBip340';
import * as bscript from '../script';
import { Payment, PaymentOpts, Stack } from './index';
import * as lazy from './lazy';
const OPS = bscript.OPS;
const typef = require('typeforce');

function stacksEqual(a: Buffer[], b: Buffer[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((x, i) => {
    return x.equals(b[i]);
  });
}

// input: [signatures ...]
// output: [pubKeys[0:n-1] OP_CHECKSIGVERIFY] pubKeys[n-1] OP_CHECKSIG
export function p2tr_ns(a: Payment, opts?: PaymentOpts): Payment {
  if (
    !a.input &&
    !a.output &&
    !(a.pubkeys && a.pubkeys.length) &&
    !a.signatures
  )
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});

  function isAcceptableSignature(x: Buffer | number): boolean {
    if (Buffer.isBuffer(x))
      return (
        // empty signatures may be represented as empty buffers
        (opts && opts.allowIncomplete && x.length === 0) ||
        bscript.isCanonicalSchnorrSignature(x)
      );
    return !!(opts && opts.allowIncomplete && x === OPS.OP_0);
  }

  typef(
    {
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.Buffer),
      pubkeys: typef.maybe(typef.arrayOf(isXOnlyPoint)),

      signatures: typef.maybe(typef.arrayOf(isAcceptableSignature)),
      input: typef.maybe(typef.Buffer),
    },
    a,
  );

  const network = a.network || BITCOIN_NETWORK;
  const o: Payment = { network };

  const _chunks = lazy.value(() => {
    if (!a.output) return;
    return bscript.decompile(a.output) as Stack;
  });

  lazy.prop(o, 'output', () => {
    if (!a.pubkeys) return;
    return bscript.compile(
      ([] as Stack).concat(
        ...a.pubkeys.map((pk, i, pks) => [
          pk,
          i === pks.length - 1 ? OPS.OP_CHECKSIG : OPS.OP_CHECKSIGVERIFY,
        ]),
      ),
    );
  });
  lazy.prop(o, 'n', () => {
    if (!o.pubkeys) return;
    return o.pubkeys.length;
  });
  lazy.prop(o, 'pubkeys', () => {
    const chunks = _chunks();
    if (!chunks) return;
    return chunks.filter((_, index) => index % 2 === 0) as Buffer[];
  });
  lazy.prop(o, 'signatures', () => {
    if (!a.input) return;
    return bscript.decompile(a.input)!.reverse();
  });
  lazy.prop(o, 'input', () => {
    if (!a.signatures) return;
    return bscript.compile([...a.signatures].reverse());
  });
  lazy.prop(o, 'witness', () => {
    if (!o.input) return;
    return [];
  });
  lazy.prop(o, 'name', () => {
    if (!o.n) return;
    return `p2tr_ns(${o.n})`;
  });

  // extended validation
  if (opts.validate) {
    const chunks = _chunks();
    if (chunks) {
      if (chunks[chunks.length - 1] !== OPS.OP_CHECKSIG)
        throw new TypeError('Output ends with unexpected opcode');
      if (
        chunks
          .filter((_, index) => index % 2 === 1)
          .slice(0, -1)
          .some(op => op !== OPS.OP_CHECKSIGVERIFY)
      )
        throw new TypeError('Output contains unexpected opcode');
      if (o.n! > 16 || o.n !== chunks.length / 2)
        throw new TypeError('Output contains too many pubkeys');
      if (o.pubkeys!.some(x => !isXOnlyPoint(x)))
        throw new TypeError('Output contains invalid pubkey(s)');

      if (a.pubkeys && !stacksEqual(a.pubkeys, o.pubkeys!))
        throw new TypeError('Pubkeys mismatch');
    }

    if (a.pubkeys && a.pubkeys.length) {
      o.n = a.pubkeys.length;
    }

    if (a.signatures) {
      if (a.signatures.length < o.n!)
        throw new TypeError('Not enough signatures provided');
      if (a.signatures.length > o.n!)
        throw new TypeError('Too many signatures provided');
    }

    if (a.input) {
      if (!o.signatures!.every(isAcceptableSignature))
        throw new TypeError('Input has invalid signature(s)');

      if (a.signatures && !stacksEqual(a.signatures, o.signatures!))
        throw new TypeError('Signature mismatch');
      if (o.n !== o.signatures!.length)
        throw new TypeError(
          `Signature count mismatch (n: ${o.n}, signatures.length: ${
            o.signatures!.length
          }`,
        );
    }
  }

  return Object.assign(o, a);
}
