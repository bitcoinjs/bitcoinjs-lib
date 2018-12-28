import { Payment, PaymentOpts } from './index'
import * as bscript from '../script'
import * as lazy from './lazy'
import { bitcoin as BITCOIN_NETWORK } from '../networks'
const typef = require('typeforce')
const OPS = require('bitcoin-ops')
const ecc = require('tiny-secp256k1')

const OP_INT_BASE = OPS.OP_RESERVED // OP_1 - 1

function stacksEqual (a: Array<Buffer>, b: Array<Buffer>): boolean {
  if (a.length !== b.length) return false

  return a.every(function (x, i) {
    return x.equals(b[i])
  })
}

// input: OP_0 [signatures ...]
// output: m [pubKeys ...] n OP_CHECKMULTISIG
export function p2ms (a: Payment, opts: PaymentOpts): Payment {
  if (
    !a.input &&
    !a.output &&
    !(a.pubkeys && a.m !== undefined) &&
    !a.signatures
  ) throw new TypeError('Not enough data')
  opts = Object.assign({ validate: true }, opts || {})

  function isAcceptableSignature (x: Buffer | number) {
    return bscript.isCanonicalScriptSignature(<Buffer>x) || (opts.allowIncomplete && (<number>x === OPS.OP_0)) !== undefined
  }

  typef({
    network: typef.maybe(typef.Object),
    m: typef.maybe(typef.Number),
    n: typef.maybe(typef.Number),
    output: typef.maybe(typef.Buffer),
    pubkeys: typef.maybe(typef.arrayOf(ecc.isPoint)),

    signatures: typef.maybe(typef.arrayOf(isAcceptableSignature)),
    input: typef.maybe(typef.Buffer)
  }, a)

  const network = a.network || BITCOIN_NETWORK
  const o: Payment = { network }

  let chunks: Array<Buffer | number> = []
  let decoded = false
  function decode (output: Buffer | Array<Buffer | number>): void {
    if (decoded) return
    decoded = true
    chunks = <Array<Buffer | number>>bscript.decompile(output)
    o.m = <number>chunks[0] - OP_INT_BASE
    o.n = <number>chunks[chunks.length - 2] - OP_INT_BASE
    o.pubkeys = <Array<Buffer>>chunks.slice(1, -2)
  }

  lazy.prop(o, 'output', function () {
    if (!a.m) return
    if (!o.n) return
    if (!a.pubkeys) return
    return bscript.compile((<Array<Buffer | number>>[]).concat(
      OP_INT_BASE + a.m,
      a.pubkeys,
      OP_INT_BASE + o.n,
      OPS.OP_CHECKMULTISIG
    ))
  })
  lazy.prop(o, 'm', function () {
    if (!o.output) return
    decode(o.output)
    return o.m
  })
  lazy.prop(o, 'n', function () {
    if (!o.pubkeys) return
    return o.pubkeys.length
  })
  lazy.prop(o, 'pubkeys', function () {
    if (!a.output) return
    decode(a.output)
    return o.pubkeys
  })
  lazy.prop(o, 'signatures', function () {
    if (!a.input) return
    return (<Array<Buffer | number>>bscript.decompile(a.input)).slice(1)
  })
  lazy.prop(o, 'input', function () {
    if (!a.signatures) return
    return bscript.compile([OPS.OP_0].concat(a.signatures))
  })
  lazy.prop(o, 'witness', function () {
    if (!o.input) return
    return []
  })

  // extended validation
  if (opts.validate) {
    if (a.output) {
      decode(a.output)
      if (!typef.Number(chunks[0])) throw new TypeError('Output is invalid')
      if (!typef.Number(chunks[chunks.length - 2])) throw new TypeError('Output is invalid')
      if (chunks[chunks.length - 1] !== OPS.OP_CHECKMULTISIG) throw new TypeError('Output is invalid')

      if (
        <number>(<Payment>o).m <= 0 ||
        <number>(<Payment>o).n > 16 ||
        <number>(<Payment>o).m > <number>(<Payment>o).n ||
        o.n !== chunks.length - 3) throw new TypeError('Output is invalid')
      if (!(<Array<Buffer>>o.pubkeys).every(x => ecc.isPoint(x))) throw new TypeError('Output is invalid')

      if (a.m !== undefined && a.m !== o.m) throw new TypeError('m mismatch')
      if (a.n !== undefined && a.n !== o.n) throw new TypeError('n mismatch')
      if (a.pubkeys && !stacksEqual(a.pubkeys, (<Array<Buffer>>o.pubkeys))) throw new TypeError('Pubkeys mismatch')
    }

    if (a.pubkeys) {
      if (a.n !== undefined && a.n !== a.pubkeys.length) throw new TypeError('Pubkey count mismatch')
      o.n = a.pubkeys.length

      if (o.n < <number>(<Payment>o).m) throw new TypeError('Pubkey count cannot be less than m')
    }

    if (a.signatures) {
      if (a.signatures.length < <number>(<Payment>o).m) throw new TypeError('Not enough signatures provided')
      if (a.signatures.length > <number>(<Payment>o).m) throw new TypeError('Too many signatures provided')
    }

    if (a.input) {
      if (a.input[0] !== OPS.OP_0) throw new TypeError('Input is invalid')
      if ((<Array<Buffer>>o.signatures).length === 0 || !(<Array<Buffer>>o.signatures).every(isAcceptableSignature)) throw new TypeError('Input has invalid signature(s)')

      if (a.signatures && !stacksEqual(a.signatures, (<Array<Buffer>>o.signatures))) throw new TypeError('Signature mismatch')
      if (a.m !== undefined && a.m !== (<Array<Buffer>>a.signatures).length) throw new TypeError('Signature count mismatch')
    }
  }

  return Object.assign(o, a)
}
