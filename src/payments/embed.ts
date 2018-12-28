import { Payment, PaymentOpts } from './index'
import * as bscript from '../script'
import * as lazy from './lazy'
import { bitcoin as BITCOIN_NETWORK } from '../networks'
const typef = require('typeforce')
const OPS = require('bitcoin-ops')

function stacksEqual (a: Array<Buffer>, b: Array<Buffer>): boolean {
  if (a.length !== b.length) return false

  return a.every(function (x, i) {
    return x.equals(b[i])
  })
}

// output: OP_RETURN ...
export function p2data (a: Payment, opts: PaymentOpts): Payment {
  if (
    !a.data &&
    !a.output
  ) throw new TypeError('Not enough data')
  opts = Object.assign({ validate: true }, opts || {})

  typef({
    network: typef.maybe(typef.Object),
    output: typef.maybe(typef.Buffer),
    data: typef.maybe(typef.arrayOf(typef.Buffer))
  }, a)

  const network = a.network || BITCOIN_NETWORK
  const o = <Payment>{ network }

  lazy.prop(o, 'output', function () {
    if (!a.data) return
    return bscript.compile([OPS.OP_RETURN].concat(a.data))
  })
  lazy.prop(o, 'data', function () {
    if (!a.output) return
    return (<Array<Buffer | number>>bscript.decompile(a.output)).slice(1)
  })

  // extended validation
  if (opts.validate) {
    if (a.output) {
      const chunks = bscript.decompile(a.output)
      if ((<Array<Buffer | number>>chunks)[0] !== OPS.OP_RETURN) throw new TypeError('Output is invalid')
      if (!(<Array<Buffer | number>>chunks).slice(1).every(typef.Buffer)) throw new TypeError('Output is invalid')

      if (a.data && !stacksEqual(a.data, <Array<Buffer>>o.data)) throw new TypeError('Data mismatch')
    }
  }

  return Object.assign(o, a)
}
